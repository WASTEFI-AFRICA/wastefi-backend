import axios from 'axios';
import { logger } from '../../utils/logger.util';

export interface AirtelConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  callbackUrl: string;
}

export interface AirtelPaymentRequest {
  phoneNumber: string;
  amount: number;
  currency: string;
  transactionId: string;
  reference: string;
}

export interface AirtelPaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
}

export class AirtelService {
  private config: AirtelConfig;
  private baseUrl: string;

  constructor(config: AirtelConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'production'
        ? 'https://openapiuat.airtel.africa'
        : 'https://openapiuat.airtel.africa'; // Airtel uses same URL for both
  }

  /**
   * Get access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const payload = {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
      };

      const response = await axios.post(`${this.baseUrl}/auth/oauth2/token`, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Airtel: Failed to get access token', { error: error as Error });
      throw new Error('Failed to authenticate with Airtel');
    }
  }

  /**
   * Format phone number for Airtel
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove + and spaces
    let formatted = phoneNumber.replace(/[\+\s]/g, '');

    // Airtel expects country code without +
    // Example: 254XXXXXXXXX for Kenya
    return formatted;
  }

  /**
   * Initiate payment (Push Payment)
   */
  async initiatePayment(request: AirtelPaymentRequest): Promise<AirtelPaymentResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(request.phoneNumber);

      const payload = {
        reference: request.reference,
        subscriber: {
          country: 'KE', // Kenya - adjust based on your deployment
          currency: request.currency,
          msisdn: phoneNumber,
        },
        transaction: {
          amount: request.amount,
          country: 'KE',
          currency: request.currency,
          id: request.transactionId,
        },
      };

      logger.info('Airtel: Initiating payment', {
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
        amount: request.amount,
        transactionId: request.transactionId,
      });

      const response = await axios.post(
        `${this.baseUrl}/merchant/v1/payments/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Country': 'KE',
            'X-Currency': request.currency,
          },
        }
      );

      if (response.data.status?.success) {
        logger.info('Airtel: Payment initiated successfully', {
          transactionId: request.transactionId,
        });

        return {
          success: true,
          transactionId: request.transactionId,
          status: response.data.status.response_code,
        };
      } else {
        return {
          success: false,
          error: response.data.status?.message || 'Payment initiation failed',
        };
      }
    } catch (error: any) {
      logger.error('Airtel: Payment initiation error', {
        error: error as Error,
        response: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.status?.message || 'Airtel payment failed',
      };
    }
  }

  /**
   * Query transaction status
   */
  async queryTransaction(transactionId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/standard/v1/payments/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Country': 'KE',
            'X-Currency': 'KES',
          },
        }
      );

      return {
        success: true,
        status: response.data.status,
        transaction: response.data.data?.transaction,
      };
    } catch (error) {
      logger.error('Airtel: Query transaction error', {
        error: error as Error,
        transactionId,
      });

      throw new Error('Failed to query transaction status');
    }
  }

  /**
   * Disburse funds (for withdrawals)
   */
  async disburse(
    phoneNumber: string,
    amount: number,
    currency: string,
    transactionId: string,
    reference: string
  ): Promise<AirtelPaymentResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const payload = {
        payee: {
          msisdn: formattedPhone,
        },
        reference: reference,
        transaction: {
          amount: amount,
          id: transactionId,
        },
      };

      logger.info('Airtel: Initiating disbursement', {
        phoneNumber: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
        amount,
        transactionId,
      });

      const response = await axios.post(
        `${this.baseUrl}/standard/v1/disbursements/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Country': 'KE',
            'X-Currency': currency,
          },
        }
      );

      if (response.data.status?.success) {
        return {
          success: true,
          transactionId,
          status: 'PENDING',
        };
      } else {
        return {
          success: false,
          error: response.data.status?.message || 'Disbursement failed',
        };
      }
    } catch (error: any) {
      logger.error('Airtel: Disbursement error', {
        error: error as Error,
        response: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.status?.message || 'Airtel disbursement failed',
      };
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ balance: string; currency: string } | null> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(`${this.baseUrl}/standard/v1/users/balance`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Country': 'KE',
          'X-Currency': 'KES',
        },
      });

      return {
        balance: response.data.data.balance,
        currency: response.data.data.currency,
      };
    } catch (error) {
      logger.error('Airtel: Get balance error', { error: error as Error });
      return null;
    }
  }
}
