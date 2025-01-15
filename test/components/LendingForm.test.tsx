import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LendingForm from '../../src/components/LendingForm';
import { ethers } from 'ethers';

describe('LendingForm', () => {
  const mockAccount = '0x1234...';
  const mockProvider = {
    getSigner: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(mockAccount),
    }),
  } as unknown as InstanceType<typeof ethers.BrowserProvider>;

  const mockLendingContract = {
    getLoanInfo: jest.fn().mockResolvedValue([
      BigInt('1000000000000000000'), // 1 wDOGE loan
      BigInt('1500000000000000000'), // 1.5 wDOGE collateral
      BigInt('50000000000000000'),   // 0.05 wDOGE interest
      BigInt('150'),                 // 150% collateral ratio
    ]),
    borrow: jest.fn().mockResolvedValue({
      wait: jest.fn().mockResolvedValue(true),
    }),
    repay: jest.fn().mockResolvedValue({
      wait: jest.fn().mockResolvedValue(true),
    }),
    addCollateral: jest.fn().mockResolvedValue({
      wait: jest.fn().mockResolvedValue(true),
    }),
  };

  const mockWDOGEContract = {
    approve: jest.fn().mockResolvedValue({
      wait: jest.fn().mockResolvedValue(true),
    }),
  };

  beforeEach(() => {
    jest.spyOn(ethers, 'Contract').mockImplementation((address: string) => {
      return address === process.env.NEXT_PUBLIC_LENDING_ADDRESS
        ? mockLendingContract
        : mockWDOGEContract;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render loan information', async () => {
    render(
      <LendingForm
        account={mockAccount}
        provider={mockProvider}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 wDOGE')).toBeInTheDocument(); // Loan amount
      expect(screen.getByText('1.5 wDOGE')).toBeInTheDocument(); // Collateral
      expect(screen.getByText('0.05 wDOGE')).toBeInTheDocument(); // Interest
      expect(screen.getByText('150%')).toBeInTheDocument(); // Collateral ratio
    });
  });

  describe('Borrowing', () => {
    beforeEach(() => {
      render(
        <LendingForm
          account={mockAccount}
          provider={mockProvider}
        />
      );
    });

    it('should handle borrowing tokens', async () => {
      fireEvent.change(screen.getByPlaceholderText('Enter amount to borrow/repay'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter collateral amount'), {
        target: { value: '150' },
      });
      fireEvent.click(screen.getByText('Borrow'));

      await waitFor(() => {
        expect(mockWDOGEContract.approve).toHaveBeenCalled();
        expect(mockLendingContract.borrow).toHaveBeenCalled();
      });
    });

    it('should disable borrow button when fields are empty', () => {
      expect(screen.getByText('Borrow')).toBeDisabled();
    });

    it('should handle borrowing error', async () => {
      mockLendingContract.borrow.mockRejectedValueOnce(new Error('Insufficient collateral'));

      fireEvent.change(screen.getByPlaceholderText('Enter amount to borrow/repay'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter collateral amount'), {
        target: { value: '150' },
      });
      fireEvent.click(screen.getByText('Borrow'));

      await waitFor(() => {
        expect(screen.getByText('Failed to borrow tokens')).toBeInTheDocument();
      });
    });
  });

  describe('Repayment', () => {
    beforeEach(() => {
      render(
        <LendingForm
          account={mockAccount}
          provider={mockProvider}
        />
      );
    });

    it('should handle repaying loan', async () => {
      fireEvent.change(screen.getByPlaceholderText('Enter amount to borrow/repay'), {
        target: { value: '100' },
      });
      fireEvent.click(screen.getByText('Repay'));

      await waitFor(() => {
        expect(mockWDOGEContract.approve).toHaveBeenCalled();
        expect(mockLendingContract.repay).toHaveBeenCalled();
      });
    });

    it('should disable repay button when amount is empty', () => {
      expect(screen.getByText('Repay')).toBeDisabled();
    });

    it('should handle repayment error', async () => {
      mockLendingContract.repay.mockRejectedValueOnce(new Error('Insufficient balance'));

      fireEvent.change(screen.getByPlaceholderText('Enter amount to borrow/repay'), {
        target: { value: '100' },
      });
      fireEvent.click(screen.getByText('Repay'));

      await waitFor(() => {
        expect(screen.getByText('Failed to repay loan')).toBeInTheDocument();
      });
    });
  });

  describe('Collateral Management', () => {
    beforeEach(() => {
      render(
        <LendingForm
          account={mockAccount}
          provider={mockProvider}
        />
      );
    });

    it('should handle adding collateral', async () => {
      fireEvent.change(screen.getByPlaceholderText('Enter collateral amount'), {
        target: { value: '100' },
      });
      fireEvent.click(screen.getByText('Add Collateral'));

      await waitFor(() => {
        expect(mockWDOGEContract.approve).toHaveBeenCalled();
        expect(mockLendingContract.addCollateral).toHaveBeenCalled();
      });
    });

    it('should disable add collateral button when amount is empty', () => {
      expect(screen.getByText('Add Collateral')).toBeDisabled();
    });

    it('should handle add collateral error', async () => {
      mockLendingContract.addCollateral.mockRejectedValueOnce(new Error('Transfer failed'));

      fireEvent.change(screen.getByPlaceholderText('Enter collateral amount'), {
        target: { value: '100' },
      });
      fireEvent.click(screen.getByText('Add Collateral'));

      await waitFor(() => {
        expect(screen.getByText('Failed to add collateral')).toBeInTheDocument();
      });
    });
  });

  describe('Warnings', () => {
    it('should show liquidation warning when collateral ratio is low', async () => {
      mockLendingContract.getLoanInfo.mockResolvedValueOnce([
        BigInt('1000000000000000000'), // 1 wDOGE loan
        BigInt('1200000000000000000'), // 1.2 wDOGE collateral
        BigInt('50000000000000000'),   // 0.05 wDOGE interest
        BigInt('120'),                 // 120% collateral ratio
      ]);

      render(
        <LendingForm
          account={mockAccount}
          provider={mockProvider}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Warning: Your collateral ratio is below 150%/)).toBeInTheDocument();
      });
    });
  });
}); 