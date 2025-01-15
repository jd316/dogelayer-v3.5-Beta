import { DogeMonitor } from '../../src/services/dogeMonitor';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DogeMonitor', () => {
  let monitor: DogeMonitor;

  beforeEach(() => {
    monitor = new DogeMonitor('testPrivateKey');
    jest.clearAllMocks();
  });

  describe('generateDepositAddress', () => {
    it('should generate a valid deposit address', async () => {
      const address = await monitor.generateDepositAddress('testAccount', 100);
      expect(address).toBeTruthy();
      expect(typeof address).toBe('string');
    });

    it('should store the address mapping', async () => {
      const address = await monitor.generateDepositAddress('testAccount', 100);
      const addresses = monitor.getMonitoredAddresses();
      expect(addresses).toContain(address);
    });
  });

  describe('monitorTransactions', () => {
    it('should process transactions correctly', async () => {
      // Mock successful API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            bitcoin: {
              outputs: [
                {
                  outputAddress: 'testAddress',
                  value: 100,
                  transaction: {
                    hash: 'txHash',
                    confirmations: 6,
                    block: {
                      height: 1000
                    }
                  }
                }
              ]
            }
          }
        }
      });

      await monitor.generateDepositAddress('testAccount', 100);
      await monitor.monitorTransactions();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graphql.bitquery.io',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle API errors with retry', async () => {
      mockedAxios.post
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          data: {
            data: {
              bitcoin: {
                outputs: []
              }
            }
          }
        });

      await monitor.monitorTransactions();
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyTransaction', () => {
    it('should verify transaction confirmations', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          confirmations: 6
        }
      });

      const isVerified = await monitor.verifyTransaction('testTxId');
      expect(isVerified).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('testTxId')
      );
    });

    it('should handle verification errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));
      await expect(monitor.verifyTransaction('testTxId')).rejects.toThrow();
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when everything is ok', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            bitcoin: {
              outputs: [
                {
                  transaction: {
                    hash: 'txHash',
                    confirmations: 6,
                    timestamp: Date.now()
                  }
                }
              ]
            }
          }
        }
      });

      const status = await monitor.getHealthStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.successRate).toBe(100);
      expect(status.errorCount).toBe(0);
    });

    it('should handle errors in health check', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));
      const status = await monitor.getHealthStatus();
      expect(status.isHealthy).toBe(false);
      expect(status.successRate).toBe(0);
      expect(status.errorCount).toBeGreaterThan(0);
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed operations', async () => {
      mockedAxios.post
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({
          data: {
            data: {
              bitcoin: {
                outputs: []
              }
            }
          }
        });

      await monitor.monitorTransactions();
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Persistent failure'));

      await expect(monitor.monitorTransactions()).rejects.toThrow('Persistent failure');
      expect(mockedAxios.post).toHaveBeenCalledTimes(5); // Default max retries for monitorTransactions
    });
  });
}); 