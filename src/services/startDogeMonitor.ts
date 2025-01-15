import { config } from 'dotenv';
import { DogeMonitor } from '../services/dogeMonitor';

// Load environment variables
config();

async function main() {
  const {
    DOGE_PRIVATE_KEY,
    MIN_CONFIRMATIONS,
  } = process.env;

  if (!DOGE_PRIVATE_KEY) {
    throw new Error('Missing DOGE_PRIVATE_KEY environment variable');
  }

  const minConfirmations = MIN_CONFIRMATIONS ? parseInt(MIN_CONFIRMATIONS) : 6;

  // Initialize Dogecoin monitor
  const monitor = new DogeMonitor(DOGE_PRIVATE_KEY, minConfirmations);
  console.log('Starting Dogecoin transaction monitoring service...');

  // Start monitoring with 1-minute intervals
  setInterval(() => {
    monitor.monitorTransactions().catch((error) => {
      console.error('Error in monitoring cycle:', error);
    });
  }, 60000);

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('Shutting down Dogecoin monitoring service...');
    process.exit();
  });
}

main().catch((error) => {
  console.error('Error starting Dogecoin monitor:', error);
  process.exit(1);
}); 