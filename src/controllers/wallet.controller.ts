import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { StellarService } from '../services/stellar.service';
import { SorobanService, ScArg } from '../services/soroban.service';
import { prisma } from '../services/database.service';
import { config } from '../config';

export class WalletController {
  /**
   * Create or get user's Stellar wallet
   */
  static async createWallet(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const wallet = await StellarService.createUserWallet(req.user.userId);

      res.status(200).json({
        success: true,
        data: {
          publicKey: wallet.publicKey,
          network: 'testnet',
          message: 'Wallet created and funded on testnet',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get wallet balance
   */
  static async getBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const wallet = await StellarService.getUserWallet(req.user.userId);
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'Wallet not found',
          message: 'Please create a wallet first',
        });
        return;
      }

      const balances = await StellarService.getBalance(wallet.publicKey);

      res.status(200).json({
        success: true,
        data: {
          publicKey: wallet.publicKey,
          balances,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch balance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get transaction history
   */
  /**
   * The user's WASTE balance, read from the token contract rather than summed from
   * the database, so it is exactly what the chain says. A user without a wallet yet
   * (nothing approved so far) has a balance of zero and no address.
   */
  static async getWasteBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { stellarPublicKey: true },
      });
      const address = user?.stellarPublicKey ?? null;
      const explorer = (path: string) => `${config.soroban.explorerUrl}/${path}`;

      if (!address) {
        res.status(200).json({
          success: true,
          data: { address: null, balance: '0', explorerUrl: null },
        });
        return;
      }
      if (!SorobanService.enabled) {
        res.status(503).json({
          success: false,
          error: 'On-chain balances are not available on this deployment',
        });
        return;
      }

      const balance = await SorobanService.read(SorobanService.contracts().waste_token, 'balance', [
        ScArg.address(address),
      ]);
      res.status(200).json({
        success: true,
        data: {
          address,
          // Base units (7 decimals), as a string because it can exceed 2^53
          balance: String(balance ?? 0),
          explorerUrl: explorer(`account/${address}`),
        },
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        error: 'Failed to read the WASTE balance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getTransactionHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const wallet = await StellarService.getUserWallet(req.user.userId);
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'Wallet not found',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const history = await StellarService.getTransactionHistory(wallet.publicKey, limit);

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send payment to another user
   */
  static async sendPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { destinationPublicKey, amount, memo } = req.body;

      if (!destinationPublicKey || !amount) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'destinationPublicKey and amount are required',
        });
        return;
      }

      const wallet = await StellarService.getUserWallet(req.user.userId);
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'Wallet not found',
        });
        return;
      }

      const result = await StellarService.sendPayment(
        wallet.secretKey,
        destinationPublicKey,
        amount,
        memo
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            transactionHash: result.transactionHash,
          },
          message: 'Payment sent successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Payment failed',
          message: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to send payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get XLM to KES exchange rate
   */
  static async getExchangeRate(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const rate = await StellarService.getXLMtoKESRate();

      res.status(200).json({
        success: true,
        data: {
          rate,
          from: 'XLM',
          to: 'KES',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch exchange rate',
      });
    }
  }
}
