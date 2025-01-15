import { AlertManager, AlertConfig, Alert } from '../../src/services/alerting';
import { HealthStatus, PerformanceMetrics } from '../../src/services/healthMonitor';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let config: AlertConfig;
  let mockHandler: jest.Mock;

  beforeEach(() => {
    config = {
      successRateThreshold: 95,
      responseTimeThreshold: 5000,
      gasThreshold: 500000,
      errorCountThreshold: 3
    };
    alertManager = new AlertManager(config);
    mockHandler = jest.fn();
    alertManager.addAlertHandler(mockHandler);
  });

  const createMockMetrics = (overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics => ({
    responseTime: 1000,
    successRate: 100,
    lastNRequests: [],
    averageGasUsed: 100000,
    ...overrides
  });

  const createMockHealthStatus = (overrides: Partial<HealthStatus> = {}): HealthStatus => ({
    isHealthy: true,
    services: {
      bridge: {
        isHealthy: true,
        lastCheck: Date.now(),
        errors: [],
        performance: createMockMetrics()
      },
      dogecoin: {
        isHealthy: true,
        lastProcessedBlock: 1000,
        lastProcessedTime: Date.now(),
        errors: [],
        performance: createMockMetrics()
      }
    },
    lastUpdate: Date.now(),
    ...overrides
  });

  describe('checkHealthStatus', () => {
    it('should generate alert for low success rate', () => {
      const status = createMockHealthStatus({
        services: {
          bridge: {
            isHealthy: true,
            lastCheck: Date.now(),
            errors: [],
            performance: createMockMetrics({ successRate: 90 })
          },
          dogecoin: {
            isHealthy: true,
            lastProcessedBlock: 1000,
            lastProcessedTime: Date.now(),
            errors: [],
            performance: createMockMetrics()
          }
        }
      });

      alertManager.checkHealthStatus(status);
      
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'critical',
        service: 'bridge',
        metric: 'successRate',
        value: 90
      }));
    });

    it('should generate alert for high response time', () => {
      const status = createMockHealthStatus({
        services: {
          bridge: {
            isHealthy: true,
            lastCheck: Date.now(),
            errors: [],
            performance: createMockMetrics({ responseTime: 6000 })
          },
          dogecoin: {
            isHealthy: true,
            lastProcessedBlock: 1000,
            lastProcessedTime: Date.now(),
            errors: [],
            performance: createMockMetrics()
          }
        }
      });

      alertManager.checkHealthStatus(status);
      
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'warning',
        service: 'bridge',
        metric: 'responseTime',
        value: 6000
      }));
    });

    it('should generate alert for high gas usage', () => {
      const status = createMockHealthStatus({
        services: {
          bridge: {
            isHealthy: true,
            lastCheck: Date.now(),
            errors: [],
            performance: createMockMetrics({ averageGasUsed: 600000 })
          },
          dogecoin: {
            isHealthy: true,
            lastProcessedBlock: 1000,
            lastProcessedTime: Date.now(),
            errors: [],
            performance: createMockMetrics()
          }
        }
      });

      alertManager.checkHealthStatus(status);
      
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'warning',
        service: 'bridge',
        metric: 'gasUsed',
        value: 600000
      }));
    });

    it('should generate alert for high error count', () => {
      const status = createMockHealthStatus({
        services: {
          bridge: {
            isHealthy: false,
            lastCheck: Date.now(),
            errors: ['error1', 'error2', 'error3', 'error4'],
            performance: createMockMetrics()
          },
          dogecoin: {
            isHealthy: true,
            lastProcessedBlock: 1000,
            lastProcessedTime: Date.now(),
            errors: [],
            performance: createMockMetrics()
          }
        }
      });

      alertManager.checkHealthStatus(status);
      
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'critical',
        service: 'bridge',
        metric: 'errorCount',
        value: 4
      }));
    });
  });

  describe('getAlerts', () => {
    beforeEach(() => {
      // Add some test alerts
      const alerts: Alert[] = [
        {
          severity: 'critical',
          message: 'Test critical',
          timestamp: Date.now() - 5000,
          service: 'bridge'
        },
        {
          severity: 'warning',
          message: 'Test warning',
          timestamp: Date.now() - 3000,
          service: 'dogecoin'
        },
        {
          severity: 'info',
          message: 'Test info',
          timestamp: Date.now() - 1000,
          service: 'bridge'
        }
      ];
      
      alerts.forEach(alert => alertManager['notify'](alert));
    });

    it('should filter alerts by service', () => {
      const filtered = alertManager.getAlerts({ service: 'bridge' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(a => a.service === 'bridge')).toBe(true);
    });

    it('should filter alerts by severity', () => {
      const filtered = alertManager.getAlerts({ severity: 'critical' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('critical');
    });

    it('should filter alerts by timestamp', () => {
      const since = Date.now() - 2000;
      const filtered = alertManager.getAlerts({ since });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].timestamp).toBeGreaterThanOrEqual(since);
    });

    it('should return all alerts when no filters provided', () => {
      const all = alertManager.getAlerts();
      expect(all).toHaveLength(3);
    });
  });
}); 