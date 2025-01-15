import { AlertManager } from '../../src/services/alerting';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  const mockConfig = {
    minSuccessRate: 95,
    maxResponseTime: 1000,
    maxGasUsage: 500000,
    maxErrorCount: 5
  };

  beforeEach(() => {
    alertManager = new AlertManager(mockConfig);
  });

  describe('checkHealthStatus', () => {
    it('should generate alert for low success rate', async () => {
      const mockStatus = {
        service: 'bridge',
        successRate: 90,
        averageResponseTime: 500,
        averageGasUsage: 200000,
        errorCount: 2,
        isHealthy: true,
        lastUpdate: Date.now()
      };

      let alertReceived = false;
      alertManager.addAlertHandler((alert) => {
        expect(alert.severity).toBe('critical');
        expect(alert.message).toContain('Low success rate');
        expect(alert.service).toBe('bridge');
        expect(alert.timestamp).toBeLessThanOrEqual(Date.now());
        alertReceived = true;
      });

      await alertManager.checkHealthStatus(mockStatus);
      expect(alertReceived).toBe(true);
    });

    it('should generate alert for high response time', async () => {
      const mockStatus = {
        service: 'bridge',
        successRate: 98,
        averageResponseTime: 1500,
        averageGasUsage: 200000,
        errorCount: 2,
        isHealthy: true,
        lastUpdate: Date.now()
      };

      let alertReceived = false;
      alertManager.addAlertHandler((alert) => {
        expect(alert.severity).toBe('warning');
        expect(alert.message).toContain('High response time');
        expect(alert.service).toBe('bridge');
        expect(alert.timestamp).toBeLessThanOrEqual(Date.now());
        alertReceived = true;
      });

      await alertManager.checkHealthStatus(mockStatus);
      expect(alertReceived).toBe(true);
    });

    it('should generate alert for high gas usage', async () => {
      const mockStatus = {
        service: 'bridge',
        successRate: 98,
        averageResponseTime: 500,
        averageGasUsage: 600000,
        errorCount: 2,
        isHealthy: true,
        lastUpdate: Date.now()
      };

      let alertReceived = false;
      alertManager.addAlertHandler((alert) => {
        expect(alert.severity).toBe('warning');
        expect(alert.message).toContain('High gas usage');
        expect(alert.service).toBe('bridge');
        expect(alert.timestamp).toBeLessThanOrEqual(Date.now());
        alertReceived = true;
      });

      await alertManager.checkHealthStatus(mockStatus);
      expect(alertReceived).toBe(true);
    });

    it('should generate alert for high error count', async () => {
      const mockStatus = {
        service: 'bridge',
        successRate: 98,
        averageResponseTime: 500,
        averageGasUsage: 200000,
        errorCount: 6,
        isHealthy: true,
        lastUpdate: Date.now()
      };

      let alertReceived = false;
      alertManager.addAlertHandler((alert) => {
        expect(alert.severity).toBe('critical');
        expect(alert.message).toContain('High error count');
        expect(alert.service).toBe('bridge');
        expect(alert.timestamp).toBeLessThanOrEqual(Date.now());
        alertReceived = true;
      });

      await alertManager.checkHealthStatus(mockStatus);
      expect(alertReceived).toBe(true);
    });

    it('should not generate alerts for healthy status', async () => {
      const mockStatus = {
        service: 'bridge',
        successRate: 100,
        averageResponseTime: 500,
        averageGasUsage: 200000,
        errorCount: 0,
        isHealthy: true,
        lastUpdate: Date.now()
      };

      let alertReceived = false;
      alertManager.addAlertHandler(() => {
        alertReceived = true;
      });

      await alertManager.checkHealthStatus(mockStatus);
      expect(alertReceived).toBe(false);
    });

    it('should handle multiple alerts for the same status', async () => {
      const mockStatus = {
        service: 'bridge',
        successRate: 90,
        averageResponseTime: 1500,
        averageGasUsage: 600000,
        errorCount: 6,
        isHealthy: false,
        lastUpdate: Date.now()
      };

      const receivedAlerts: string[] = [];
      alertManager.addAlertHandler((alert) => {
        receivedAlerts.push(alert.message);
      });

      await alertManager.checkHealthStatus(mockStatus);
      expect(receivedAlerts).toHaveLength(4); // Should receive all types of alerts
      expect(receivedAlerts.some(msg => msg.includes('Low success rate'))).toBe(true);
      expect(receivedAlerts.some(msg => msg.includes('High response time'))).toBe(true);
      expect(receivedAlerts.some(msg => msg.includes('High gas usage'))).toBe(true);
      expect(receivedAlerts.some(msg => msg.includes('High error count'))).toBe(true);
    });
  });

  describe('getAlerts', () => {
    beforeEach(async () => {
      // Add some test alerts
      await alertManager.checkHealthStatus({
        service: 'bridge',
        successRate: 90,
        averageResponseTime: 1500,
        averageGasUsage: 600000,
        errorCount: 6,
        isHealthy: false,
        lastUpdate: Date.now()
      });

      await alertManager.checkHealthStatus({
        service: 'dogecoin',
        successRate: 98,
        averageResponseTime: 500,
        averageGasUsage: 200000,
        errorCount: 2,
        isHealthy: true,
        lastUpdate: Date.now()
      });
    });

    it('should filter alerts by service', () => {
      const bridgeAlerts = alertManager.getAlerts({ service: 'bridge' });
      expect(bridgeAlerts.every(alert => alert.service === 'bridge')).toBe(true);
      expect(bridgeAlerts.length).toBeGreaterThan(0);
    });

    it('should filter alerts by severity', () => {
      const criticalAlerts = alertManager.getAlerts({ severity: 'critical' });
      expect(criticalAlerts.every(alert => alert.severity === 'critical')).toBe(true);
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it('should filter alerts by timestamp', () => {
      const now = Date.now();
      const recentAlerts = alertManager.getAlerts({ since: now - 1000 });
      expect(recentAlerts.every(alert => alert.timestamp >= now - 1000)).toBe(true);
      expect(recentAlerts.length).toBeGreaterThan(0);
    });

    it('should combine multiple filters', () => {
      const now = Date.now();
      const filteredAlerts = alertManager.getAlerts({
        service: 'bridge',
        severity: 'critical',
        since: now - 1000
      });

      expect(filteredAlerts.every(alert => 
        alert.service === 'bridge' &&
        alert.severity === 'critical' &&
        alert.timestamp >= now - 1000
      )).toBe(true);
    });

    it('should return empty array when no alerts match filters', () => {
      const futureAlerts = alertManager.getAlerts({ since: Date.now() + 10000 });
      expect(futureAlerts).toHaveLength(0);
    });
  });
}); 