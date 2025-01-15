import { NextResponse } from 'next/server';
import { DogeMonitor } from '@/services/dogeMonitor';
import { bridgeService } from '@/services/bridgeService';

export async function GET() {
    try {
        const dogeMonitor = new DogeMonitor();
        const monitorHealth = dogeMonitor.getHealthStatus();
        
        const status = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                dogeMonitor: monitorHealth,
                bridge: {
                    isHealthy: bridgeService.isConnected(),
                    lastSync: bridgeService.getLastSyncTime()
                }
            }
        };

        return NextResponse.json(status);
    } catch (error) {
        console.error('Health check failed:', error);
        return NextResponse.json(
            { 
                status: 'error', 
                message: 'Health check failed',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
} 