import axios from 'axios';
import { logger } from '../../utils/logger.util';

export interface MPesaConfig {
  consumerKey: string;
  consumerSecret: string;
  environment: 'sandbox' | 'production';
  businessShortCode: string;
  passkey: string;
  callbackUrl: string;
}

export interface MPesaPaymentRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface MPesaPaymentResponse {
  success: boolean;
  merchantRequestID?: string;
  checkoutRequestID?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  error?: string;
}

export class MPesaService {
  private config: MPesaConfig;
  private baseUrl: string;

  constructor(config: MPesaConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString(
        'base64'
      );

      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      logger.error('M-Pesa: Failed to get access token', { error: error as Error });
      throw new Error('Failed to authenticate with M-Pesa');
    }
  }

  /**
   * Generate timestamp (YYYYMMDDHHmmss)
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate password for STK push
   */
  private generatePassword(timestamp: string): string {
    const data = `${this.config.businessShortCode}${this.config.passkey}${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Format phone number to M-Pesa format (254XXXXXXXXX)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove + if present
    let formatted = phoneNumber.replace('+', '');

    // If starts with 0, replace with 254
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.substring(1);
    }

    // If doesn't start with 254, add it
    if (!formatted.startsWith('254')) {
      formatted = '254' + formatted;
    }

    return formatted;
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   */
  async stkPush(request: MPesaPaymentRequest): Promise<MPesaPaymentResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);
      const phoneNumber = this.formatPhoneNumber(request.phoneNumber);

      const payload = {
        BusinessShortCode: this.config.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount), // M-Pesa requires integer
        PartyA: phoneNumber,
        PartyB: this.config.businessShortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: this.config.callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.transactionDesc,
      };

      logger.info('M-Pesa: Initiating STK push', {
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
        amount: request.amount,
        reference: request.accountReference,
      });

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.ResponseCode === '0') {
        logger.info('M-Pesa: STK push successful', {
          merchantRequestID: response.data.MerchantRequestID,
          checkoutRequestID: response.data.CheckoutRequestID,
        });

        return {
          success: true,
          merchantRequestID: response.data.MerchantRequestID,
          checkoutRequestID: response.data.CheckoutRequestID,
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
          customerMessage: response.data.CustomerMessage,
        };
      } else {
        logger.warn('M-Pesa: STK push failed', {
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
        });

        return {
          success: false,
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
          error: response.data.ResponseDescription,
        };
      }
    } catch (error: any) {
      logger.error('M-Pesa: STK push error', {
        error: error as Error,
        response: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.errorMessage || 'M-Pesa payment failed',
      };
    }
  }

  /**
   * Query STK push status
   */
  async queryTransaction(checkoutRequestID: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      const payload = {
        BusinessShortCode: this.config.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID,
      };

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('M-Pesa: Query transaction error', {
        error: error as Error,
        checkoutRequestID,
      });

      throw new Error('Failed to query transaction status');
    }
  }

  /**
   * B2C Payment (Business to Customer) - For withdrawals
   */
  async b2cPayment(
    phoneNumber: string,
    amount: number,
    remarks: string
  ): Promise<MPesaPaymentResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const payload = {
        InitiatorName: 'WasteFi', // Your initiator name
        SecurityCredential: '', // Encrypted security credential (TODO: Implement)
        CommandID: 'BusinessPayment',
        Amount: Math.round(amount),
        PartyA: this.config.businessShortCode,
        PartyB: formattedPhone,
        Remarks: remarks,
        QueueTimeOutURL: this.config.callbackUrl + '/timeout',
        ResultURL: this.config.callbackUrl + '/result',
        Occasion: 'Withdrawal',
      };

      logger.info('M-Pesa: Initiating B2C payment', {
        phoneNumber: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
        amount,
      });

      const response = await axios.post(`${this.baseUrl}/mpesa/b2c/v1/paymentrequest`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
        };
      } else {
        return {
          success: false,
          error: response.data.ResponseDescription,
        };
      }
    } catch (error: any) {
      logger.error('M-Pesa: B2C payment error', {
        error: error as Error,
        response: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.errorMessage || 'B2C payment failed',
      };
    }
  }

  /**
   * Process callback from M-Pesa
   */
  static processCallback(callbackData: any): {
    success: boolean;
    transactionId?: string;
    amount?: number;
    phoneNumber?: string;
    error?: string;
  } {
    try {
      const resultCode = callbackData.Body?.stkCallback?.ResultCode;

      if (resultCode === 0) {
        const metadata = callbackData.Body.stkCallback.CallbackMetadata?.Item || [];
        const getMetadataValue = (name: string) => {
          const item = metadata.find((item: any) => item.Name === name);
          return item ? item.Value : null;
        };

        return {
          success: true,
          transactionId: getMetadataValue('MpesaReceiptNumber'),
          amount: getMetadataValue('Amount'),
          phoneNumber: getMetadataValue('PhoneNumber'),
        };
      } else {
        return {
          success: false,
          error: callbackData.Body?.stkCallback?.ResultDesc || 'Payment failed',
        };
      }
    } catch (error) {
      logger.error('M-Pesa: Callback processing error', { error: error as Error });
      return {
        success: false,
        error: 'Failed to process callback',
      };
    }
  }
}
