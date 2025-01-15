import { HealthMonitor } from '../../src/services/healthMonitor';
import { AlertManager } from '../../src/services/alerting';
import { getBridgeContract } from '../../src/utils/contracts';
import { DogeMonitor } from '../../src/services/dogeMonitor';
import { JsonRpcProvider } from 'ethers';

jest.mock('../../src/utils/contracts');
jest.mock('../../src/services/dogeMonitor');

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockDogeMonitor: jest.Mocked<DogeMonitor>;
  let mockAlertManager: jest.Mocked<AlertManager>;
  let mockProvider: JsonRpcProvider;

  beforeEach(() => {
    mockDogeMonitor = {
      getHealthStatus: jest.fn(),
    } as any;

    mockAlertManager = {
      checkHealthStatus: jest.fn(),
      addAlertHandler: jest.fn(),
      getAlerts: jest.fn()
    } as any;

    mockProvider = new JsonRpcProvider("http://localhost:8545");
    healthMonitor = new HealthMonitor(mockDogeMonitor, mockAlertManager, mockProvider);
  });

  describe('checkHealth', () => {
    it('should check bridge service health', async () => {
      const mockBridgeContract = {
        depositFee: jest.fn().mockResolvedValue(BigInt(1000)),
        paused: jest.fn().mockResolvedValue(false)
      };

      (getBridgeContract as jest.Mock).mockResolvedValue(mockBridgeContract);

      const status = await healthMonitor.checkHealth();
      
      expect(status.bridge.isHealthy).toBe(true);
      expect(status.bridge.performance.successRate).toBeGreaterThan(0);
      expect(status.bridge.performance.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(status.bridge.performance.averageGasUsage).toBeGreaterThanOrEqual(0);
      expect(status.bridge.performance.errorCount).toBe(0);
    });

    it('should check dogecoin service health', async () => {
      const mockDogeHealth = {
        isHealthy: true,
        performance: {
          successRate: 98,
          averageResponseTime: 500,
          averageGasUsage: 200000,
          errorCount: 0
        }
      };

      mockDogeMonitor.getHealthStatus.mockResolvedValue(mockDogeHealth as any);

      const status = await healthMonitor.checkHealth();
      
      expect(status.dogecoin.isHealthy).toBe(true);
      expect(status.dogecoin.performance).toEqual(mockDogeHealth.performance);
    });

    it('should handle bridge service failure', async () => {
      const mockError = new Error('Bridge error');
      (getBridgeContract as jest.Mock).mockRejectedValueOnce(mockError);

      const status = await healthMonitor.checkHealth();
      
      expect(status.bridge.isHealthy).toBe(false);
      expect(status.bridge.performance.errorCount).toBeGreaterThan(0);
    });

    it('should handle dogecoin service failure', async () => {
      const mockError = new Error('Doge error');
      (mockDogeMonitor.getHealthStatus as jest.Mock).mockRejectedValueOnce(mockError);

      const status = await healthMonitor.checkHealth();
      
      expect(status.dogecoin.isHealthy).toBe(false);
      expect(status.dogecoin.performance.errorCount).toBeGreaterThan(0);
    });

    it('should update metrics over time', async () => {
      const mockBridgeContract = {
        depositFee: jest.fn().mockResolvedValue(BigInt(1000)),
        paused: jest.fn().mockResolvedValue(false)
      };

      (getBridgeContract as jest.Mock).mockResolvedValue(mockBridgeContract);

      // First check
      await healthMonitor.checkHealth();
      
      // Simulate an error
      (getBridgeContract as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
      await healthMonitor.checkHealth();
      
      // Third check
      (getBridgeContract as jest.Mock).mockResolvedValue(mockBridgeContract);
      const status = await healthMonitor.checkHealth();
      
      expect(status.bridge.performance.successRate).toBeLessThan(100);
      expect(status.bridge.performance.errorCount).toBeGreaterThan(0);
    });
  });

  describe('getLastHealthStatus', () => {
    it('should return cached status if available', async () => {
      const mockBridgeContract = {
        depositFee: jest.fn().mockResolvedValue(BigInt(1000)),
        paused: jest.fn().mockResolvedValue(false)
      };

      (getBridgeContract as jest.Mock).mockResolvedValue(mockBridgeContract);

      const initialStatus = await healthMonitor.checkHealth();
      const cachedStatus = healthMonitor.getLastHealthStatus();
      
      expect(cachedStatus).toEqual(initialStatus);
    });

    it('should return null if no status is cached', () => {
      const status = healthMonitor.getLastHealthStatus();
      expect(status).toBeNull();
    });
  });
}); 