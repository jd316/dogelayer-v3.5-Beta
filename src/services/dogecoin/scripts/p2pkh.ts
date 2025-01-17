import { payments, Network } from 'bitcoinjs-lib';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc as any);

export const DOGECOIN_NETWORK: Network = {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    bip32: {
        public: 0x02facafd,
        private: 0x02fac398,
    },
    pubKeyHash: 0x1e, // This gives us the 'D' prefix for legacy addresses
    scriptHash: 0x16,
    wif: 0x9e,
};

export class DogecoinP2PKH {
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
            const { address } = payments.p2pkh({
                pubkey: this.keypair.publicKey,
                network: DOGECOIN_NETWORK,
            });
            
            if (!address) {
                throw new Error('Failed to generate address');
            }
            
            this.address = address;
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Failed to initialize P2PKH: ${error.message}`);
            }
            throw new Error('Failed to initialize P2PKH: Unknown error');
        }
    }

    generateAddress(): string {
        return this.address;
    }

    signMessage(message: string): string {
        try {
            const messageBuffer = Buffer.from(message);
            const signature = this.keypair.sign(messageBuffer);
            return signature.toString('hex');
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Failed to sign message: ${error.message}`);
            }
            throw new Error('Failed to sign message: Unknown error');
        }
    }

    verifyMessage(message: string, signature: string, publicKey: Buffer): boolean {
        try {
            const messageBuffer = Buffer.from(message);
            const signatureBuffer = Buffer.from(signature, 'hex');
            return ECPair.fromPublicKey(publicKey).verify(messageBuffer, signatureBuffer);
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Failed to verify message: ${error.message}`);
            }
            throw new Error('Failed to verify message: Unknown error');
        }
    }
} 