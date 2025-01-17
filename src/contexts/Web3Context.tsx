import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

type BrowserProvider = InstanceType<typeof ethers.BrowserProvider>;

interface Web3ContextType {
  account: string;
  provider: BrowserProvider | undefined;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

const POLYGON_CHAIN_ID = process.env.NEXT_PUBLIC_NETWORK === 'localhost' ? '0x7A69' : '0x89'; // 31337 or 137 in hex
const POLYGON_PARAMS = process.env.NEXT_PUBLIC_NETWORK === 'localhost' ? {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Hardhat Local',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['http://127.0.0.1:8545'],
  blockExplorerUrls: []
} : {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18
  },
  rpcUrls: ['https://polygon-rpc.com/'],
  blockExplorerUrls: ['https://polygonscan.com/']
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchToPolygon = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [POLYGON_PARAMS],
          });
        } catch (addError) {
          console.error('Error adding Polygon network:', addError);
          throw new Error('Failed to add Polygon network');
        }
      } else {
        console.error('Error switching to Polygon network:', switchError);
        throw new Error('Failed to switch to Polygon network');
      }
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const ethereum = window.ethereum;
      if (!ethereum) {
        throw new Error('Please install MetaMask to use this application');
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      await switchToPolygon();
      const provider = new ethers.BrowserProvider(ethereum);
      
      setAccount(accounts[0]);
      setProvider(provider);
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        try {
          await switchToPolygon();
        } catch (error) {
          console.error('Error switching network:', error);
        }
      } else {
        setAccount('');
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    const ethereum = window.ethereum;
    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      // Check if already connected
      ethereum.request({ method: 'eth_accounts' })
        .then(async accounts => {
          if (accounts.length > 0) {
            await handleAccountsChanged(accounts);
            setProvider(new ethers.BrowserProvider(ethereum));
          }
        })
        .catch(console.error);

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const value = {
    account,
    provider,
    isConnecting,
    error,
    connectWallet,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
} 