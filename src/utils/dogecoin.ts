import { DogecoinP2PKH } from '../dogecoin/scripts/p2pkh';
import { DogeMonitor } from '../dogecoin/scripts/dogeMonitor';

export interface DogeTransaction {
  txid: string;
  vout: {
    value: number;
    scriptPubKey: {
      addresses: string[];
    };
  }[];
  confirmations: number;
}

export interface DepositInfo {
  address: string;
  amount: number;
  account: string;
}

export class DogecoinService {
  private p2pkh: DogecoinP2PKH;
  private depositMap: Map<string, DepositInfo>;
  private minConfirmations: number;
  private dogeMonitor: DogeMonitor;

  constructor(privateKey?: string, minConfirmations: number = 6) {
    this.p2pkh = new DogecoinP2PKH(privateKey);
    this.depositMap = new Map();
    this.minConfirmations = minConfirmations;
    this.dogeMonitor = new DogeMonitor();
  }

  async generateDepositAddress(account: string, amount: bigint): Promise<string> {
    return this.dogeMonitor.generateDepositAddress(account, Number(amount));
  }

  async verifyTransaction(txid: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/txs/${txid}`
      );
      const tx = await response.json();
      return tx.confirmations >= this.minConfirmations;
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return false;
    }
  }

  async getTransactionDetails(txid: string): Promise<DogeTransaction | null> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/txs/${txid}`
      );
      const tx = await response.json();
      return {
        txid: tx.hash,
        vout: tx.outputs.map((output: any) => ({
          value: output.value / 1e8, // Convert satoshis to DOGE
          scriptPubKey: {
            addresses: output.addresses,
          },
        })),
        confirmations: tx.confirmations,
      };
    } catch (error) {
      console.error('Error getting transaction details:', error);
      return null;
    }
  }

  async getAddressBalance(address: string): Promise<number> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/addrs/${address}/balance`
      );
      const data = await response.json();
      return data.balance / 1e8; // Convert satoshis to DOGE
    } catch (error) {
      console.error('Error getting address balance:', error);
      return 0;
    }
  }

  async getAddressTransactions(address: string): Promise<string[]> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/addrs/${address}/full`
      );
      const data = await response.json();
      return data.txs.map((tx: any) => tx.hash);
    } catch (error) {
      console.error('Error getting address transactions:', error);
      return [];
    }
  }

  getDepositInfo(address: string): DepositInfo | undefined {
    return this.depositMap.get(address);
  }

  getMonitoredAddresses(): string[] {
    return Array.from(this.depositMap.keys());
  }

  async monitorDeposit(address: string): Promise<number> {
    let confirmations = 0;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (confirmations < 6 && attempts < maxAttempts) {
      try {
        await this.dogeMonitor.monitorTransactions();
        const tx = await this.dogeMonitor.verifyTransaction(address);
        if (tx) {
          confirmations = 6;
          break;
        }
      } catch (error) {
        console.error('Error monitoring deposit:', error);
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    return confirmations;
  }
} 