import { DepositMonitor } from '../dogecoin/monitor/DepositMonitor';
import { WDOGEContract } from '../wdoge/WDOGEContract';
import { AddressManager } from '../dogecoin/address/AddressManager';
import { EventEmitter } from 'events';
import { Provider } from '@ethersproject/providers';
import { WithdrawalProcessor } from '../dogecoin/withdrawal/WithdrawalProcessor';
import { WithdrawalMonitor } from '../dogecoin/withdrawal/WithdrawalMonitor';
import { DogecoinP2WPKH } from '../dogecoin/scripts/p2wpkh';

interface BridgeConfig {
    rpcUrl: string;
    rpcUser: string;
    rpcPassword: string;
    wdogeContractAddress: string;
    requiredConfirmations: number;
    provider: Provider;
}

interface BridgeEvent {
    type: 'deposit' | 'mint' | 'error';
    data: any;
}

interface DepositEventData {
    txid: string;
    address: string;
    amount: number;
    confirmations: number;
}

export class DogeBridge extends EventEmitter {
    private depositMonitor: DepositMonitor;
    private wdogeContract: WDOGEContract;
    private addressManager: AddressManager;
    private processedTxs: Set<string> = new Set();
    private readonly withdrawalProcessor: WithdrawalProcessor;
    private readonly withdrawalMonitor: WithdrawalMonitor;

    constructor(
        config: BridgeConfig,
        wdogeContract: WDOGEContract,
        withdrawalPrivateKey: string
    ) {
        super();
        this.depositMonitor = new DepositMonitor(
            config.rpcUrl,
            config.rpcUser,
            config.rpcPassword
        );
        this.wdogeContract = wdogeContract;
        this.addressManager = new AddressManager();

        // Set up deposit monitoring
        this.depositMonitor.on('deposit', async (event: DepositEventData) => {
            try {
                await this.handleDeposit(event);
            } catch (error) {
                console.error('Error handling deposit:', error);
                this.emit('error', { type: 'deposit_processing', error });
            }
        });

        // Set up WDOGE contract events
        this.wdogeContract.onMint((to, amount) => {
            this.emit('mint', { to, amount });
        });

        // Initialize withdrawal components
        this.withdrawalProcessor = new WithdrawalProcessor(
            withdrawalPrivateKey,
            config.rpcUrl,
            config.rpcUser,
            config.rpcPassword
        );

        this.withdrawalMonitor = new WithdrawalMonitor(
            this,
            this.withdrawalProcessor,
            config.provider
        );
    }

    public generateDepositAddress(userId: string): string {
        const address = this.addressManager.generateDepositAddress(userId);
        this.depositMonitor.watchAddress(address);
        return address;
    }

    private async handleDeposit(event: DepositEventData): Promise<void> {
        // Check if we've already processed this transaction
        if (this.processedTxs.has(event.txid)) {
            return;
        }

        // Get address details
        const details = this.addressManager.getAddressDetails(event.address);
        if (!details) {
            throw new Error(`Unknown deposit address: ${event.address}`);
        }

        try {
            // Mint WDOGE tokens
            const tx = await this.wdogeContract.mint(details.userId, event.amount);
            await tx.wait(); // Wait for transaction confirmation

            // Mark transaction as processed
            this.processedTxs.add(event.txid);

            // Update address balance
            this.addressManager.updateBalance(
                event.address,
                details.balance + event.amount
            );

            // Emit success event
            this.emit('deposit', {
                txid: event.txid,
                address: event.address,
                userId: details.userId,
                amount: event.amount,
                mintTxHash: tx.hash
            });
        } catch (error) {
            console.error('Error minting WDOGE:', error);
            throw error;
        }
    }

    public getUserAddresses(userId: string): string[] {
        return this.addressManager.getUserAddresses(userId);
    }

    public getAddressDetails(address: string): any {
        return this.addressManager.getAddressDetails(address);
    }

    public async start(): Promise<void> {
        await this.withdrawalMonitor.start();
    }

    public async stop(): Promise<void> {
        this.depositMonitor.stop();
        this.withdrawalMonitor.stop();
        // Clean up any other resources
    }
} 