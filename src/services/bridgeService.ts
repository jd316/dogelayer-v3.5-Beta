import { ethers } from 'ethers';
import axios from 'axios';
import { DogeBridge } from '../types/contracts';
import { CircuitBreaker } from '../utils/circuitBreaker';

interface DogeTransaction {
  txid: string;
  amount: number;
  recipient: string;
  confirmations: number;
}

export class BridgeService {
  private provider: InstanceType<typeof ethers.JsonRpcProvider>;
  private bridge: DogeBridge;
  private minConfirmations: number;
  private circuitBreaker: CircuitBreaker;
  private readonly MAX_RETRIES = 3;
  private readonly RESET_TIMEOUT = 60000; // 1 minute

  constructor(
    providerUrl: string,
    bridgeAddress: string,
    bridgeAbi: any,
    minConfirmations: number = 6
  ) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.bridge = new ethers.Contract(
      bridgeAddress,
      bridgeAbi,
      this.provider
    ) as unknown as DogeBridge;
    this.minConfirmations = minConfirmations;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: this.RESET_TIMEOUT
    });
  }

  async monitorDogeTransactions() {
    const bitqueryEndpoint = 'https://graphql.bitquery.io';
    const query = `
      query ($network: BitcoinNetwork!, $limit: Int!, $offset: Int!) {
        bitcoin(network: $network) {
          transactions(
            options: {limit: $limit, offset: $offset}
            date: {since: null}
          ) {
            hash
            amount
            outputAddress
            confirmations
          }
        }
      }
    `;

    try {
      const response = await axios.post(
        bitqueryEndpoint,
        {
          query,
          variables: {
            network: 'dogecoin',
            limit: 100,
            offset: 0,
          },
        },
        {
          headers: {
            'X-API-KEY': process.env.BITQUERY_API_KEY,
          },
        }
      );

      const transactions = response.data.data.bitcoin.transactions;
      await this.processTransactions(transactions);
    } catch (error) {
      console.error('Error monitoring Dogecoin transactions:', error);
    }
  }

  private async processTransactions(transactions: DogeTransaction[]) {
    for (const tx of transactions) {
      if (tx.confirmations >= this.minConfirmations) {
        try {
          const depositId = ethers.id(tx.txid);
          const amount = ethers.parseEther(tx.amount.toString());
          
          // Check if deposit was already processed
          const isProcessed = await this.bridge.processedDeposits(depositId);
          if (!isProcessed) {
            // Process the deposit
            const signature = await this.signDeposit(depositId, tx.recipient, amount);
            await this.bridge.processDeposit(tx.recipient, amount, depositId, signature);
            console.log(`Processed deposit for tx: ${tx.txid}`);
          }
        } catch (error) {
          console.error(`Error processing transaction ${tx.txid}:`, error);
        }
      }
    }
  }

  private async signDeposit(
    depositId: string,
    recipient: string,
    amount: bigint
  ): Promise<string> {
    // Implementation of deposit signing logic
    // This would be done by the bridge operator's private key
    return '0x';
  }

  async startMonitoring(intervalMs: number = 60000) {
    setInterval(() => {
      this.monitorDogeTransactions();
    }, intervalMs);
  }

  async processDeposit(txHash: string, amount: string, recipient: string): Promise<boolean> {
    try {
      return await this.circuitBreaker.execute(async () => {
        let retries = 0;
        while (retries < this.MAX_RETRIES) {
          try {
            const tx = await this.bridge.deposit(txHash, amount, recipient);
            await tx.wait();
            return true;
          } catch (error) {
            retries++;
            if (retries === this.MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
        return false;
      });
    } catch (error) {
      console.error('Failed to process deposit:', error);
      return false;
    }
  }

  async processWithdrawal(recipient: string, amount: string): Promise<boolean> {
    try {
      return await this.circuitBreaker.execute(async () => {
        let retries = 0;
        while (retries < this.MAX_RETRIES) {
          try {
            const tx = await this.bridge.withdraw(recipient, amount);
            await tx.wait();
            return true;
          } catch (error) {
            retries++;
            if (retries === this.MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
        return false;
      });
    } catch (error) {
      console.error('Failed to process withdrawal:', error);
      return false;
    }
  }
} 