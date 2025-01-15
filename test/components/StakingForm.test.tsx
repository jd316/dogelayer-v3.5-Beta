import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StakingForm from '../../src/components/StakingForm';
import { ethers } from 'ethers';

// Mock contract interactions
jest.mock('../../src/utils/contracts', () => ({
    getStakingContract: jest.fn(() => ({
        stake: jest.fn(),
        unstake: jest.fn(),
        claimRewards: jest.fn(),
        getStakeInfo: jest.fn(() => [
            ethers.parseEther('100'),
            ethers.parseEther('5')
        ])
    })),
    getWDOGEContract: jest.fn(() => ({
        approve: jest.fn(),
        balanceOf: jest.fn(() => ethers.parseEther('1000'))
    }))
}));

describe('StakingForm', () => {
    const mockAccount = '0x123...';
    const mockProvider = {
        getNetwork: jest.fn().mockResolvedValue({ chainId: 137 }),
        getSigner: jest.fn().mockResolvedValue({
            getAddress: jest.fn().mockResolvedValue(mockAccount)
        })
    } as unknown as typeof ethers.BrowserProvider;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders staking form correctly', () => {
        render(<StakingForm account={mockAccount} provider={mockProvider} />);

        expect(screen.getByText('Stake wDOGE')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter amount to stake')).toBeInTheDocument();
        expect(screen.getByText('Stake')).toBeInTheDocument();
    });

    it('displays staking info', async () => {
        render(<StakingForm account={mockAccount} provider={mockProvider} />);

        await waitFor(() => {
            expect(screen.getByText('Staked Balance:')).toBeInTheDocument();
            expect(screen.getByText('100.0 wDOGE')).toBeInTheDocument();
            expect(screen.getByText('Pending Rewards:')).toBeInTheDocument();
            expect(screen.getByText('5.0 wDOGE')).toBeInTheDocument();
        });
    });

    it('handles staking submission', async () => {
        render(<StakingForm account={mockAccount} provider={mockProvider} />);

        const amountInput = screen.getByPlaceholderText('Enter amount to stake');
        fireEvent.change(amountInput, { target: { value: '50' } });

        const stakeButton = screen.getByText('Stake');
        fireEvent.click(stakeButton);

        await waitFor(() => {
            expect(screen.getByText('Transaction pending...')).toBeInTheDocument();
        });
    });

    it('handles unstaking', async () => {
        render(<StakingForm account={mockAccount} provider={mockProvider} />);

        const unstakeButton = screen.getByText('Unstake');
        fireEvent.click(unstakeButton);

        await waitFor(() => {
            expect(screen.getByText('Transaction pending...')).toBeInTheDocument();
        });
    });

    it('handles claiming rewards', async () => {
        render(<StakingForm account={mockAccount} provider={mockProvider} />);

        const claimButton = screen.getByText('Claim Rewards');
        fireEvent.click(claimButton);

        await waitFor(() => {
            expect(screen.getByText('Transaction pending...')).toBeInTheDocument();
        });
    });

    it('validates input amount', () => {
        render(<StakingForm account={mockAccount} provider={mockProvider} />);

        const amountInput = screen.getByPlaceholderText('Enter amount to stake');
        const stakeButton = screen.getByText('Stake');

        // Test invalid input
        fireEvent.change(amountInput, { target: { value: '-50' } });
        expect(stakeButton).toBeDisabled();

        // Test valid input
        fireEvent.change(amountInput, { target: { value: '50' } });
        expect(stakeButton).not.toBeDisabled();
    });
}); 