import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';
import { getLendingContract, getWDOGEContract, validateAmount, formatUnits, parseUnits } from '../utils/contracts';

interface LendingFormProps {
  account: string;
  provider?: typeof ethers.BrowserProvider;
}

interface LendingContract extends Contract {
  getLoan(borrower: string): Promise<{
    amount: bigint;
    collateral: bigint;
    timestamp: bigint;
    interestPaid: bigint;
  }>;
  getCollateralRatio(borrower: string): Promise<bigint>;
  getInterestDue(borrower: string): Promise<bigint>;
  borrow(amount: string, collateralAmount: string): Promise<{
    wait(): Promise<any>;
  }>;
  repay(amount: string): Promise<{
    wait(): Promise<any>;
  }>;
  addCollateral(amount: string): Promise<{
    wait(): Promise<any>;
  }>;
  withdrawCollateral(amount: string): Promise<{
    wait(): Promise<any>;
  }>;
}

interface WDOGEContract extends Contract {
  balanceOf(account: string): Promise<bigint>;
  approve(spender: string, amount: string): Promise<{
    wait(): Promise<any>;
  }>;
}

export default function LendingForm({ account, provider }: LendingFormProps) {
  const [amount, setAmount] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loanInfo, setLoanInfo] = useState({
    loanAmount: '0',
    collateralAmount: '0',
    interestDue: '0',
    collateralRatio: '0',
    walletBalance: '0',
  });

  useEffect(() => {
    const fetchLoanInfo = async () => {
      if (!provider || !account) return;

      try {
        const { contract: lendingContract } = await getLendingContract(provider);
        const { contract: wdogeContract } = await getWDOGEContract(provider);
        const lending = lendingContract as LendingContract;
        const wdoge = wdogeContract as WDOGEContract;

        const [loan, collateralRatio, interestDue, walletBalance] = await Promise.all([
          lending.getLoan(account),
          lending.getCollateralRatio(account),
          lending.getInterestDue(account),
          wdoge.balanceOf(account),
        ]);

        setLoanInfo({
          loanAmount: formatUnits(loan.amount),
          collateralAmount: formatUnits(loan.collateral),
          interestDue: formatUnits(interestDue),
          collateralRatio: formatUnits(collateralRatio),
          walletBalance: formatUnits(walletBalance),
        });
      } catch (error) {
        console.error('Error fetching loan info:', error);
        setError('Failed to fetch loan information');
      }
    };

    fetchLoanInfo();
    const interval = setInterval(fetchLoanInfo, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, [provider, account]);

  const handleBorrow = async () => {
    if (!provider || !account || !validateAmount(amount) || !validateAmount(collateralAmount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: lendingContract, address: lendingAddress } = await getLendingContract(provider);
      const { contract: wdogeContract } = await getWDOGEContract(provider);
      const lending = lendingContract as LendingContract;
      const wdoge = wdogeContract as WDOGEContract;

      // Approve lending contract to spend wDOGE as collateral
      const approveTx = await wdoge.approve(lendingAddress, parseUnits(collateralAmount));
      await approveTx.wait();

      // Borrow wDOGE
      const borrowTx = await lending.borrow(parseUnits(amount), parseUnits(collateralAmount));
      await borrowTx.wait();

      setAmount('');
      setCollateralAmount('');
    } catch (error) {
      console.error('Error borrowing:', error);
      setError('Failed to borrow tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepay = async () => {
    if (!provider || !account || !validateAmount(amount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: lendingContract } = await getLendingContract(provider);
      const lending = lendingContract as LendingContract;

      const tx = await lending.repay(parseUnits(amount));
      await tx.wait();

      setAmount('');
    } catch (error) {
      console.error('Error repaying:', error);
      setError('Failed to repay loan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCollateral = async () => {
    if (!provider || !account || !validateAmount(collateralAmount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: lendingContract, address: lendingAddress } = await getLendingContract(provider);
      const { contract: wdogeContract } = await getWDOGEContract(provider);
      const lending = lendingContract as LendingContract;
      const wdoge = wdogeContract as WDOGEContract;

      // Approve lending contract to spend wDOGE
      const approveTx = await wdoge.approve(lendingAddress, parseUnits(collateralAmount));
      await approveTx.wait();

      // Add collateral
      const tx = await lending.addCollateral(parseUnits(collateralAmount));
      await tx.wait();

      setCollateralAmount('');
    } catch (error) {
      console.error('Error adding collateral:', error);
      setError('Failed to add collateral');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawCollateral = async () => {
    if (!provider || !account || !validateAmount(collateralAmount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: lendingContract } = await getLendingContract(provider);
      const lending = lendingContract as LendingContract;

      const tx = await lending.withdrawCollateral(parseUnits(collateralAmount));
      await tx.wait();

      setCollateralAmount('');
    } catch (error) {
      console.error('Error withdrawing collateral:', error);
      setError('Failed to withdraw collateral');
    } finally {
      setIsLoading(false);
    }
  };

  if (!provider) {
    return (
      <div className="text-center text-gray-500">
        Please connect your wallet to continue
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-900">Your Loan Info</h3>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Loan Amount:</dt>
              <dd className="text-sm font-medium">{loanInfo.loanAmount} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Collateral:</dt>
              <dd className="text-sm font-medium">{loanInfo.collateralAmount} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Interest Due:</dt>
              <dd className="text-sm font-medium">{loanInfo.interestDue} wDOGE</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-900">Account Info</h3>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Wallet Balance:</dt>
              <dd className="text-sm font-medium">{loanInfo.walletBalance} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Collateral Ratio:</dt>
              <dd className="text-sm font-medium">{loanInfo.collateralRatio}%</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Amount (wDOGE)
            </label>
            <div className="mt-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.00000001"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Collateral Amount (wDOGE)
            </label>
            <div className="mt-1">
              <input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                min="0"
                step="0.00000001"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Enter collateral amount"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <button
                onClick={handleBorrow}
                disabled={isLoading}
                className={`
                  w-full py-2 px-4 rounded-md text-white font-medium
                  ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}
                `}
              >
                {isLoading ? 'Processing...' : 'Borrow'}
              </button>

              <button
                onClick={handleRepay}
                disabled={isLoading}
                className={`
                  w-full py-2 px-4 rounded-md text-white font-medium
                  ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}
                `}
              >
                {isLoading ? 'Processing...' : 'Repay'}
              </button>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleAddCollateral}
                disabled={isLoading}
                className={`
                  w-full py-2 px-4 rounded-md text-white font-medium
                  ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}
                `}
              >
                {isLoading ? 'Processing...' : 'Add Collateral'}
              </button>

              <button
                onClick={handleWithdrawCollateral}
                disabled={isLoading}
                className={`
                  w-full py-2 px-4 rounded-md text-white font-medium
                  ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}
                `}
              >
                {isLoading ? 'Processing...' : 'Withdraw Collateral'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 