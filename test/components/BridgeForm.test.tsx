import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BridgeForm } from '../../src/components/BridgeForm';
import { DogecoinService } from '../../src/utils/dogecoin';
import { getBridgeContract } from '../../src/utils/contracts';

// Mock the dependencies
jest.mock('../../src/utils/dogecoin');
jest.mock('../../src/utils/contracts');

describe('BridgeForm', () => {
  const mockAccount = '0x123...';
  const mockProvider = {
    getNetwork: jest.fn().mockResolvedValue({ chainId: 137 }) // Polygon Mainnet
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getBridgeContract as jest.Mock).mockReturnValue({
      depositFee: jest.fn().mockResolvedValue('1000000000000000000'),
      withdrawFee: jest.fn().mockResolvedValue('1000000000000000000'),
      requestWithdraw: jest.fn().mockResolvedValue({
        hash: '0x123',
        wait: jest.fn().mockResolvedValue(true)
      })
    });
  });

  it('renders without crashing', () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdraw')).toBeInTheDocument();
  });

  it('switches between deposit and withdraw modes', () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    // Initially in deposit mode
    expect(screen.queryByPlaceholderText('Enter Dogecoin address...')).not.toBeInTheDocument();
    
    // Switch to withdraw mode
    fireEvent.click(screen.getByText('Withdraw'));
    expect(screen.getByPlaceholderText('Enter Dogecoin address...')).toBeInTheDocument();
  });

  it('validates amount input', async () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    const amountInput = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(amountInput, { target: { value: '-1' } });
    
    const submitButton = screen.getByText('Generate Deposit Address');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid amount')).toBeInTheDocument();
    });
  });

  it('validates Dogecoin address in withdraw mode', async () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="withdraw" />);
    
    const addressInput = screen.getByPlaceholderText('Enter Dogecoin address...');
    fireEvent.change(addressInput, { target: { value: 'invalid-address' } });
    
    const amountInput = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    const submitButton = screen.getByText('Withdraw');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid Dogecoin address')).toBeInTheDocument();
    });
  });

  it('handles deposit flow correctly', async () => {
    const mockDepositAddress = 'DTest123...';
    (DogecoinService as jest.Mock).mockImplementation(() => ({
      generateDepositAddress: jest.fn().mockResolvedValue(mockDepositAddress),
      monitorDeposit: jest.fn().mockResolvedValue(6)
    }));

    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    const amountInput = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    const submitButton = screen.getByText('Generate Deposit Address');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(mockDepositAddress)).toBeInTheDocument();
      expect(screen.getByText('Deposit confirmed! Your wDOGE will be available shortly.')).toBeInTheDocument();
    });
  });

  it('handles withdraw flow correctly', async () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="withdraw" />);
    
    const addressInput = screen.getByPlaceholderText('Enter Dogecoin address...');
    fireEvent.change(addressInput, { target: { value: 'DBXu2kgc3xtvCUWFcxFE3r9hEYgmuaaCyD' } });
    
    const amountInput = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    const submitButton = screen.getByText('Withdraw');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Withdrawal confirmed! Please wait for processing.')).toBeInTheDocument();
      expect(screen.getByText('View on PolygonScan')).toBeInTheDocument();
    });
  });

  it('handles network errors', async () => {
    const mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }) // Ethereum Mainnet
    };

    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    await waitFor(() => {
      expect(screen.getByText('Please connect to Polygon Mainnet')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Generate Deposit Address');
    expect(submitButton).toBeDisabled();
  });

  it('handles API errors gracefully', async () => {
    (DogecoinService as jest.Mock).mockImplementation(() => ({
      generateDepositAddress: jest.fn().mockRejectedValue(new Error('API Error')),
      monitorDeposit: jest.fn().mockRejectedValue(new Error('API Error'))
    }));

    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    const amountInput = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    const submitButton = screen.getByText('Generate Deposit Address');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('shows loading state during transactions', async () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    const amountInput = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    const submitButton = screen.getByText('Generate Deposit Address');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });
}); 