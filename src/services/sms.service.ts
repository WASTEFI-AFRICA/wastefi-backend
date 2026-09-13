import twilio from 'twilio';
import { logger } from '../utils/logger.util';

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface SendSMSRequest {
  to: string;
  message: string;
}

export interface SendSMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMSService {
  private static client: twilio.Twilio | null = null;
  private static config: SMSConfig | null = null;

  /**
   * Initialize SMS service
   */
  static initialize(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
      logger.warn('SMS service not configured - Twilio credentials missing');
      return;
    }

    this.config = {
      accountSid,
      authToken,
      phoneNumber,
    };

    this.client = twilio(accountSid, authToken);
    logger.info('SMS service initialized with Twilio');
  }

  /**
   * Send SMS message
   */
  static async sendSMS(request: SendSMSRequest): Promise<SendSMSResponse> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'SMS service not configured',
        };
      }

      // Validate phone number format
      if (!request.to.match(/^\+?[1-9]\d{1,14}$/)) {
        return {
          success: false,
          error: 'Invalid phone number format',
        };
      }

      // Send SMS via Twilio
      const message = await this.client.messages.create({
        body: request.message,
        from: this.config.phoneNumber,
        to: request.to,
      });

      logger.info('SMS sent successfully', {
        to: this.maskPhoneNumber(request.to),
        messageId: message.sid,
      });

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      logger.error('Failed to send SMS', {
        error: error as Error,
        to: this.maskPhoneNumber(request.to),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  }

  /**
   * Send verification code
   */
  static async sendVerificationCode(phoneNumber: string, code: string): Promise<SendSMSResponse> {
    const message = `Your WasteFi verification code is: ${code}. This code will expire in 10 minutes.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Send welcome message
   */
  static async sendWelcomeMessage(phoneNumber: string, firstName: string): Promise<SendSMSResponse> {
    const message = `Welcome to WasteFi, ${firstName}! Start collecting waste and earning rewards today. Visit our app to get started.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Send payment notification
   */
  static async sendPaymentNotification(
    phoneNumber: string,
    amount: number,
    currency: string
  ): Promise<SendSMSResponse> {
    const message = `You've received a payment of ${amount} ${currency} from WasteFi. Check your wallet for details.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Send collection verification notification
   */
  static async sendCollectionVerified(
    phoneNumber: string,
    amount: number,
    currency: string
  ): Promise<SendSMSResponse> {
    const message = `Your waste collection has been verified! You've earned ${amount} ${currency}. Payment will be processed shortly.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Send withdrawal confirmation
   */
  static async sendWithdrawalConfirmation(
    phoneNumber: string,
    amount: number,
    currency: string
  ): Promise<SendSMSResponse> {
    const message = `Your withdrawal request of ${amount} ${currency} has been initiated. You'll receive the funds shortly.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Send KYC approval notification
   */
  static async sendKYCApproved(phoneNumber: string, firstName: string): Promise<SendSMSResponse> {
    const message = `Great news, ${firstName}! Your KYC verification has been approved. You can now access all WasteFi features.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Send KYC rejection notification
   */
  static async sendKYCRejected(
    phoneNumber: string,
    firstName: string,
    reason?: string
  ): Promise<SendSMSResponse> {
    const message = `Hello ${firstName}, your KYC verification could not be approved${
      reason ? `: ${reason}` : ''
    }. Please update your documents and try again.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Check if SMS service is available
   */
  static isAvailable(): boolean {
    return this.client !== null && this.config !== null;
  }

  /**
   * Mask phone number for privacy
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return '****';
    return phoneNumber.slice(0, 4) + '****' + phoneNumber.slice(-2);
  }
}
