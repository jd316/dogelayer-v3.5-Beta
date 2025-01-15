export interface Alert {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
  timestamp?: number;
}

export class AlertManager {
  private readonly webhookUrl?: string;
  private readonly emailConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };

  constructor(config: {
    webhookUrl?: string;
    emailConfig?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  }) {
    this.webhookUrl = config.webhookUrl;
    this.emailConfig = config.emailConfig;
  }

  public async sendAlert(alert: Alert): Promise<void> {
    const enrichedAlert = {
      ...alert,
      timestamp: alert.timestamp || Date.now()
    };

    if (this.webhookUrl) {
      await this.sendWebhook(enrichedAlert);
    }

    if (this.emailConfig && alert.severity === 'critical') {
      await this.sendEmail(enrichedAlert);
    }

    console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`, alert.metadata);
  }

  private async sendWebhook(alert: Alert): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alert)
      });

      if (!response.ok) {
        console.error('Failed to send webhook alert:', await response.text());
      }
    } catch (error) {
      console.error('Error sending webhook alert:', error);
    }
  }

  private async sendEmail(alert: Alert): Promise<void> {
    if (!this.emailConfig) return;

    // Email sending implementation using nodemailer or similar
    console.log('Sending email alert:', alert);
  }
} 