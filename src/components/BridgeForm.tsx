import { useState, useEffect } from 'react';
import { Contract } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import { getBridgeContract, getWDOGEContract, validateAmount, formatUnits, parseUnits } from '../utils/contracts';
import { DogeMonitor } from '../services/dogeMonitor';

interface BridgeFormProps {
  type: 'deposit' | 'withdraw';
  account?: string;
  provider?: any;
}

interface BridgeContract extends Contract {
  depositFee: () => Promise<bigint>;
  withdrawFee: () => Promise<bigint>;
  requestWithdraw: (amount: bigint, dogeAddress: string) => Promise<any>;
}

interface TransactionState {
  status: 'idle' | 'pending' | 'success' | 'error';
  message: string;
}

const BridgeForm: React.FC<BridgeFormProps> = ({ type, account, provider }) => {
  const [amount, setAmount] = useState('');
  const [dogeAddress, setDogeAddress] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [estimatedGas, setEstimatedGas] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  const [txState, setTxState] = useState<TransactionState>({
    status: 'idle',
    message: ''
  });

  useEffect(() => {
    const checkNetwork = async () => {
      if (!provider) return;
      try {
        const network = await provider.getNetwork();
        setNetworkError(network.chainId !== 137n && network.chainId !== 31337n);
      } catch (error) {
        console.error('Error checking network:', error);
        setNetworkError(true);
      }
    };

    checkNetwork();
  }, [provider]);

  const generateDepositAddress = async () => {
    if (!provider || !account || !amount) return;

    setIsLoading(true);
    setError('');

    try {
      const dogeMonitor = new DogeMonitor(process.env.NEXT_PUBLIC_DOGE_PRIVATE_KEY || '');
      const amountNumber = Number(amount);
      const address = await dogeMonitor.generateDepositAddress(account, amountNumber);
      
      setDepositAddress(address);
      setTxState({
        status: 'success',
        message: 'Deposit address generated successfully'
      });
    } catch (error: any) {
      setError(error?.message || 'Failed to generate deposit address');
      setTxState({
        status: 'error',
        message: 'Failed to generate deposit address'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!provider || !account || !amount || !dogeAddress) return;

    setIsLoading(true);
    setError('');

    try {
      const { contract: bridgeContract } = await getBridgeContract(provider);
      const bridge = bridgeContract as unknown as BridgeContract;
      const amountBigInt = BigInt(parseUnits(amount).toString());

      const tx = await bridge.requestWithdraw(amountBigInt, dogeAddress);
      await tx.wait();

      setTxState({
        status: 'success',
        message: 'Withdrawal request submitted successfully'
      });
    } catch (error: any) {
      setError(error?.message || 'Failed to process withdrawal');
      setTxState({
        status: 'error',
        message: 'Withdrawal request failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!provider) {
    return (
      <div className="bg-[#1a1b1e] p-6 rounded-lg text-center text-gray-400">
        Please connect your wallet to continue
      </div>
    );
  }

  return (
    <div className="bg-[#1a1b1e] p-8 rounded-lg">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-[#2c2d30] p-6 rounded-lg border border-gray-800">
          <h2 className="text-xl font-semibold text-gray-200 mb-6">
            Bridge DOGE {type === 'deposit' ? 'to' : 'from'} Polygon
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Amount (DOGE)
              </label>
              <div className="flex">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.00000001"
                  className="block w-full px-3 py-2 bg-[#1a1b1e] border border-gray-700 rounded text-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  placeholder="Enter amount..."
                />
                <button
                  onClick={() => setAmount('1000')}
                  className="ml-2 px-4 py-2 text-sm bg-[#1a1b1e] text-orange-500 rounded hover:bg-[#3c3d40] border border-gray-700 font-medium"
                >
                  Max
                </button>
              </div>
            </div>

            {type === 'withdraw' && (
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Dogecoin Address
                </label>
                <input
                  type="text"
                  value={dogeAddress}
                  onChange={(e) => setDogeAddress(e.target.value)}
                  className="block w-full px-3 py-2 bg-[#1a1b1e] border border-gray-700 rounded text-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  placeholder="Enter Dogecoin address..."
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-900/20 text-red-400 rounded border border-red-800">
                {error}
              </div>
            )}

            {estimatedGas !== 0 && (
              <div className="text-sm text-gray-300">
                Estimated gas: {estimatedGas} MATIC
              </div>
            )}

            {type === 'deposit' ? (
              <button
                onClick={generateDepositAddress}
                disabled={isLoading || !amount || networkError}
                className={`w-full px-4 py-3 rounded text-white font-medium ${
                  isLoading || !amount || networkError
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {isLoading ? 'Processing...' : 'Generate Deposit Address'}
              </button>
            ) : (
              <button
                onClick={handleWithdraw}
                disabled={isLoading || !amount || !dogeAddress || networkError}
                className={`w-full px-4 py-3 rounded text-white font-medium ${
                  isLoading || !amount || !dogeAddress || networkError
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {isLoading ? 'Processing...' : 'Withdraw'}
              </button>
            )}

            {depositAddress && (
              <div className="bg-[#1a1b1e] p-6 rounded-lg border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-gray-200">Deposit Address</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(depositAddress);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="text-sm text-orange-500 hover:text-orange-400 font-medium"
                  >
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="flex justify-center py-4 bg-white rounded-lg">
                  <QRCodeSVG value={depositAddress} size={160} />
                </div>
                <div className="mt-4 text-sm text-gray-300 break-all text-center font-mono">
                  {depositAddress}
                </div>
              </div>
            )}

            {txState.status !== 'idle' && (
              <div className={`p-4 rounded-lg border ${
                txState.status === 'pending' ? 'bg-orange-900/20 border-orange-800 text-orange-400' :
                txState.status === 'success' ? 'bg-green-900/20 border-green-800 text-green-400' :
                'bg-red-900/20 border-red-800 text-red-400'
              }`}>
                {txState.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BridgeForm; 