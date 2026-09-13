import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 10;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a random API key
   */
  static generateApiKey(): string {
    // Generate format: wf_live_xxxxxxxxxxxxxxxxxxxx (32 chars after prefix)
    const randomBytes = crypto.randomBytes(24);
    const key = randomBytes.toString('base64url');
    return `wf_live_${key}`;
  }

  /**
   * Generate a test/sandbox API key
   */
  static generateTestApiKey(): string {
    const randomBytes = crypto.randomBytes(24);
    const key = randomBytes.toString('base64url');
    return `wf_test_${key}`;
  }

  /**
   * Hash API key for storage
   */
  static hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Generate random OTP (6 digits)
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt sensitive data (for storing Stellar keys, etc.)
   */
  static encrypt(text: string, encryptionKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedText: string, encryptionKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
