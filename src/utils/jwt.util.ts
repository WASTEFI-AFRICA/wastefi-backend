import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload } from '../types/auth.types';

export class JWTUtil {
  private static secret = config.jwt.secret;

  /**
   * Generate JWT access token
   */
  static generateToken(payload: JWTPayload): string {
    const options: SignOptions = {
      expiresIn: '7d',
      issuer: 'wastefi',
    };
    return jwt.sign(payload, this.secret, options);
  }

  /**
   * Generate refresh token (longer expiration)
   */
  static generateRefreshToken(payload: JWTPayload): string {
    const options: SignOptions = {
      expiresIn: '30d',
      issuer: 'wastefi',
    };
    return jwt.sign(payload, this.secret, options);
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'wastefi',
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      if (!decoded || !decoded.exp) return true;
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }
}
