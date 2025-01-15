import { RateLimitMonitor } from '../../src/services/RateLimitMonitor';
import { AlertManager } from '../../src/services/alerting';

jest.mock('../../src/services/alerting');

describe('RateLimitMonitor', () => {
  let monitor: RateLimitMonitor;
  let mockAlertManager: jest.Mocked<AlertManager>;

  beforeEach(() => {
    mockAlertManager = new AlertManager({
      minSuccessRate: 95,
      maxResponseTime: 1000,
      maxGasUsage: 1000000,
      maxErrorCount: 10
    }) as jest.Mocked<AlertManager>;
    monitor = new RateLimitMonitor(mockAlertManager);
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('logEvent', () => {
    it('should store rate limit events', () => {
      const event = {
        clientId: 'test-client',
        timestamp: Date.now(),
        endpoint: '/api/deposit',
        isLimited: false
      };

      monitor.logEvent(event);
      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.limitedRequests).toBe(0);
    });

    it('should trigger alerts for rate limited events', () => {
      const event = {
        clientId: 'test-client',
        timestamp: Date.now(),
        endpoint: '/api/deposit',
        isLimited: true
      };

      monitor.logEvent(event);
      expect(mockAlertManager.checkHealthStatus).toHaveBeenCalled();
    });

    it('should maintain max stored events limit', () => {
      const maxEvents = 1000;
      for (let i = 0; i < maxEvents + 10; i++) {
        monitor.logEvent({
          clientId: `client-${i}`,
          timestamp: Date.now(),
          endpoint: '/api/test',
          isLimited: false
        });
      }

      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(maxEvents);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // Add some test data
      const baseTime = Date.now();
      for (let i = 0; i < 5; i++) {
        monitor.logEvent({
          clientId: 'client-1',
          timestamp: baseTime - i * 1000,
          endpoint: '/api/deposit',
          isLimited: i === 4
        });
      }
      for (let i = 0; i < 3; i++) {
        monitor.logEvent({
          clientId: 'client-2',
          timestamp: baseTime - i * 1000,
          endpoint: '/api/withdraw',
          isLimited: false
        });
      }
    });

    it('should return correct overall stats', () => {
      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(8);
      expect(stats.limitedRequests).toBe(1);
      expect(stats.uniqueClients).toBe(2);
    });

    it('should return stats within time window', () => {
      const stats = monitor.getStats(2000); // 2 second window
      expect(stats.totalRequests).toBe(4); // Only most recent events
    });

    it('should identify top clients', () => {
      const stats = monitor.getStats();
      expect(stats.topClients[0].clientId).toBe('client-1');
      expect(stats.topClients[0].requests).toBe(5);
    });
  });

  describe('getEndpointStats', () => {
    beforeEach(() => {
      const baseTime = Date.now();
      // Add deposit endpoint events
      for (let i = 0; i < 3; i++) {
        monitor.logEvent({
          clientId: 'client-1',
          timestamp: baseTime - i * 1000,
          endpoint: '/api/deposit',
          isLimited: false
        });
      }
      // Add withdraw endpoint events
      for (let i = 0; i < 2; i++) {
        monitor.logEvent({
          clientId: 'client-2',
          timestamp: baseTime - i * 1000,
          endpoint: '/api/withdraw',
          isLimited: i === 1
        });
      }
    });

    it('should return stats for specific endpoint', () => {
      const depositStats = monitor.getEndpointStats('/api/deposit');
      expect(depositStats.totalRequests).toBe(3);
      expect(depositStats.limitedRequests).toBe(0);

      const withdrawStats = monitor.getEndpointStats('/api/withdraw');
      expect(withdrawStats.totalRequests).toBe(2);
      expect(withdrawStats.limitedRequests).toBe(1);
    });

    it('should return stats within time window', () => {
      const stats = monitor.getEndpointStats('/api/deposit', 1500);
      expect(stats.totalRequests).toBe(2); // Only most recent events
    });
  });

  describe('getClientHistory', () => {
    const baseTime = Date.now();
    const clientId = 'test-client';

    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        monitor.logEvent({
          clientId,
          timestamp: baseTime - i * 1000,
          endpoint: '/api/test',
          isLimited: i === 2
        });
      }
    });

    it('should return all events for a client', () => {
      const history = monitor.getClientHistory(clientId);
      expect(history.length).toBe(5);
      expect(history.filter(e => e.isLimited).length).toBe(1);
    });

    it('should return events within time window', () => {
      const history = monitor.getClientHistory(clientId, 2500);
      expect(history.length).toBe(3); // Only most recent events
    });

    it('should return empty array for unknown client', () => {
      const history = monitor.getClientHistory('unknown-client');
      expect(history).toEqual([]);
    });
  });

  describe('clearOldEvents', () => {
    it('should remove events older than specified age', () => {
      const baseTime = Date.now();
      // Add some old events
      for (let i = 0; i < 3; i++) {
        monitor.logEvent({
          clientId: 'test-client',
          timestamp: baseTime - (i + 1) * 5000, // 5 seconds apart
          endpoint: '/api/test',
          isLimited: false
        });
      }

      monitor.clearOldEvents(7500); // Clear events older than 7.5 seconds
      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(2); // Only the two most recent events
    });
  });
}); 