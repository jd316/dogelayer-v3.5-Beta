import axios, { AxiosError } from 'axios';
import { DogecoinP2WPKH } from './dogecoin/scripts/p2wpkh';
import { ethers } from 'ethers';
import { sleep } from '../utils/helpers';

interface DogeTransaction {
  txid: string;
  vout: {
    value: number;
    scriptPubKey: {
      addresses: string[];
    };
  }[];
  confirmations: number;
}

interface HealthStatus {
  isHealthy: boolean;
  successRate: number;
  averageResponseTime: number;
  errorCount: number;
}

interface Transaction {
  txid: string;
  confirmations: number;
  timestamp: number;
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}

export class DogeMonitor {
  private addressMap: Map<string, { account: string; amount: number }>;
  private p2wpkh: DogecoinP2WPKH;
  private minConfirmations: number;
  private lastProcessedBlock: number = 0;
  private lastProcessedTime: number = 0;
  private errors: string[] = [];
  private maxErrorsStored: number = 10;
  private lastCheck: number = 0;
  private recentTransactions: Transaction[] = [];
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000
  };

  constructor(privateKey?: string, minConfirmations: number = 6) {
    this.addressMap = new Map();
    this.p2wpkh = new DogecoinP2WPKH(privateKey);
    this.minConfirmations = minConfirmations;
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customConfig };
    let lastError: Error | null = null;
    let delay = config.initialDelay;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt === config.maxRetries) break;

        // Exponential backoff with jitter
        const jitter = Math.random() * 200;
        await sleep(Math.min(delay + jitter, config.maxDelay));
        delay *= 2;

        this.logError(new Error(`Retry attempt ${attempt} failed: ${lastError.message}`));
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  async generateDepositAddress(account: string, amount: number): Promise<string> {
    return this.withRetry(async () => {
      const address = this.p2wpkh.generateAddress();
      this.addressMap.set(address, { account, amount });
      return address;
    });
  }

  async monitorTransactions(): Promise<void> {
    const query = `
      query ($network: BitcoinNetwork!, $addresses: [String!]!) {
        bitcoin(network: $network) {
          outputs(
            options: {limit: 100}
            date: {since: null}
            outputAddress: {in: $addresses}
          ) {
            outputAddress
            value
            outputDirection
            transaction {
              hash
              confirmations
              block {
                height
              }
            }
          }
        }
      }
    `;

    return this.withRetry(async () => {
      const addresses = Array.from(this.addressMap.keys());
      if (addresses.length === 0) return;

      const response = await axios.post(
        'https://graphql.bitquery.io',
        {
          query,
          variables: {
            network: 'dogecoin',
            addresses,
          },
        },
        {
          headers: {
            'X-API-KEY': process.env.BITQUERY_API_KEY,
          },
        }
      );

      const outputs = response.data.data.bitcoin.outputs;
      await this.processTransactions(outputs);
    }, {
      maxRetries: 5,
      initialDelay: 2000
    });
  }

  private async processTransactions(outputs: any[]): Promise<void> {
    try {
      for (const output of outputs) {
        const address = output.outputAddress;
        const deposit = this.addressMap.get(address);

        if (!deposit) continue;

        if (output.transaction.confirmations >= this.minConfirmations) {
          const expectedAmount = deposit.amount;
          const receivedAmount = output.value;

          if (receivedAmount >= expectedAmount) {
            // Emit event or callback for successful deposit
            console.log(`Deposit confirmed for ${deposit.account}: ${receivedAmount} DOGE`);
            
            // Remove the address from monitoring
            this.addressMap.delete(address);
          } else {
            this.logError(new Error(
              `Received amount (${receivedAmount}) is less than expected (${expectedAmount}) for address ${address}`
            ));
          }
        }
      }
      this.lastProcessedTime = Date.now();
      this.lastProcessedBlock = outputs[0]?.transaction?.block?.height || this.lastProcessedBlock;
    } catch (error) {
      this.logError(error as Error);
      throw error;
    }
  }

  async verifyTransaction(txid: string): Promise<boolean> {
    return this.withRetry(async () => {
      const response = await axios.get(
        `https://api.blockcypher.com/v1/doge/main/txs/${txid}`
      );

      const tx = response.data;
      return tx.confirmations >= this.minConfirmations;
    });
  }

  getMonitoredAddresses(): Array<string> {
    return Array.from(this.addressMap.keys());
  }

  private logError(error: Error): void {
    const timestamp = new Date().toISOString();
    const errorMessage = `${timestamp}: ${error.message}`;
    this.errors.unshift(errorMessage);
    
    if (this.errors.length > this.maxErrorsStored) {
      this.errors.pop();
    }

    // Log to external monitoring service if available
    if (process.env.MONITORING_ENDPOINT) {
      this.withRetry(() => 
        axios.post(process.env.MONITORING_ENDPOINT!, {
          service: 'DogeMonitor',
          error: errorMessage,
          timestamp
        })
      ).catch(console.error); // Don't wait for the request
    }

    console.error(errorMessage);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const now = Date.now();
      const recentTransactions = await this.getRecentTransactions();
      const successfulTxs = recentTransactions.filter(tx => tx.confirmations >= this.minConfirmations);
      
      const status = {
        isHealthy: true,
        successRate: recentTransactions.length > 0 
          ? (successfulTxs.length / recentTransactions.length) * 100
          : 100,
        averageResponseTime: now - this.lastCheck,
        errorCount: this.errors.length
      };

      // Update last check time
      this.lastCheck = now;

      return status;
    } catch (error) {
      console.error('Error getting health status:', error);
      return {
        isHealthy: false,
        successRate: 0,
        averageResponseTime: 0,
        errorCount: this.errors.length + 1
      };
    }
  }

  private async getRecentTransactions(): Promise<Transaction[]> {
    return this.withRetry(async () => {
      const addresses = Array.from(this.addressMap.keys());
      if (addresses.length === 0) return this.recentTransactions;

      const response = await axios.post(
        'https://graphql.bitquery.io',
        {
          query: `
            query ($network: BitcoinNetwork!, $addresses: [String!]!) {
              bitcoin(network: $network) {
                outputs(
                  options: {limit: 100}
                  date: {since: null}
                  outputAddress: {in: $addresses}
                ) {
                  transaction {
                    hash
                    confirmations
                    timestamp
                  }
                }
              }
            }
          `,
          variables: {
            network: 'dogecoin',
            addresses,
          },
        },
        {
          headers: {
            'X-API-KEY': process.env.BITQUERY_API_KEY,
          },
        }
      );

      const outputs = response.data.data.bitcoin.outputs;
      this.recentTransactions = outputs.map((output: any) => ({
        txid: output.transaction.hash,
        confirmations: output.transaction.confirmations,
        timestamp: output.transaction.timestamp
      }));

      return this.recentTransactions;
    });
  }
} 