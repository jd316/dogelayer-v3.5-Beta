import { DogecoinP2PKH } from '../scripts/p2pkh';
import { UTXO } from '../../../types/UTXO';
import axios from 'axios';

export class WithdrawalProcessor {
    private readonly rpcUrl: string;
    private readonly rpcUser: string;
    private readonly rpcPassword: string;
    private readonly dogecoin: DogecoinP2PKH;

    constructor(
        privateKey: string,
        rpcUrl: string,
        rpcUser: string,
        rpcPassword: string
    ) {
        this.rpcUrl = rpcUrl;
        this.rpcUser = rpcUser;
        this.rpcPassword = rpcPassword;
        this.dogecoin = new DogecoinP2PKH(privateKey);
    }

    public async processWithdrawal(
        toAddress: string,
        amount: number,
        fee: number
    ): Promise<string> {
        // Get UTXOs for the withdrawal
        const utxos = await this.getUTXOs(amount);
        
        // Create transaction
        const signedTx = this.dogecoin.signMessage(
            JSON.stringify({
                utxos,
                toAddress,
                amount,
                fee
            })
        );

        // Broadcast transaction
        return await this.broadcastTransaction(signedTx);
    }

    private async getUTXOs(requiredAmount: number): Promise<UTXO[]> {
        try {
            const response = await this.rpcCall('listunspent', [1, 9999999]);
            
            if (response.error) {
                throw new Error(`RPC Error: ${response.error.message}`);
            }

            const utxos = response.result;
            const selectedUtxos: UTXO[] = [];
            let total = 0;

            for (const utxo of utxos) {
                const formattedUtxo: UTXO = {
                    txid: utxo.txid,
                    vout: utxo.vout,
                    value: Math.floor(utxo.amount * 100000000), // Convert DOGE to satoshis
                    confirmations: utxo.confirmations,
                    scriptPubKey: utxo.scriptPubKey
                };
                selectedUtxos.push(formattedUtxo);
                total += formattedUtxo.value;
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

    private async broadcastTransaction(txHex: string): Promise<string> {
        const response = await this.rpcCall('sendrawtransaction', [txHex]);
        if (response.error) {
            throw new Error(`Failed to broadcast transaction: ${response.error.message}`);
        }
        return response.result;
    }
} 