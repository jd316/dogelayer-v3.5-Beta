import { ethers } from 'ethers';
import { WithdrawalProcessor } from './WithdrawalProcessor';
import { DogeBridge } from '../../bridge/DogeBridge';

export class WithdrawalMonitor {
    private readonly bridge: DogeBridge;
    private readonly withdrawalProcessor: WithdrawalProcessor;
    private readonly provider: ethers.Provider;
    private isRunning: boolean = false;

    constructor(
        bridge: DogeBridge,
        withdrawalProcessor: WithdrawalProcessor,
        provider: ethers.Provider
    ) {
        this.bridge = bridge;
        this.withdrawalProcessor = withdrawalProcessor;
        this.provider = provider;
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        // Listen for Withdrawal events
        this.bridge.on('Withdrawal', async (sender, dogeAddress, amount, withdrawalId) => {
            try {
                await this.withdrawalProcessor.processWithdrawal({
                    sender,
                    dogeAddress,
                    amount: amount.toNumber(),
                    withdrawalId
                });
            } catch (error) {
                console.error('Error processing withdrawal:', error);
            }
        });

        // Listen for withdrawal confirmations
        this.withdrawalProcessor.on('withdrawal_processed', async (data) => {
            console.log('Withdrawal processed:', data);
            // Additional handling (e.g., update UI, notify user)
        });

        this.withdrawalProcessor.on('withdrawal_failed', async (data) => {
            console.error('Withdrawal failed:', data);
            // Handle failure (e.g., retry, notify admin)
        });
    }

    public stop(): void {
        this.isRunning = false;
        this.bridge.removeAllListeners('Withdrawal');
        this.withdrawalProcessor.removeAllListeners();
    }
} 