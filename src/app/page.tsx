'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { BridgeForm } from '../components/BridgeForm';

export default function Home() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<InstanceType<typeof ethers.BrowserProvider> | undefined>();
  const [wDogeBalance, setWDogeBalance] = useState<string>('0');

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        setAccount(accounts[0]);
        setProvider(provider);

        // Get wDOGE balance
        const wdogeContract = new ethers.Contract(
          process.env.NEXT_PUBLIC_WDOGE_ADDRESS!,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        );
        const balance = await wdogeContract.balanceOf(accounts[0]);
        setWDogeBalance(ethers.formatEther(balance));
      } else {
        alert('Please install MetaMask to use this dApp!');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          DogeBridge: DOGE ⇄ wDOGE
        </h1>
        
        {!account ? (
          <div className="text-center">
            <button
              onClick={connectWallet}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="text-gray-600">Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
              <p className="text-gray-600">wDOGE Balance: {wDogeBalance}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Bridge to Polygon</h2>
                <BridgeForm
                  type={'deposit' as const}
                  account={account}
                  provider={provider}
                />
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Bridge to Dogecoin</h2>
                <BridgeForm
                  type={'withdraw' as const}
                  account={account}
                  provider={provider}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 