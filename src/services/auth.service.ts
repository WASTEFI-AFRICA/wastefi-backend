import { prisma } from './database.service';
import { JWTUtil } from '../utils/jwt.util';
import { EncryptionUtil } from '../utils/encryption.util';
import {
  RegisterData,
  TokenResponse,
  LoginCredentials,
  ApiKeyCreateData,
  ApiKeyResponse,
} from '../types/auth.types';
import { User, UserRole } from '@prisma/client';

export class AuthService {
  /**
   * Register a new user
   */
  static async register(data: RegisterData): Promise<TokenResponse> {
    // Check if user already exists by phone number
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber: data.phoneNumber },
    });

    if (existingUser) {
      throw new Error('User with this phone number already exists');
    }

    // Check email uniqueness (case-insensitive) if provided
    if (data.email) {
      const normalizedEmail = data.email.toLowerCase();

      const existingEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
      });

      if (existingEmail) {
        throw new Error('User with this email already exists');
      }

      // Store email in lowercase for consistency
      data.email = normalizedEmail;
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await EncryptionUtil.hashPassword(data.password);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        phoneNumber: data.phoneNumber,
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        // Never taken from the request: a client choosing its own role could register
        // as ADMIN. Elevated roles are assigned by an administrator.
        role: UserRole.COLLECTOR,
        status: 'PENDING', // Requires verification
      },
    });

    // Generate tokens
    return this.generateTokenResponse(user);
  }

  /**
   * Login user with phone number
   */
  static async login(credentials: LoginCredentials): Promise<TokenResponse> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber: credentials.phoneNumber },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Account is not active. Please complete verification.');
    }

    // A password is mandatory. OTP login is not implemented yet, so it must not
    // be a way in: an earlier version skipped verification entirely when no
    // password was sent, which let anyone log in as any active account (including
    // the seeded admin) knowing only its phone number.
    if (!credentials.password) {
      throw new Error(
        credentials.otp ? 'OTP login is not available. Use your password.' : 'Password is required'
      );
    }

    // Same message whether the account has no password or the password is wrong,
    // so the response does not reveal which accounts are passwordless.
    if (!user.password) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      credentials.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokenResponse(user);
  }

  /**
   * Verify user and activate account
   */
  static async verifyUser(userId: string): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
      },
    });

    return user;
  }

  /**
   * Create API key for user
   */
  static async createApiKey(userId: string, data: ApiKeyCreateData): Promise<ApiKeyResponse> {
    // Generate API key
    const apiKey = EncryptionUtil.generateApiKey();
    const hashedKey = EncryptionUtil.hashApiKey(apiKey);

    // Store hashed key in database
    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        key: hashedKey,
        name: data.name,
        userId,
        expiresAt: data.expiresAt,
        isActive: true,
      },
    });

    // Return the plain key (only time it's visible)
    return {
      id: apiKeyRecord.id,
      key: apiKey, // Return plain key
      name: apiKeyRecord.name,
      createdAt: apiKeyRecord.createdAt,
      expiresAt: apiKeyRecord.expiresAt || undefined,
    };
  }

  /**
   * List user's API keys
   */
  static async listApiKeys(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke API key
   */
  static async revokeApiKey(userId: string, apiKeyId: string): Promise<void> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        userId,
      },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false },
    });
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const decoded = JWTUtil.verifyToken(refreshToken, 'refresh');

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new Error('Invalid refresh token');
      }

      return this.generateTokenResponse(user);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Generate token response
   */
  private static generateTokenResponse(user: User): TokenResponse {
    const payload = {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      email: user.email || undefined,
    };

    const accessToken = JWTUtil.generateToken(payload);
    const refreshToken = JWTUtil.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: '7d',
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        email: user.email || undefined,
      },
    };
  }
}
