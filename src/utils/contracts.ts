import { ethers, Contract } from 'ethers';
import { formatUnits as ethFormatUnits, parseUnits as ethParseUnits } from '@ethersproject/units';
import WDOGE_ABI from '../abis/WDOGE.json';
import BRIDGE_ABI from '../abis/DogeBridge.json';
import STAKING_ABI from '../abis/WDOGEStaking.json';
import LENDING_ABI from '../abis/WDOGELending.json';

// Contract addresses on Polygon Mainnet
export const CONTRACT_ADDRESSES = {
  WDOGE: process.env.NEXT_PUBLIC_WDOGE_ADDRESS || '',
  BRIDGE: process.env.NEXT_PUBLIC_BRIDGE_ADDRESS || '',
  STAKING: process.env.NEXT_PUBLIC_STAKING_ADDRESS || '',
  LENDING: process.env.NEXT_PUBLIC_LENDING_ADDRESS || '',
};

export interface ContractInstance {
  address: string;
  contract: Contract;
}

interface BridgeContract extends Contract {
  depositFee(): Promise<bigint>;
  withdrawFee(): Promise<bigint>;
  minDepositAmount(): Promise<bigint>;
  maxDepositAmount(): Promise<bigint>;
  minWithdrawAmount(): Promise<bigint>;
  maxWithdrawAmount(): Promise<bigint>;
  requestWithdraw(dogeAddress: string, amount: bigint): Promise<any>;
}

export async function getBridgeContract(provider: any): Promise<BridgeContract> {
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESSES.BRIDGE, BRIDGE_ABI, signer) as BridgeContract;
}

export async function getWDOGEContract(provider: any): Promise<ContractInstance> {
  const signer = await provider.getSigner();
  return {
    address: CONTRACT_ADDRESSES.WDOGE,
    contract: new Contract(CONTRACT_ADDRESSES.WDOGE, WDOGE_ABI, signer),
  };
}

export async function getStakingContract(provider: any): Promise<ContractInstance> {
  const signer = await provider.getSigner();
  return {
    address: CONTRACT_ADDRESSES.STAKING,
    contract: new Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, signer),
  };
}

export async function getLendingContract(provider: any): Promise<ContractInstance> {
  const signer = await provider.getSigner();
  return {
    address: CONTRACT_ADDRESSES.LENDING,
    contract: new Contract(CONTRACT_ADDRESSES.LENDING, LENDING_ABI, signer),
  };
}

export function formatUnits(value: bigint | string, decimals = 18): string {
  if (typeof value === 'string') {
    return ethFormatUnits(BigInt(value), decimals);
  }
  return ethFormatUnits(value, decimals);
}

export function parseUnits(value: string, decimals = 18): bigint {
  const bn = ethParseUnits(value, decimals);
  return BigInt(bn.toString());
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function validateAmount(value: string): boolean {
  try {
    if (!value || parseFloat(value) <= 0) return false;
    ethParseUnits(value);
    return true;
  } catch {
    return false;
  }
} 