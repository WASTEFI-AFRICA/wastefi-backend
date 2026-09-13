import { SMSService } from './sms.service';
import { EmailService } from './email.service';
import { logger } from '../utils/logger.util';

export interface NotificationOptions {
  sms?: boolean;
  email?: boolean;
}

export interface NotificationResult {
  sms?: {
    success: boolean;
    error?: string;
  };
  email?: {
    success: boolean;
    error?: string;
  };
}

/**
 * Unified notification service that handles both SMS and Email notifications
 */
export class NotificationService {
  /**
   * Initialize all notification services
   */
  static initialize(): void {
    SMSService.initialize();
    EmailService.initialize();
    logger.info('Notification services initialized');
  }

  /**
   * Send welcome notification
   */
  static async sendWelcome(
    phoneNumber: string,
    email: string,
    firstName: string,
    options: NotificationOptions = { sms: true, email: true }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (options.sms && SMSService.isAvailable()) {
      const smsResult = await SMSService.sendWelcomeMessage(phoneNumber, firstName);
      result.sms = {
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    if (options.email && EmailService.isAvailable()) {
      const emailResult = await EmailService.sendWelcomeEmail(email, firstName);
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Send verification code
   */
  static async sendVerificationCode(
    phoneNumber: string,
    email: string,
    firstName: string,
    code: string,
    options: NotificationOptions = { sms: true, email: true }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (options.sms && SMSService.isAvailable()) {
      const smsResult = await SMSService.sendVerificationCode(phoneNumber, code);
      result.sms = {
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    if (options.email && EmailService.isAvailable()) {
      const emailResult = await EmailService.sendVerificationEmail(email, firstName, code);
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Send payment notification
   */
  static async sendPaymentNotification(
    phoneNumber: string,
    email: string,
    firstName: string,
    amount: number,
    currency: string,
    transactionId: string,
    options: NotificationOptions = { sms: true, email: true }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (options.sms && SMSService.isAvailable()) {
      const smsResult = await SMSService.sendPaymentNotification(
        phoneNumber,
        amount,
        currency
      );
      result.sms = {
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    if (options.email && EmailService.isAvailable()) {
      const emailResult = await EmailService.sendPaymentNotification(
        email,
        firstName,
        amount,
        currency,
        transactionId
      );
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Send collection verified notification
   */
  static async sendCollectionVerified(
    phoneNumber: string,
    email: string,
    firstName: string,
    collectionId: string,
    amount: number,
    currency: string,
    materialType: string,
    weight: number,
    options: NotificationOptions = { sms: true, email: true }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (options.sms && SMSService.isAvailable()) {
      const smsResult = await SMSService.sendCollectionVerified(
        phoneNumber,
        amount,
        currency
      );
      result.sms = {
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    if (options.email && EmailService.isAvailable()) {
      const emailResult = await EmailService.sendCollectionVerified(
        email,
        firstName,
        collectionId,
        amount,
        currency,
        materialType,
        weight
      );
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Send KYC approved notification
   */
  static async sendKYCApproved(
    phoneNumber: string,
    email: string,
    firstName: string,
    options: NotificationOptions = { sms: true, email: true }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (options.sms && SMSService.isAvailable()) {
      const smsResult = await SMSService.sendKYCApproved(phoneNumber, firstName);
      result.sms = {
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    if (options.email && EmailService.isAvailable()) {
      const emailResult = await EmailService.sendKYCApproved(email, firstName);
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Send KYC rejected notification
   */
  static async sendKYCRejected(
    phoneNumber: string,
    email: string,
    firstName: string,
    reason?: string,
    options: NotificationOptions = { sms: true, email: true }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (options.sms && SMSService.isAvailable()) {
      const smsResult = await SMSService.sendKYCRejected(phoneNumber, firstName, reason);
      result.sms = {
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    if (options.email && EmailService.isAvailable()) {
      const emailResult = await EmailService.sendKYCRejected(email, firstName, reason);
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Send withdrawal confirmation notification
   */
  static async sendWithdrawalConfirmation(
    phoneNumber: string,
    email: string,
    firstName: string,
    amount: number,
    currency: string,
    withdrawalPhoneNumber: string,
    transactionId: string,
    options: NotificationOptions = { sms: true, email: true }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (options.sms && SMSService.isAvailable()) {
      const smsResult = await SMSService.sendWithdrawalConfirmation(
        phoneNumber,
        amount,
        currency
      );
      result.sms = {
        success: smsResult.success,
        error: smsResult.error,
      };
    }

    if (options.email && EmailService.isAvailable()) {
      const emailResult = await EmailService.sendWithdrawalConfirmation(
        email,
        firstName,
        amount,
        currency,
        withdrawalPhoneNumber,
        transactionId
      );
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Send password reset notification
   */
  static async sendPasswordReset(
    email: string,
    firstName: string,
    resetToken: string,
    resetUrl: string
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};

    if (EmailService.isAvailable()) {
      const emailResult = await EmailService.sendPasswordResetEmail(
        email,
        firstName,
        resetToken,
        resetUrl
      );
      result.email = {
        success: emailResult.success,
        error: emailResult.error,
      };
    }

    return result;
  }

  /**
   * Check which notification channels are available
   */
  static getAvailableChannels(): { sms: boolean; email: boolean } {
    return {
      sms: SMSService.isAvailable(),
      email: EmailService.isAvailable(),
    };
  }
}
