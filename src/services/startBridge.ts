import { config } from 'dotenv';
import { BridgeService } from '../services/bridgeService';
import { ethers } from 'ethers';

// Load environment variables
config();

async function main() {
  const {
    POLYGON_RPC_URL,
    BRIDGE_CONTRACT_ADDRESS,
    ADMIN_PRIVATE_KEY,
  } = process.env;

  if (!POLYGON_RPC_URL || !BRIDGE_CONTRACT_ADDRESS || !ADMIN_PRIVATE_KEY) {
    throw new Error('Missing required environment variables');
  }

  // Initialize bridge service
  const bridgeService = new BridgeService(
    POLYGON_RPC_URL,
    BRIDGE_CONTRACT_ADDRESS,
    [], // ABI will be loaded from artifacts
    6 // Number of confirmations required
  );

  console.log('Starting bridge monitoring service...');
  
  // Start monitoring with 1-minute intervals
  bridgeService.startMonitoring(60000);

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('Shutting down bridge monitoring service...');
    process.exit();
  });
}

main().catch((error) => {
  console.error('Error starting bridge service:', error);
  process.exit(1);
}); 