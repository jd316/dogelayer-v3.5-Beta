import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getBridgeContract, validateAmount, formatUnits, parseUnits } from '../utils/contracts';
import { DogecoinService } from '../utils/dogecoin';
import { validateDogeAddress } from '../utils/validation';

interface BridgeFormProps {
  account?: string;
  provider?: any;
  type: 'deposit' | 'withdraw';
}

interface TransactionState {
  status: 'idle' | 'pending' | 'confirmed' | 'failed';
  message?: string;
  hash?: string;
}

export const BridgeForm: React.FC<BridgeFormProps> = ({ account, provider, type }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  const [estimatedGas, setEstimatedGas] = useState('0');
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  const [dogeAddress, setDogeAddress] = useState('');
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        if (provider) {
          const network = await provider.getNetwork();
          setNetworkError(network.chainId !== 137); // Polygon Mainnet
        }
      } catch (error) {
        console.error('Network check failed:', error);
        setNetworkError(true);
      }
    };
    checkNetwork();
  }, [provider]);

  useEffect(() => {
    const estimateGas = async () => {
      if (!amount || !type || networkError) return;
      try {
        const bridgeContract = await getBridgeContract(provider);
        const gas = type === 'deposit' 
          ? await bridgeContract.depositFee()
          : await bridgeContract.withdrawFee();
        setEstimatedGas(formatUnits(gas, 18));
      } catch (error) {
        console.error('Error estimating gas:', error);
        setError('Failed to estimate gas fees. Please try again.');
      }
    };
    estimateGas();
  }, [type, amount, provider, networkError]);

  const validateInputs = (): boolean => {
    if (!account || !provider) {
      setError('Please connect your wallet');
      return false;
    }

    if (!validateAmount(amount)) {
      setError('Invalid amount');
      return false;
    }

    if (type === 'withdraw') {
      if (!dogeAddress) {
        setError('Please enter a Dogecoin address');
        return false;
      }
      if (!validateDogeAddress(dogeAddress)) {
        setError('Invalid Dogecoin address');
        return false;
      }
    }

    if (networkError) {
      setError('Please connect to Polygon Mainnet');
      return false;
    }

    return true;
  };

  const handleDeposit = async () => {
    try {
      setLoading(true);
      setError('');
      setTxState({ status: 'pending', message: 'Generating deposit address...' });
      
      const dogecoinService = new DogecoinService();
      const parsedAmount = parseUnits(amount, 18);
      const address = await dogecoinService.generateDepositAddress(account!, parsedAmount);
      setDepositAddress(address);

      // Start monitoring for deposit
      setTxState({ status: 'pending', message: 'Waiting for deposit confirmation...' });
      const confirmations = await dogecoinService.monitorDeposit(address);
      
      if (confirmations >= 6) {
        setTxState({ 
          status: 'confirmed',
          message: 'Deposit confirmed! Your wDOGE will be available shortly.'
        });
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      setTxState({ 
        status: 'failed',
        message: error.message || 'Failed to process deposit'
      });
      setError(error.message || 'Error processing deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setLoading(true);
      setError('');
      setTxState({ status: 'pending', message: 'Initiating withdrawal...' });

      const bridgeContract = await getBridgeContract(provider);
      const parsedAmount = parseUnits(amount, 18);
      
      // Request withdrawal
      const tx = await bridgeContract.requestWithdraw(dogeAddress, parsedAmount);
      setTxState({ 
        status: 'pending',
        message: 'Transaction submitted. Waiting for confirmation...',
        hash: tx.hash
      });
      
      // Wait for confirmation
      await tx.wait();
      setTxState({ 
        status: 'confirmed',
        message: 'Withdrawal confirmed! Please wait for processing.',
        hash: tx.hash
      });
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      setTxState({ 
        status: 'failed',
        message: error.message || 'Failed to process withdrawal'
      });
      setError(error.message || 'Error processing withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(depositAddress);
      alert('Address copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSubmit = async () => {
    if (!validateInputs()) return;

    try {
      if (type === 'deposit') {
        await handleDeposit();
      } else {
        await handleWithdraw();
      }
    } catch (error: any) {
      setError(error.message || `Error processing ${type}`);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      {networkError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          Please connect to Polygon Mainnet
        </div>
      )}

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Amount
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount..."
          disabled={loading}
        />
      </div>

      {type === 'withdraw' && (
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Dogecoin Address
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            value={dogeAddress}
            onChange={(e) => setDogeAddress(e.target.value)}
            placeholder="Enter Dogecoin address..."
            disabled={loading}
          />
        </div>
      )}

      {estimatedGas !== '0' && (
        <div className="mb-4 text-sm text-gray-600">
          Estimated gas: {estimatedGas} {type === 'deposit' ? 'DOGE' : 'MATIC'}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        onClick={handleSubmit}
        disabled={loading || networkError}
      >
        {type === 'deposit' ? 'Generate Deposit Address' : 'Withdraw'}
      </button>

      {depositAddress && type === 'deposit' && (
        <div className="mt-4 p-4 border rounded">
          <div className="flex justify-center mb-4">
            <QRCodeSVG value={depositAddress} size={200} />
          </div>
          <div className="text-center mb-2">
            <p className="text-sm text-gray-600">Send DOGE to:</p>
            <p className="font-mono break-all">{depositAddress}</p>
          </div>
          <button
            className="w-full mt-2 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={copyToClipboard}
            disabled={loading}
          >
            Copy Address
          </button>
        </div>
      )}

      {txState.status !== 'idle' && (
        <div className={`mt-4 text-center ${
          txState.status === 'confirmed' ? 'text-green-500' : 
          txState.status === 'failed' ? 'text-red-500' : 'text-blue-500'
        }`}>
          <p>{txState.message}</p>
          {txState.hash && (
            <a
              href={`https://polygonscan.com/tx/${txState.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View on PolygonScan
            </a>
          )}
        </div>
      )}
    </div>
  );
}; 