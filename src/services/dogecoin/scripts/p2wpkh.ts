import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { payments, Psbt } from 'bitcoinjs-lib';

const ECPair = ECPairFactory(ecc);

const DOGECOIN_NETWORK = {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    bip32: {
        public: 0x02facafd,
        private: 0x02fac398,
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
};

export class DogecoinP2WPKH {
    private keyPair: bitcoin.ECPairInterface;

    constructor(privateKey?: string) {
        if (privateKey) {
            this.keyPair = ECPair.fromWIF(privateKey, DOGECOIN_NETWORK);
        } else {
            this.keyPair = ECPair.makeRandom({ network: DOGECOIN_NETWORK });
        }
    }

    generateAddress(): string {
        const { address } = payments.p2wpkh({
            pubkey: this.keyPair.publicKey,
            network: DOGECOIN_NETWORK,
        });
        return address!;
    }

    async createTransaction(
        utxos: Array<{ txid: string; vout: number; value: number }>,
        toAddress: string,
        amount: number,
        fee: number
    ): Promise<string> {
        const psbt = new Psbt({ network: DOGECOIN_NETWORK });
        
        // Add inputs
        for (const utxo of utxos) {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: payments.p2wpkh({
                        pubkey: this.keyPair.publicKey,
                        network: DOGECOIN_NETWORK,
                    }).output!,
                    value: utxo.value,
                },
            });
        }

        // Add output for recipient
        psbt.addOutput({
            address: toAddress,
            value: amount,
        });

        // Add change output if necessary
        const totalInput = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
        const change = totalInput - amount - fee;
        if (change > 0) {
            psbt.addOutput({
                address: this.generateAddress(),
                value: change,
            });
        }

        // Sign all inputs
        for (let i = 0; i < utxos.length; i++) {
            psbt.signInput(i, this.keyPair);
        }

        psbt.finalizeAllInputs();
        return psbt.extractTransaction().toHex();
    }

    getPublicKey(): Buffer {
        return this.keyPair.publicKey;
    }

    signMessage(message: string): string {
        const messagePrefix = Buffer.from(DOGECOIN_NETWORK.messagePrefix);
        const messageBuffer = Buffer.from(message);
        const lengthBuffer = Buffer.from(new Uint8Array([messageBuffer.length]));
        const messageToSign = Buffer.concat([messagePrefix, lengthBuffer, messageBuffer]);
        
        const hash = bitcoin.crypto.hash256(messageToSign);
        const signature = this.keyPair.sign(hash);
        return signature.toString('base64');
    }

    verifyMessage(message: string, signature: string, publicKey: Buffer): boolean {
        const messagePrefix = Buffer.from(DOGECOIN_NETWORK.messagePrefix);
        const messageBuffer = Buffer.from(message);
        const lengthBuffer = Buffer.from(new Uint8Array([messageBuffer.length]));
        const messageToVerify = Buffer.concat([messagePrefix, lengthBuffer, messageBuffer]);
        
        const hash = bitcoin.crypto.hash256(messageToVerify);
        const signatureBuffer = Buffer.from(signature, 'base64');
        
        return ECPair.fromPublicKey(publicKey).verify(hash, signatureBuffer);
    }
} 