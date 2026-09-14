import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.util';

export interface MTNConfig {
  apiKey: string;
  userId: string;
  apiSecret: string;
  environment: 'sandbox' | 'production';
  callbackUrl: string;
  subscriptionKey: string;
}

export interface MTNPaymentRequest {
  phoneNumber: string;
  amount: number;
  currency: string;
  externalId: string;
  payerMessage: string;
  payeeNote: string;
}

export interface MTNPaymentResponse {
  success: boolean;
  referenceId?: string;
  error?: string;
  status?: string;
}

export class MTNService {
  private config: MTNConfig;
  private baseUrl: string;

  constructor(config: MTNConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'production'
        ? 'https://proxy.momoapi.mtn.com'
        : 'https://sandbox.momodeveloper.mtn.com';
  }

  /**
   * Get access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(`${this.config.userId}:${this.config.apiSecret}`).toString('base64');

      const response = await axios.post(
        `${this.baseUrl}/collection/token/`,
        {},
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      logger.error('MTN: Failed to get access token', { error: error as Error });
      throw new Error('Failed to authenticate with MTN');
    }
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove spaces and special characters
    let formatted = phoneNumber.replace(/[\s\-()]/g, '');

    // Add + if not present
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }

    return formatted;
  }

  /**
   * Request to pay (collect payment from customer)
   */
  async requestToPay(request: MTNPaymentRequest): Promise<MTNPaymentResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const referenceId = uuidv4();
      const phoneNumber = this.formatPhoneNumber(request.phoneNumber);

      const payload = {
        amount: request.amount.toString(),
        currency: request.currency,
        externalId: request.externalId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber.replace('+', ''),
        },
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };

      logger.info('MTN: Initiating payment request', {
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
        amount: request.amount,
        referenceId,
      });

      await axios.post(`${this.baseUrl}/collection/v1_0/requesttopay`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.config.environment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/json',
        },
      });

      logger.info('MTN: Payment request initiated', { referenceId });

      return {
        success: true,
        referenceId,
        status: 'PENDING',
      };
    } catch (error: any) {
      logger.error('MTN: Payment request error', {
        error: error as Error,
        response: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.message || 'MTN payment request failed',
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(referenceId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Target-Environment': this.config.environment,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      return {
        success: true,
        status: response.data.status,
        financialTransactionId: response.data.financialTransactionId,
        amount: response.data.amount,
        currency: response.data.currency,
      };
    } catch (error) {
      logger.error('MTN: Get payment status error', {
        error: error as Error,
        referenceId,
      });

      throw new Error('Failed to get payment status');
    }
  }

  /**
   * Transfer money (for withdrawals)
   */
  async transfer(
    phoneNumber: string,
    amount: number,
    currency: string,
    payeeNote: string
  ): Promise<MTNPaymentResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const referenceId = uuidv4();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const payload = {
        amount: amount.toString(),
        currency: currency,
        externalId: uuidv4(),
        payee: {
          partyIdType: 'MSISDN',
          partyId: formattedPhone.replace('+', ''),
        },
        payerMessage: 'Withdrawal from WasteFi',
        payeeNote: payeeNote,
      };

      logger.info('MTN: Initiating transfer', {
        phoneNumber: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
        amount,
        referenceId,
      });

      await axios.post(`${this.baseUrl}/disbursement/v1_0/transfer`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.config.environment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: true,
        referenceId,
        status: 'PENDING',
      };
    } catch (error: any) {
      logger.error('MTN: Transfer error', {
        error: error as Error,
        response: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.message || 'MTN transfer failed',
      };
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ availableBalance: string; currency: string } | null> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(`${this.baseUrl}/collection/v1_0/account/balance`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Target-Environment': this.config.environment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
        },
      });

      return {
        availableBalance: response.data.availableBalance,
        currency: response.data.currency,
      };
    } catch (error) {
      logger.error('MTN: Get balance error', { error: error as Error });
      return null;
    }
  }
}
