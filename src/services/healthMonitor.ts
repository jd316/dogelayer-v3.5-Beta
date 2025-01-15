import { getBridgeContract } from '../utils/contracts';
import { DogeMonitor } from './dogeMonitor';
import { AlertManager } from './alerting';
import { Contract, Provider } from 'ethers';

interface BridgeContract extends Contract {
  depositFee(): Promise<bigint>;
  paused(): Promise<boolean>;
}

interface PerformanceMetrics {
  successRate: number;
  averageResponseTime: number;
  averageGasUsage: number;
  errorCount: number;
}

interface ServiceHealth {
  isHealthy: boolean;
  performance: PerformanceMetrics;
}

interface HealthStatus {
  bridge: ServiceHealth;
  dogecoin: ServiceHealth;
}

interface DogeHealthStatus {
  isHealthy: boolean;
  performance: PerformanceMetrics;
}

export class HealthMonitor {
  private lastStatus: HealthStatus | null = null;
  private bridgeMetrics: {
    totalCalls: number;
    successfulCalls: number;
    totalResponseTime: number;
    totalGasUsage: number;
    errors: number;
  } = {
    totalCalls: 0,
    successfulCalls: 0,
    totalResponseTime: 0,
    totalGasUsage: 0,
    errors: 0
  };

  constructor(
    private readonly dogeMonitor: DogeMonitor,
    private readonly alertManager: AlertManager,
    private readonly provider: Provider
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    const [bridgeHealth, dogecoinHealth] = await Promise.all([
      this.checkBridgeHealth(),
      this.checkDogecoinHealth()
    ]);

    this.lastStatus = {
      bridge: bridgeHealth,
      dogecoin: dogecoinHealth
    };

    await this.alertManager.checkHealthStatus({
      service: 'bridge',
      ...bridgeHealth.performance,
      isHealthy: bridgeHealth.isHealthy,
      lastUpdate: Date.now()
    });

    await this.alertManager.checkHealthStatus({
      service: 'dogecoin',
      ...dogecoinHealth.performance,
      isHealthy: dogecoinHealth.isHealthy,
      lastUpdate: Date.now()
    });

    return this.lastStatus;
  }

  private async checkBridgeHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    this.bridgeMetrics.totalCalls++;

    try {
      const bridge = await getBridgeContract(this.provider) as unknown as BridgeContract;
      const depositFee = await bridge.depositFee();
      const isPaused = await bridge.paused();

      const responseTime = Date.now() - startTime;
      this.bridgeMetrics.successfulCalls++;
      this.bridgeMetrics.totalResponseTime += responseTime;
      this.bridgeMetrics.totalGasUsage += Number(depositFee);

      return {
        isHealthy: !isPaused,
        performance: {
          successRate: (this.bridgeMetrics.successfulCalls / this.bridgeMetrics.totalCalls) * 100,
          averageResponseTime: this.bridgeMetrics.totalResponseTime / this.bridgeMetrics.totalCalls,
          averageGasUsage: this.bridgeMetrics.totalGasUsage / this.bridgeMetrics.totalCalls,
          errorCount: this.bridgeMetrics.errors
        }
      };
    } catch (error) {
      this.bridgeMetrics.errors++;
      return {
        isHealthy: false,
        performance: {
          successRate: (this.bridgeMetrics.successfulCalls / this.bridgeMetrics.totalCalls) * 100,
          averageResponseTime: this.bridgeMetrics.totalResponseTime / this.bridgeMetrics.totalCalls,
          averageGasUsage: this.bridgeMetrics.totalGasUsage / this.bridgeMetrics.totalCalls,
          errorCount: this.bridgeMetrics.errors
        }
      };
    }
  }

  private async checkDogecoinHealth(): Promise<ServiceHealth> {
    try {
      const health = await this.dogeMonitor.getHealthStatus() as unknown as DogeHealthStatus;
      return {
        isHealthy: health.isHealthy,
        performance: {
          successRate: health.performance.successRate,
          averageResponseTime: health.performance.averageResponseTime,
          averageGasUsage: health.performance.averageGasUsage,
          errorCount: health.performance.errorCount
        }
      };
    } catch (error) {
      return {
        isHealthy: false,
        performance: {
          successRate: 0,
          averageResponseTime: 0,
          averageGasUsage: 0,
          errorCount: 1
        }
      };
    }
  }

  getLastHealthStatus(): HealthStatus | null {
    return this.lastStatus;
  }
} 