import { expect } from "chai";
import { DogecoinP2WPKH } from "../../src/services/dogecoin/scripts/p2wpkh";

describe("DogecoinP2WPKH", function () {
  const testPrivateKey = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1";

  describe("Address Generation", function () {
    it("should generate valid Dogecoin SegWit address", function () {
      const dogecoin = new DogecoinP2WPKH(testPrivateKey);
      const address = dogecoin.getAddress();
      expect(address).to.match(/^doge1[a-zA-Z0-9]{39,59}$/);
    });

    it("should generate different address with different private key", function () {
      const differentKey = "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2";
      const dogecoin1 = new DogecoinP2WPKH(testPrivateKey);
      const dogecoin2 = new DogecoinP2WPKH(differentKey);
      expect(dogecoin1.getAddress()).to.not.equal(dogecoin2.getAddress());
    });

    it("should throw error with invalid private key", function () {
      expect(() => new DogecoinP2WPKH("invalid_key")).to.throw();
    });
  });

  describe("Transaction Creation", function () {
    let dogecoin: DogecoinP2WPKH;
    const mockUtxos = [
      {
        txid: "1234567890123456789012345678901234567890123456789012345678901234",
        vout: 0,
        value: 1000000000, // 10 DOGE
        confirmations: 6
      }
    ];

    beforeEach(function () {
      dogecoin = new DogecoinP2WPKH(testPrivateKey);
    });

    it("should create valid transaction", async function () {
      const tx = await dogecoin.createTransaction(
        mockUtxos,
        "doge1qf8knqh3m4bwxkqthqhj6t9qk3tcm3v9pjz0jn",
        500000000, // 5 DOGE
        100000 // 0.001 DOGE fee
      );

      expect(tx).to.be.a("string");
      expect(tx).to.match(/^[0-9a-f]+$/i);
    });

    it("should handle change output correctly", async function () {
      const tx = await dogecoin.createTransaction(
        mockUtxos,
        "doge1qf8knqh3m4bwxkqthqhj6t9qk3tcm3v9pjz0jn",
        900000000, // 9 DOGE
        100000 // 0.001 DOGE fee
      );

      expect(tx).to.be.a("string");
      expect(tx).to.match(/^[0-9a-f]+$/i);
    });

    it("should handle dust threshold correctly", async function () {
      const dustThreshold = 546; // Minimum amount in satoshis
      const testAmounts = [
        dustThreshold - 1,
        dustThreshold,
        dustThreshold + 1
      ];

      for (const amount of testAmounts) {
        if (amount < dustThreshold) {
          await expect(dogecoin.createTransaction(
            mockUtxos,
            "doge1qf8knqh3m4bwxkqthqhj6t9qk3tcm3v9pjz0jn",
            amount,
            100000
          )).to.be.rejectedWith(/dust/i);
        } else {
          await expect(dogecoin.createTransaction(
            mockUtxos,
            "doge1qf8knqh3m4bwxkqthqhj6t9qk3tcm3v9pjz0jn",
            amount,
            100000
          )).to.not.be.rejected;
        }
      }
    });

    it("should throw error for insufficient funds", async function () {
      await expect(dogecoin.createTransaction(
        mockUtxos,
        "doge1qf8knqh3m4bwxkqthqhj6t9qk3tcm3v9pjz0jn",
        2000000000, // 20 DOGE
        100000
      )).to.be.rejectedWith(/insufficient/i);
    });

    it("should throw error for invalid address", async function () {
      await expect(dogecoin.createTransaction(
        mockUtxos,
        "invalid_address",
        500000000,
        100000
      )).to.be.rejectedWith(/invalid.*address/i);
    });

    it("should throw error for amount below dust", async function () {
      await expect(dogecoin.createTransaction(
        mockUtxos,
        "doge1qf8knqh3m4bwxkqthqhj6t9qk3tcm3v9pjz0jn",
        100, // 0.000001 DOGE
        100000
      )).to.be.rejectedWith(/dust/i);
    });
  });
}); 