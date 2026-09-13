import { prisma } from './database.service';
import { StellarService } from './stellar.service';
import { TransactionStatus, TransactionType, PaymentMethod } from '@prisma/client';
import { logger } from '../utils/logger.util';

export interface ProcessPaymentData {
  userId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transaction?: any;
  error?: string;
  transactionHash?: string;
}

export class PaymentService {
  /**
   * Process payment for waste collection
   */
  static async processCollectionPayment(collectionId: string): Promise<PaymentResult> {
    try {
      // Get collection details
      const collection = await prisma.wasteCollection.findUnique({
        where: { id: collectionId },
        include: {
          collector: true,
          collectionPoint: true,
        },
      });

      if (!collection) {
        return {
          success: false,
          error: 'Collection not found',
        };
      }

      if (collection.paymentStatus === TransactionStatus.COMPLETED) {
        return {
          success: false,
          error: 'Payment already completed',
        };
      }

      if (!collection.verifiedAt) {
        return {
          success: false,
          error: 'Collection not yet verified',
        };
      }

      // Convert KES to XLM
      const xlmAmount = await StellarService.convertKEStoXLM(collection.paymentAmount);

      // Process payment via Stellar
      const stellarResult = await StellarService.processWasteCollectionPayment(
        collection.collectorId,
        xlmAmount,
        collectionId
      );

      if (!stellarResult.success) {
        // Update collection status to FAILED
        await prisma.wasteCollection.update({
          where: { id: collectionId },
          data: { paymentStatus: TransactionStatus.FAILED },
        });

        return {
          success: false,
          error: stellarResult.error || 'Payment failed',
        };
      }

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId: collection.collectorId,
          amount: collection.paymentAmount,
          currency: collection.paymentCurrency,
          type: TransactionType.WASTE_COLLECTION,
          status: TransactionStatus.COMPLETED,
          paymentMethod: PaymentMethod.STELLAR,
          stellarTxHash: stellarResult.transactionHash,
          description: `Payment for waste collection at ${collection.collectionPoint.name}`,
          metadata: JSON.stringify({
            collectionId,
            materialType: collection.materialType,
            weight: collection.weight,
            xlmAmount,
          }),
          completedAt: new Date(),
        },
      });

      // Update collection payment status
      await prisma.wasteCollection.update({
        where: { id: collectionId },
        data: {
          paymentStatus: TransactionStatus.COMPLETED,
          transactionId: transaction.id,
        },
      });

      logger.transaction(
        'WASTE_COLLECTION',
        `${collection.paymentAmount} ${collection.paymentCurrency}`,
        {
          collectionId,
          transactionId: transaction.id,
          stellarTxHash: stellarResult.transactionHash,
          userId: collection.collectorId,
        }
      );

      return {
        success: true,
        transaction,
        transactionHash: stellarResult.transactionHash,
      };
    } catch (error) {
      logger.error('Payment processing failed', {
        error: error as Error,
        collectionId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }

  /**
   * Process generic payment
   */
  static async processPayment(data: ProcessPaymentData): Promise<PaymentResult> {
    try {
      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId: data.userId,
          amount: data.amount,
          currency: data.currency,
          type: data.type,
          status: TransactionStatus.PENDING,
          paymentMethod: data.paymentMethod,
          description: data.description,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
      });

      // Process based on payment method
      let result: PaymentResult;

      switch (data.paymentMethod) {
        case PaymentMethod.STELLAR:
          result = await this.processStellarPayment(transaction.id, data);
          break;
        case PaymentMethod.MPESA:
        case PaymentMethod.MTN_MONEY:
        case PaymentMethod.AIRTEL_MONEY:
          result = await this.processMobileMoneyPayment(transaction.id, data);
          break;
        default:
          result = {
            success: false,
            error: 'Unsupported payment method',
          };
      }

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: result.success ? TransactionStatus.COMPLETED : TransactionStatus.FAILED,
          completedAt: result.success ? new Date() : null,
          failureReason: result.error,
        },
      });

      return {
        ...result,
        transaction: await prisma.transaction.findUnique({
          where: { id: transaction.id },
        }),
      };
    } catch (error) {
      logger.error('Payment processing failed', {
        error: error as Error,
        userId: data.userId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  /**
   * Process Stellar payment
   */
  private static async processStellarPayment(
    transactionId: string,
    data: ProcessPaymentData
  ): Promise<PaymentResult> {
    try {
      // Get user wallet
      const wallet = await StellarService.getUserWallet(data.userId);
      if (!wallet) {
        return {
          success: false,
          error: 'User wallet not found',
        };
      }

      // Convert to XLM if needed
      const xlmAmount =
        data.currency === 'XLM'
          ? data.amount.toString()
          : await StellarService.convertKEStoXLM(data.amount);

      // Send payment
      const result = await StellarService.processWasteCollectionPayment(
        data.userId,
        xlmAmount,
        transactionId
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        transactionHash: result.transactionHash,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stellar payment failed',
      };
    }
  }

  /**
   * Process mobile money payment (stub for now)
   */
  private static async processMobileMoneyPayment(
    transactionId: string,
    data: ProcessPaymentData
  ): Promise<PaymentResult> {
    // TODO: Implement mobile money integration in Commit 10
    logger.info('Mobile money payment requested', {
      transactionId,
      paymentMethod: data.paymentMethod,
    });

    return {
      success: false,
      error: 'Mobile money integration coming soon',
    };
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(transactionId: string) {
    return prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  /**
   * Get user transaction history
   */
  static async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    // Calculate summary
    const summary = await prisma.transaction.aggregate({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalTransactions: summary._count,
        totalAmount: summary._sum.amount || 0,
      },
    };
  }

  /**
   * Retry failed payment
   */
  static async retryPayment(transactionId: string): Promise<PaymentResult> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return {
        success: false,
        error: 'Transaction not found',
      };
    }

    if (transaction.status !== TransactionStatus.FAILED) {
      return {
        success: false,
        error: 'Can only retry failed transactions',
      };
    }

    // Reset status to PENDING
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.PENDING,
        failureReason: null,
      },
    });

    // Process payment again
    const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {};

    return this.processPayment({
      userId: transaction.userId,
      amount: transaction.amount,
      currency: transaction.currency,
      type: transaction.type,
      paymentMethod: transaction.paymentMethod,
      description: transaction.description || undefined,
      metadata,
    });
  }

  /**
   * Process withdrawal request
   */
  static async processWithdrawal(
    userId: string,
    amount: number,
    phoneNumber: string,
    paymentMethod: PaymentMethod
  ): Promise<PaymentResult> {
    try {
      // Check user balance
      const wallet = await StellarService.getUserWallet(userId);
      if (!wallet) {
        return {
          success: false,
          error: 'Wallet not found',
        };
      }

      const balances = await StellarService.getBalance(wallet.publicKey);
      const xlmBalance = parseFloat(balances[0]?.balance || '0');

      // Convert withdrawal amount to XLM
      const xlmAmount = await StellarService.convertKEStoXLM(amount);
      const xlmAmountNum = parseFloat(xlmAmount);

      if (xlmBalance < xlmAmountNum) {
        return {
          success: false,
          error: 'Insufficient balance',
        };
      }

      // Create withdrawal transaction
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount,
          currency: 'KES',
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PROCESSING,
          paymentMethod,
          phoneNumber,
          description: `Withdrawal to ${paymentMethod} - ${phoneNumber}`,
          metadata: JSON.stringify({
            xlmAmount,
            paymentMethod,
            phoneNumber,
          }),
        },
      });

      // TODO: Process actual withdrawal via mobile money in Commit 10
      // For now, mark as pending
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.PENDING,
        },
      });

      logger.info('Withdrawal requested', {
        transactionId: transaction.id,
        userId,
        amount,
        paymentMethod,
      });

      return {
        success: true,
        transaction,
      };
    } catch (error) {
      logger.error('Withdrawal processing failed', {
        error: error as Error,
        userId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Withdrawal failed',
      };
    }
  }

  /**
   * Get payment statistics
   */
  static async getPaymentStatistics(startDate?: Date, endDate?: Date) {
    const where: any = {
      status: TransactionStatus.COMPLETED,
    };

    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt.gte = startDate;
      if (endDate) where.completedAt.lte = endDate;
    }

    const [totalVolume, byType, byMethod, recentTransactions] = await Promise.all([
      prisma.transaction.aggregate({
        where,
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      prisma.transaction.findMany({
        where,
        take: 10,
        orderBy: { completedAt: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return {
      totalVolume: totalVolume._sum.amount || 0,
      totalCount: totalVolume._count,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = {
          count: item._count,
          volume: item._sum.amount || 0,
        };
        return acc;
      }, {} as Record<string, any>),
      byMethod: byMethod.reduce((acc, item) => {
        acc[item.paymentMethod] = {
          count: item._count,
          volume: item._sum.amount || 0,
        };
        return acc;
      }, {} as Record<string, any>),
      recentTransactions,
    };
  }

  /**
   * Cancel pending transaction
   */
  static async cancelTransaction(transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Can only cancel pending transactions');
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.CANCELLED,
        failureReason: 'Cancelled by user',
      },
    });

    logger.info('Transaction cancelled', { transactionId });
  }
}
