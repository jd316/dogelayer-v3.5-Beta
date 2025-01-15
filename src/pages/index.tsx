import { useState } from 'react';
import BridgeForm from '../components/BridgeForm';
import StakingForm from '../components/StakingForm';
import LendingForm from '../components/LendingForm';
import Layout from '../components/Layout';
import { useWeb3 } from '../contexts/Web3Context';

export default function Home() {
  const { account, provider, isConnecting, error, connectWallet } = useWeb3();
  const [activeTab, setActiveTab] = useState<'bridge' | 'stake' | 'lend'>('bridge');

  return (
    <Layout>
      <div className="flex justify-end mb-4">
        {error && (
          <p className="text-red-500 mr-4">{error}</p>
        )}
        {account ? (
          <span className="text-sm text-gray-700">
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </span>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className={`
              bg-blue-500 text-white px-4 py-2 rounded
              ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}
            `}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>

      <div className="mb-8">
        <div className="sm:hidden">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as 'bridge' | 'stake' | 'lend')}
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            aria-label="Select tab"
          >
            <option value="bridge">Bridge</option>
            <option value="stake">Stake</option>
            <option value="lend">Lend</option>
          </select>
        </div>
        <div className="hidden sm:block">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {['bridge', 'stake', 'lend'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as 'bridge' | 'stake' | 'lend')}
                  className={`
                    ${activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
                  `}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-6">
          {activeTab === 'bridge' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Bridge DOGE to/from Polygon</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium mb-2">Deposit DOGE</h3>
                  <BridgeForm type="deposit" account={account} provider={provider} />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Withdraw DOGE</h3>
                  <BridgeForm type="withdraw" account={account} provider={provider} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stake' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Stake wDOGE</h2>
              <StakingForm account={account} provider={provider} />
            </div>
          )}

          {activeTab === 'lend' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Lending Platform</h2>
              <LendingForm account={account} provider={provider} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 