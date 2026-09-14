import { MPesaService, MPesaConfig } from './mpesa.service';
import { MTNService, MTNConfig } from './mtn.service';
import { AirtelService, AirtelConfig } from './airtel.service';
import { PaymentMethod } from '@prisma/client';
import { logger } from '../../utils/logger.util';

export interface MobileMoneyPaymentRequest {
  provider: PaymentMethod;
  phoneNumber: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
}

export interface MobileMoneyPaymentResponse {
  success: boolean;
  referenceId?: string;
  transactionId?: string;
  status?: string;
  error?: string;
  provider?: string;
}

export class MobileMoneyService {
  private static mpesaService: MPesaService | null = null;
  private static mtnService: MTNService | null = null;
  private static airtelService: AirtelService | null = null;

  /**
   * Initialize mobile money services
   */
  static initialize(): void {
    // Initialize M-Pesa
    if (process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET) {
      const mpesaConfig: MPesaConfig = {
        consumerKey: process.env.MPESA_CONSUMER_KEY,
        consumerSecret: process.env.MPESA_CONSUMER_SECRET,
        environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
        businessShortCode: process.env.MPESA_SHORTCODE || '',
        passkey: process.env.MPESA_PASSKEY || '',
        callbackUrl: process.env.MPESA_CALLBACK_URL || '',
      };

      this.mpesaService = new MPesaService(mpesaConfig);
      logger.info('M-Pesa service initialized');
    }

    // Initialize MTN
    if (process.env.MTN_API_KEY) {
      const mtnConfig: MTNConfig = {
        apiKey: process.env.MTN_API_KEY,
        userId: process.env.MTN_USER_ID || '',
        apiSecret: process.env.MTN_API_SECRET || '',
        environment: (process.env.MTN_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
        callbackUrl: process.env.MTN_CALLBACK_URL || '',
        subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY || '',
      };

      this.mtnService = new MTNService(mtnConfig);
      logger.info('MTN service initialized');
    }

    // Initialize Airtel
    if (process.env.AIRTEL_CLIENT_ID) {
      const airtelConfig: AirtelConfig = {
        clientId: process.env.AIRTEL_CLIENT_ID,
        clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
        environment: (process.env.AIRTEL_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
        callbackUrl: process.env.AIRTEL_CALLBACK_URL || '',
      };

      this.airtelService = new AirtelService(airtelConfig);
      logger.info('Airtel service initialized');
    }
  }

  /**
   * Process mobile money payment
   */
  static async processPayment(
    request: MobileMoneyPaymentRequest
  ): Promise<MobileMoneyPaymentResponse> {
    try {
      switch (request.provider) {
        case PaymentMethod.MPESA:
          return await this.processMPesaPayment(request);
        case PaymentMethod.MTN_MONEY:
          return await this.processMTNPayment(request);
        case PaymentMethod.AIRTEL_MONEY:
          return await this.processAirtelPayment(request);
        default:
          return {
            success: false,
            error: 'Unsupported payment provider',
          };
      }
    } catch (error) {
      logger.error('Mobile money payment error', {
        error: error as Error,
        provider: request.provider,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }

  /**
   * Process M-Pesa payment
   */
  private static async processMPesaPayment(
    request: MobileMoneyPaymentRequest
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.mpesaService) {
      return {
        success: false,
        error: 'M-Pesa service not configured',
      };
    }

    const result = await this.mpesaService.stkPush({
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      accountReference: request.reference,
      transactionDesc: request.description,
    });

    return {
      success: result.success,
      referenceId: result.checkoutRequestID,
      transactionId: result.merchantRequestID,
      status: result.success ? 'PENDING' : 'FAILED',
      error: result.error,
      provider: 'MPESA',
    };
  }

  /**
   * Process MTN payment
   */
  private static async processMTNPayment(
    request: MobileMoneyPaymentRequest
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.mtnService) {
      return {
        success: false,
        error: 'MTN service not configured',
      };
    }

    const result = await this.mtnService.requestToPay({
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      currency: request.currency,
      externalId: request.reference,
      payerMessage: request.description,
      payeeNote: request.description,
    });

    return {
      success: result.success,
      referenceId: result.referenceId,
      status: result.status,
      error: result.error,
      provider: 'MTN_MONEY',
    };
  }

  /**
   * Process Airtel payment
   */
  private static async processAirtelPayment(
    request: MobileMoneyPaymentRequest
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.airtelService) {
      return {
        success: false,
        error: 'Airtel service not configured',
      };
    }

    const result = await this.airtelService.initiatePayment({
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      currency: request.currency,
      transactionId: request.reference,
      reference: request.reference,
    });

    return {
      success: result.success,
      transactionId: result.transactionId,
      status: result.status,
      error: result.error,
      provider: 'AIRTEL_MONEY',
    };
  }

  /**
   * Process withdrawal (disbursement)
   */
  static async processWithdrawal(
    provider: PaymentMethod,
    phoneNumber: string,
    amount: number,
    currency: string,
    reference: string
  ): Promise<MobileMoneyPaymentResponse> {
    try {
      switch (provider) {
        case PaymentMethod.MPESA:
          return await this.processMPesaWithdrawal(phoneNumber, amount, reference);
        case PaymentMethod.MTN_MONEY:
          return await this.processMTNWithdrawal(phoneNumber, amount, currency, reference);
        case PaymentMethod.AIRTEL_MONEY:
          return await this.processAirtelWithdrawal(phoneNumber, amount, currency, reference);
        default:
          return {
            success: false,
            error: 'Unsupported withdrawal provider',
          };
      }
    } catch (error) {
      logger.error('Mobile money withdrawal error', {
        error: error as Error,
        provider,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Withdrawal failed',
      };
    }
  }

  /**
   * M-Pesa withdrawal
   */
  private static async processMPesaWithdrawal(
    phoneNumber: string,
    amount: number,
    reference: string
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.mpesaService) {
      return {
        success: false,
        error: 'M-Pesa service not configured',
      };
    }

    const result = await this.mpesaService.b2cPayment(
      phoneNumber,
      amount,
      `Withdrawal: ${reference}`
    );

    return {
      success: result.success,
      status: result.success ? 'PENDING' : 'FAILED',
      error: result.error,
      provider: 'MPESA',
    };
  }

  /**
   * MTN withdrawal
   */
  private static async processMTNWithdrawal(
    phoneNumber: string,
    amount: number,
    currency: string,
    reference: string
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.mtnService) {
      return {
        success: false,
        error: 'MTN service not configured',
      };
    }

    const result = await this.mtnService.transfer(
      phoneNumber,
      amount,
      currency,
      `Withdrawal: ${reference}`
    );

    return {
      success: result.success,
      referenceId: result.referenceId,
      status: result.status,
      error: result.error,
      provider: 'MTN_MONEY',
    };
  }

  /**
   * Airtel withdrawal
   */
  private static async processAirtelWithdrawal(
    phoneNumber: string,
    amount: number,
    currency: string,
    reference: string
  ): Promise<MobileMoneyPaymentResponse> {
    if (!this.airtelService) {
      return {
        success: false,
        error: 'Airtel service not configured',
      };
    }

    const result = await this.airtelService.disburse(
      phoneNumber,
      amount,
      currency,
      reference,
      reference
    );

    return {
      success: result.success,
      transactionId: result.transactionId,
      status: result.status,
      error: result.error,
      provider: 'AIRTEL_MONEY',
    };
  }

  /**
   * Check if provider is available
   */
  static isProviderAvailable(provider: PaymentMethod): boolean {
    switch (provider) {
      case PaymentMethod.MPESA:
        return this.mpesaService !== null;
      case PaymentMethod.MTN_MONEY:
        return this.mtnService !== null;
      case PaymentMethod.AIRTEL_MONEY:
        return this.airtelService !== null;
      default:
        return false;
    }
  }
}
