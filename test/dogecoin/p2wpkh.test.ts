import { DogecoinP2WPKH } from '../../src/services/dogecoin/scripts/p2wpkh';
import * as bitcoin from 'bitcoinjs-lib';

describe('DogecoinP2WPKH', () => {
  let p2wpkh: DogecoinP2WPKH;
  const testPrivateKey = 'QVG3yxHj5khGFEHUGZC6kWHHFtwqLkQqHXXHGGHJ4yBXXX'; // Test private key

  beforeEach(() => {
    p2wpkh = new DogecoinP2WPKH(testPrivateKey);
  });

  describe('Address Generation', () => {
    it('should generate valid Dogecoin SegWit address', () => {
      const address = p2wpkh.generateAddress();
      expect(address).toMatch(/^doge1[a-zA-Z0-9]{39,59}$/);
    });

    it('should generate different address with different private key', () => {
      const p2wpkh2 = new DogecoinP2WPKH();
      const address1 = p2wpkh.generateAddress();
      const address2 = p2wpkh2.generateAddress();
      expect(address1).not.toBe(address2);
    });
  });

  describe('Transaction Creation', () => {
    const mockUtxos = [
      { txid: '1234', vout: 0, value: 1000000 },
      { txid: '5678', vout: 1, value: 2000000 }
    ];

    it('should create valid transaction', async () => {
      const toAddress = 'doge1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const amount = 1500000;
      const fee = 100000;

      const txHex = await p2wpkh.createTransaction(mockUtxos, toAddress, amount, fee);
      expect(txHex).toBeTruthy();
      expect(typeof txHex).toBe('string');
    });

    it('should handle change output correctly', async () => {
      const toAddress = 'doge1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const amount = 500000;
      const fee = 100000;

      const txHex = await p2wpkh.createTransaction(mockUtxos, toAddress, amount, fee);
      const tx = bitcoin.Transaction.fromHex(txHex);
      expect(tx.outs.length).toBe(2); // One for recipient, one for change
    });

    it('should throw error if insufficient funds', async () => {
      const toAddress = 'doge1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const amount = 5000000; // More than available
      const fee = 100000;

      await expect(
        p2wpkh.createTransaction(mockUtxos, toAddress, amount, fee)
      ).rejects.toThrow();
    });
  });

  describe('Message Signing', () => {
    const testMessage = 'Test message for signing';

    it('should sign message and verify successfully', () => {
      const signature = p2wpkh.signMessage(testMessage);
      const publicKey = p2wpkh.getPublicKey();
      
      const isValid = p2wpkh.verifyMessage(testMessage, signature, publicKey);
      expect(isValid).toBe(true);
    });

    it('should fail verification with incorrect message', () => {
      const signature = p2wpkh.signMessage(testMessage);
      const publicKey = p2wpkh.getPublicKey();
      
      const isValid = p2wpkh.verifyMessage('Wrong message', signature, publicKey);
      expect(isValid).toBe(false);
    });

    it('should fail verification with incorrect signature', () => {
      const signature = 'invalid_signature';
      const publicKey = p2wpkh.getPublicKey();
      
      expect(() => {
        p2wpkh.verifyMessage(testMessage, signature, publicKey);
      }).toThrow();
    });
  });
}); 