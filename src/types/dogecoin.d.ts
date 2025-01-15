declare module '../services/dogecoin/scripts/p2pkh' {
  export class DogecoinP2PKH {
    constructor(privateKey?: string);
    generateAddress(): string;
    signMessage(message: string): string;
    verifyMessage(message: string, signature: string, publicKey: Buffer): boolean;
  }
}

declare module '../services/dogecoin/scripts/dogeMonitor' {
  export class DogeMonitor {
    constructor(privateKey?: string, minConfirmations?: number);
    generateDepositAddress(account: string, amount: number): Promise<string>;
    monitorTransactions(): Promise<void>;
    verifyTransaction(txid: string): Promise<boolean>;
    getMonitoredAddresses(): Array<string>;
    getHealthStatus(): {
      isHealthy: boolean;
      lastProcessedBlock: number;
      lastProcessedTime: number;
      errors: string[];
    };
  }
} 