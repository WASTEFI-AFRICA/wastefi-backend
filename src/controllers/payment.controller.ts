import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { PaymentService } from '../services/payment.service';
import { PaymentMethod } from '@prisma/client';
import { logger } from '../utils/logger.util';

export class PaymentController {
  /**
   * Process payment for collection
   */
  static async processCollectionPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { collectionId } = req.body;

      if (!collectionId) {
        res.status(400).json({
          success: false,
          error: 'Collection ID is required',
        });
        return;
      }

      const result = await PaymentService.processCollectionPayment(collectionId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.transaction,
        message: 'Payment processed successfully',
      });
    } catch (error) {
      logger.error('Payment processing failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to process payment',
      });
    }
  }

  /**
   * Get transaction by ID
   */
  static async getTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const transaction = await PaymentService.getTransactionById(id);

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error('Failed to get transaction', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction',
      });
    }
  }

  /**
   * Get user transaction history
   */
  static async getUserTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { page = 1, limit = 20 } = req.query;

      const result = await PaymentService.getUserTransactions(
        req.user.userId,
        Number(page),
        Number(limit)
      );

      res.status(200).json({
        success: true,
        data: result.transactions,
        pagination: result.pagination,
        summary: result.summary,
      });
    } catch (error) {
      logger.error('Failed to get transactions', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
      });
    }
  }

  /**
   * Retry failed payment
   */
  static async retryPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await PaymentService.retryPayment(id);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.transaction,
        message: 'Payment retry successful',
      });
    } catch (error) {
      logger.error('Payment retry failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to retry payment',
      });
    }
  }

  /**
   * Request withdrawal
   */
  static async requestWithdrawal(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { amount, phoneNumber, paymentMethod } = req.body;

      const result = await PaymentService.processWithdrawal(
        req.user.userId,
        amount,
        phoneNumber,
        paymentMethod
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.transaction,
        message: 'Withdrawal request submitted successfully',
      });
    } catch (error) {
      logger.error('Withdrawal request failed', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to process withdrawal request',
      });
    }
  }

  /**
   * Get payment statistics (Admin only)
   */
  static async getStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const stats = await PaymentService.getPaymentStatistics(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get payment statistics', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }

  /**
   * Cancel transaction
   */
  static async cancelTransaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await PaymentService.cancelTransaction(id);

      res.status(200).json({
        success: true,
        message: 'Transaction cancelled successfully',
      });
    } catch (error) {
      logger.error('Failed to cancel transaction', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to cancel transaction',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * M-Pesa callback handler
   */
  static async mpesaCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('M-Pesa callback received', { body: req.body });

      await PaymentService.processMobileMoneyCallback(PaymentMethod.MPESA, req.body);

      // M-Pesa expects a response
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });
    } catch (error) {
      logger.error('M-Pesa callback processing failed', { error: error as Error });
      res.status(200).json({
        ResultCode: 1,
        ResultDesc: 'Failed',
      });
    }
  }

  /**
   * MTN Money callback handler
   */
  static async mtnCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('MTN callback received', { body: req.body });

      await PaymentService.processMobileMoneyCallback(PaymentMethod.MTN_MONEY, req.body);

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      logger.error('MTN callback processing failed', { error: error as Error });
      res.status(200).json({
        success: false,
      });
    }
  }

  /**
   * Airtel Money callback handler
   */
  static async airtelCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Airtel callback received', { body: req.body });

      await PaymentService.processMobileMoneyCallback(PaymentMethod.AIRTEL_MONEY, req.body);

      res.status(200).json({
        status: 'SUCCESS',
        message: 'Callback processed',
      });
    } catch (error) {
      logger.error('Airtel callback processing failed', { error: error as Error });
      res.status(200).json({
        status: 'FAILED',
        message: 'Callback processing failed',
      });
    }
  }
}
