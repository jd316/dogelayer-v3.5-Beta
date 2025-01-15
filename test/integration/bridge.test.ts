import { expect } from 'chai';
import { ethers, BrowserProvider } from 'ethers';
import { DogecoinP2WPKH } from '../../src/services/dogecoin/scripts/p2wpkh';
import { DogeMonitor } from '../../src/services/dogeMonitor';
import { BridgeService } from '../../src/services/bridgeService';

// Mock contract addresses for testing
const MOCK_ADDRESSES = {
  BRIDGE: '0x1234567890123456789012345678901234567890',
  WDOGE: '0x0987654321098765432109876543210987654321'
};

interface WithdrawalRequest {
  amount: bigint;
  dogeAddress: string;
}

interface BridgeServiceInterface extends BridgeService {
  generateDepositAddress(userAddress: string, amount: bigint): Promise<string>;
  requestWithdrawal(amount: bigint, dogeAddress: string): Promise<void>;
  getWDOGEContract(): Promise<any>;
  getPendingWithdrawals(): Promise<WithdrawalRequest[]>;
}

interface DogeMonitorInterface extends DogeMonitor {
  processTransaction(tx: {
    txid: string;
    vout: Array<{
      value: number;
      scriptPubKey: {
        addresses: string[];
      };
    }>;
    confirmations: number;
  }): Promise<void>;
}

describe('Bridge Integration', () => {
  let dogeMonitor: DogeMonitorInterface;
  let bridgeService: BridgeServiceInterface;
  let p2wpkh: DogecoinP2WPKH;
  let provider: BrowserProvider;

  beforeEach(async () => {
    provider = new BrowserProvider(window.ethereum);
    p2wpkh = new DogecoinP2WPKH();
    dogeMonitor = new DogeMonitor() as unknown as DogeMonitorInterface;
    bridgeService = new BridgeService(
      provider as any,
      MOCK_ADDRESSES.BRIDGE,
      MOCK_ADDRESSES.WDOGE
    ) as unknown as BridgeServiceInterface;
  });

  describe('Deposit Flow', () => {
    it('should process deposit and mint tokens', async () => {
      // Generate deposit address
      const depositAmount = BigInt(100_000_000_000); // 100 DOGE
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const depositAddress = await bridgeService.generateDepositAddress(userAddress, depositAmount);

      // Simulate Dogecoin transaction
      const mockTxHash = '1234567890abcdef';
      const mockTx = {
        txid: mockTxHash,
        vout: [{
          value: 100,
          scriptPubKey: {
            addresses: [depositAddress]
          }
        }],
        confirmations: 10
      };

      // Monitor should detect transaction
      await dogeMonitor.processTransaction(mockTx);
      
      // Verify WDOGE tokens were minted
      const wdogeContract = await bridgeService.getWDOGEContract();
      const balance = await wdogeContract.balanceOf(userAddress);
      expect(balance.toString()).to.equal(depositAmount.toString());
    });

    it('should reject deposit with insufficient confirmations', async () => {
      const depositAmount = BigInt(100_000_000_000);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const depositAddress = await bridgeService.generateDepositAddress(userAddress, depositAmount);

      const mockTx = {
        txid: '1234567890abcdef',
        vout: [{
          value: 100,
          scriptPubKey: {
            addresses: [depositAddress]
          }
        }],
        confirmations: 2 // Too few confirmations
      };

      await dogeMonitor.processTransaction(mockTx);
      
      const wdogeContract = await bridgeService.getWDOGEContract();
      const balance = await wdogeContract.balanceOf(userAddress);
      expect(balance.toString()).to.equal('0');
    });
  });

  describe('Withdrawal Flow', () => {
    it('should process withdrawal request', async () => {
      const withdrawAmount = BigInt(50_000_000_000);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const dogeAddress = p2wpkh.generateAddress();

      // Request withdrawal
      await bridgeService.requestWithdrawal(withdrawAmount, dogeAddress);

      // Verify WDOGE tokens were burned
      const wdogeContract = await bridgeService.getWDOGEContract();
      const balance = await wdogeContract.balanceOf(userAddress);
      expect(balance.toString()).to.equal('0');

      // Verify withdrawal request was recorded
      const requests = await bridgeService.getPendingWithdrawals();
      const request = requests.find(req => 
        req.amount.toString() === withdrawAmount.toString() &&
        req.dogeAddress === dogeAddress
      );
      expect(request).to.exist;
    });

    it('should reject withdrawal exceeding balance', async () => {
      const withdrawAmount = BigInt(1000_000_000_000); // More than available
      const dogeAddress = p2wpkh.generateAddress();

      await expect(
        bridgeService.requestWithdrawal(withdrawAmount, dogeAddress)
      ).to.be.revertedWith('Insufficient balance');
    });
  });
}); 