import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';
import { getStakingContract, getWDOGEContract, validateAmount, formatUnits, parseUnits } from '../utils/contracts';

interface StakingFormProps {
  account: string;
  provider?: typeof ethers.BrowserProvider;
}

interface StakingContract extends Contract {
  balanceOf(account: string): Promise<bigint>;
  getRewards(account: string): Promise<bigint>;
  rewardRate(): Promise<bigint>;
  totalStaked(): Promise<bigint>;
  stake(amount: string): Promise<{
    wait(): Promise<any>;
  }>;
  unstake(amount: string): Promise<{
    wait(): Promise<any>;
  }>;
  claimRewards(): Promise<{
    wait(): Promise<any>;
  }>;
}

interface WDOGEContract extends Contract {
  balanceOf(account: string): Promise<bigint>;
  approve(spender: string, amount: string): Promise<{
    wait(): Promise<any>;
  }>;
}

export default function StakingForm({ account, provider }: StakingFormProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stakingInfo, setStakingInfo] = useState({
    stakedBalance: '0',
    pendingRewards: '0',
    apy: '0',
    totalStaked: '0',
    walletBalance: '0',
  });

  useEffect(() => {
    const fetchStakingInfo = async () => {
      if (!provider || !account) return;

      try {
        const { contract: stakingContract } = await getStakingContract(provider);
        const { contract: wdogeContract } = await getWDOGEContract(provider);
        const staking = stakingContract as StakingContract;
        const wdoge = wdogeContract as WDOGEContract;

        const [stakedBalance, pendingRewards, rewardRate, totalStaked, walletBalance] = await Promise.all([
          staking.balanceOf(account),
          staking.getRewards(account),
          staking.rewardRate(),
          staking.totalStaked(),
          wdoge.balanceOf(account),
        ]);

        // Calculate APY: (rewardRate * 365 days * 100) / totalStaked
        const apy = totalStaked > 0n
          ? (rewardRate * 365n * 100n * 10000n) / totalStaked
          : 0n;

        setStakingInfo({
          stakedBalance: formatUnits(stakedBalance),
          pendingRewards: formatUnits(pendingRewards),
          apy: (Number(apy) / 100).toFixed(2),
          totalStaked: formatUnits(totalStaked),
          walletBalance: formatUnits(walletBalance),
        });
      } catch (error) {
        console.error('Error fetching staking info:', error);
        setError('Failed to fetch staking information');
      }
    };

    fetchStakingInfo();
    const interval = setInterval(fetchStakingInfo, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, [provider, account]);

  const handleStake = async () => {
    if (!provider || !account || !validateAmount(amount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: stakingContract, address: stakingAddress } = await getStakingContract(provider);
      const { contract: wdogeContract } = await getWDOGEContract(provider);
      const staking = stakingContract as StakingContract;
      const wdoge = wdogeContract as WDOGEContract;

      // Approve staking contract to spend wDOGE
      const approveTx = await wdoge.approve(stakingAddress, parseUnits(amount));
      await approveTx.wait();

      // Stake wDOGE
      const stakeTx = await staking.stake(parseUnits(amount));
      await stakeTx.wait();

      setAmount('');
    } catch (error) {
      console.error('Error staking:', error);
      setError('Failed to stake tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!provider || !account || !validateAmount(amount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: stakingContract } = await getStakingContract(provider);
      const staking = stakingContract as StakingContract;

      const tx = await staking.unstake(parseUnits(amount));
      await tx.wait();

      setAmount('');
    } catch (error) {
      console.error('Error unstaking:', error);
      setError('Failed to unstake tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!provider || !account) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: stakingContract } = await getStakingContract(provider);
      const staking = stakingContract as StakingContract;

      const tx = await staking.claimRewards();
      await tx.wait();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      setError('Failed to claim rewards');
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
          <h3 className="text-sm font-medium text-gray-900">Your Staking Info</h3>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Staked Balance:</dt>
              <dd className="text-sm font-medium">{stakingInfo.stakedBalance} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Wallet Balance:</dt>
              <dd className="text-sm font-medium">{stakingInfo.walletBalance} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Pending Rewards:</dt>
              <dd className="text-sm font-medium">{stakingInfo.pendingRewards} wDOGE</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-900">Pool Info</h3>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Total Staked:</dt>
              <dd className="text-sm font-medium">{stakingInfo.totalStaked} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">APY:</dt>
              <dd className="text-sm font-medium">{stakingInfo.apy}%</dd>
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

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={handleStake}
              disabled={isLoading}
              className={`
                py-2 px-4 rounded-md text-white font-medium
                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}
              `}
            >
              {isLoading ? 'Processing...' : 'Stake'}
            </button>

            <button
              onClick={handleUnstake}
              disabled={isLoading}
              className={`
                py-2 px-4 rounded-md text-white font-medium
                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}
              `}
            >
              {isLoading ? 'Processing...' : 'Unstake'}
            </button>

            <button
              onClick={handleClaimRewards}
              disabled={isLoading || Number(stakingInfo.pendingRewards) === 0}
              className={`
                py-2 px-4 rounded-md text-white font-medium
                ${isLoading || Number(stakingInfo.pendingRewards) === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
                }
              `}
            >
              {isLoading ? 'Processing...' : 'Claim Rewards'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 