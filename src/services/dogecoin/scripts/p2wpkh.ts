import { payments, Network } from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib/src/psbt';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { P2WPKHError } from '../../../errors/P2WPKHError';
import { UTXO } from '../../../types/UTXO';

const ECPair = ECPairFactory(ecc as any);

export const DOGECOIN_NETWORK: Network = {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x71,
    scriptHash: 0xc4,
    wif: 0xf1,
};

export class DogecoinP2WPKH {
    private keypair: ECPairInterface;
    private address: string;

    constructor(privateKey: string) {
        try {
            // Convert hex private key to buffer
            const privateKeyBuffer = Buffer.from(privateKey, 'hex');
            if (privateKeyBuffer.length !== 32) {
                throw new Error('Invalid private key length');
            }

            this.keypair = ECPair.fromPrivateKey(privateKeyBuffer, { network: DOGECOIN_NETWORK });
            const { address } = payments.p2wpkh({
                pubkey: this.keypair.publicKey,
                network: DOGECOIN_NETWORK,
            });
            
            if (!address) {
                throw new Error('Failed to generate address');
            }
            
            this.address = address;
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new P2WPKHError(`Failed to initialize P2WPKH: ${error.message}`);
            }
            throw new P2WPKHError('Failed to initialize P2WPKH: Unknown error');
        }
    }

    getAddress(): string {
        return this.address;
    }

    async createTransaction(utxos: UTXO[], toAddress: string, amount: number, fee: number): Promise<string> {
        try {
            // Check dust threshold first
            const DUST_THRESHOLD = 546;
            if (amount < DUST_THRESHOLD) {
                throw new Error('Amount below dust threshold');
            }

            // Validate amount and fee
            if (typeof amount !== 'number' || amount <= 0) {
                throw new Error('Invalid amount');
            }

            if (typeof fee !== 'number' || fee < 0) {
                throw new Error('Invalid fee');
            }

            // Validate UTXOs
            if (!Array.isArray(utxos) || utxos.length === 0) {
                throw new Error('No UTXOs provided');
            }

            // Calculate total input amount
            const totalInput = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
            const totalOutput = amount + fee;

            if (totalInput < totalOutput) {
                throw new Error('Insufficient funds');
            }

            // Validate address format
            if (!toAddress.startsWith('doge1')) {
                throw new Error('Invalid address');
            }

            // Create transaction
            const psbt = new Psbt({ network: DOGECOIN_NETWORK });

            // Add inputs
            for (const utxo of utxos) {
                if (!utxo.txid || utxo.txid.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(utxo.txid)) {
                    throw new Error('Invalid UTXO txid');
                }
                if (typeof utxo.vout !== 'number' || utxo.vout < 0) {
                    throw new Error('Invalid UTXO vout');
                }
                if (typeof utxo.value !== 'number' || utxo.value <= 0) {
                    throw new Error('Invalid UTXO value');
                }

                const p2wpkh = payments.p2wpkh({
                    pubkey: this.keypair.publicKey,
                    network: DOGECOIN_NETWORK,
                });

                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: {
                        script: p2wpkh.output!,
                        value: utxo.value,
                    }
                });
            }

            // Add output for recipient
            const recipientP2wpkh = payments.p2wpkh({
                pubkey: this.keypair.publicKey,
                network: DOGECOIN_NETWORK,
            });
            if (!recipientP2wpkh.output) {
                throw new Error('Failed to create recipient script');
            }
            psbt.addOutput({
                script: recipientP2wpkh.output,
                value: amount,
            });

            // Add change output if necessary
            const change = totalInput - totalOutput;
            if (change > DUST_THRESHOLD) {
                const changeP2wpkh = payments.p2wpkh({
                    pubkey: this.keypair.publicKey,
                    network: DOGECOIN_NETWORK,
                });
                if (!changeP2wpkh.output) {
                    throw new Error('Failed to create change script');
                }
                psbt.addOutput({
                    script: changeP2wpkh.output,
                    value: change,
                });
            }

            // Sign all inputs
            for (let i = 0; i < utxos.length; i++) {
                psbt.signInput(i, this.keypair);
            }

            psbt.finalizeAllInputs();

            // Extract transaction
            const tx = psbt.extractTransaction();
            return tx.toHex();
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new P2WPKHError(`Failed to create transaction: ${error.message}`);
            }
            throw new P2WPKHError('Failed to create transaction: Unknown error');
        }
    }
} 