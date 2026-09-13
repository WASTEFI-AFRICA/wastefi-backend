import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { AuthService } from '../services/auth.service';
import { validationResult } from 'express-validator';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const result = await AuthService.register(req.body);

      res.status(201).json({
        success: true,
        data: result,
        message: 'User registered successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const result = await AuthService.login(req.body);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login successful',
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Invalid credentials',
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: req.user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile',
      });
    }
  }

  /**
   * Create API key
   */
  static async createApiKey(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const result = await AuthService.createApiKey(req.user.userId, req.body);

      res.status(201).json({
        success: true,
        data: result,
        message: 'API key created successfully. Save this key - it will not be shown again.',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to create API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List user's API keys
   */
  static async listApiKeys(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const apiKeys = await AuthService.listApiKeys(req.user.userId);

      res.status(200).json({
        success: true,
        data: apiKeys,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch API keys',
      });
    }
  }

  /**
   * Revoke API key
   */
  static async revokeApiKey(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await AuthService.revokeApiKey(req.user.userId, req.params.keyId);

      res.status(200).json({
        success: true,
        message: 'API key revoked successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to revoke API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
        return;
      }

      const result = await AuthService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Invalid refresh token',
      });
    }
  }
}
