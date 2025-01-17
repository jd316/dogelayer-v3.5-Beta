import { DogecoinP2WPKH } from '../scripts/p2wpkh';
import { EventEmitter } from 'events';
import { UTXO } from '../../../types/UTXO';
import axios from 'axios';

interface WithdrawalEvent {
    sender: string;
    dogeAddress: string;
    amount: number;
    withdrawalId: string;
}

export class WithdrawalProcessor extends EventEmitter {
    private readonly rpcUrl: string;
    private readonly rpcUser: string;
    private readonly rpcPassword: string;
    private readonly p2wpkh: DogecoinP2WPKH;
    private processedWithdrawals: Set<string> = new Set();

    constructor(
        privateKey: string,
        rpcUrl: string,
        rpcUser: string,
        rpcPassword: string
    ) {
        super();
        this.p2wpkh = new DogecoinP2WPKH(privateKey);
        this.rpcUrl = rpcUrl;
        this.rpcUser = rpcUser;
        this.rpcPassword = rpcPassword;
    }

    async processWithdrawal(event: WithdrawalEvent): Promise<string> {
        try {
            // Check if already processed
            if (this.processedWithdrawals.has(event.withdrawalId)) {
                throw new Error('Withdrawal already processed');
            }

            // Create and sign transaction
            const utxos = await this.getSpendableUTXOs(event.amount);
            const tx = await this.p2wpkh.createTransaction(
                utxos,
                event.dogeAddress,
                event.amount,
                this.calculateFee(utxos.length, 2) // 2 outputs (recipient + change)
            );

            // Send transaction
            const txid = await this.broadcastTransaction(tx);
            
            // Mark as processed
            this.processedWithdrawals.add(event.withdrawalId);
            
            // Emit success event
            this.emit('withdrawal_processed', {
                withdrawalId: event.withdrawalId,
                txid,
                dogeAddress: event.dogeAddress,
                amount: event.amount
            });

            return txid;
        } catch (error) {
            this.emit('withdrawal_failed', {
                withdrawalId: event.withdrawalId,
                error: error.message
            });
            throw error;
        }
    }

    private async getSpendableUTXOs(requiredAmount: number): Promise<UTXO[]> {
        try {
            const response = await this.rpcCall('listunspent', [1, 9999999]);
            if (response.error) {
                throw new Error(`RPC Error: ${response.error.message}`);
            }

            const utxos = response.result
                .filter(utxo => utxo.spendable)
                .map(utxo => ({
                    txid: utxo.txid,
                    vout: utxo.vout,
                    value: Math.floor(utxo.amount * 100000000), // Convert DOGE to satoshis
                    confirmations: utxo.confirmations
                }));

            // Sort UTXOs by value descending
            utxos.sort((a, b) => b.value - a.value);

            let total = 0;
            const selectedUtxos = [];
            for (const utxo of utxos) {
                selectedUtxos.push(utxo);
                total += utxo.value;
                if (total >= requiredAmount) break;
            }

            if (total < requiredAmount) {
                throw new Error('Insufficient funds for withdrawal');
            }

            return selectedUtxos;
        } catch (error) {
            console.error('Error fetching UTXOs:', error);
            throw error;
        }
    }

    private calculateFee(numInputs: number, numOutputs: number): number {
        // Simple fee calculation (can be made more sophisticated)
        const bytesPerInput = 148;
        const bytesPerOutput = 34;
        const baseBytes = 10;
        const totalBytes = baseBytes + (numInputs * bytesPerInput) + (numOutputs * bytesPerOutput);
        const satoshisPerByte = 1; // Adjust based on network conditions
        return totalBytes * satoshisPerByte;
    }

    private async broadcastTransaction(txHex: string): Promise<string> {
        try {
            const response = await this.rpcCall('sendrawtransaction', [txHex]);
            if (response.error) {
                throw new Error(`RPC Error: ${response.error.message}`);
            }
            return response.result;
        } catch (error) {
            console.error('Error broadcasting transaction:', error);
            throw error;
        }
    }

    private async rpcCall(method: string, params: any[]): Promise<any> {
        try {
            const response = await axios.post(
                this.rpcUrl,
                {
                    jsonrpc: '2.0',
                    id: Date.now().toString(),
                    method,
                    params
                },
                {
                    auth: {
                        username: this.rpcUser,
                        password: this.rpcPassword
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('RPC call failed:', error);
            throw error;
        }
    }
} 