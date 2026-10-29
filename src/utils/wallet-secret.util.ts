import crypto from 'crypto';
import { config } from '../config';
import { EncryptionUtil } from './encryption.util';

const PREFIX = 'v2:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encryption for the custodial Stellar secret keys stored on users.
 *
 * Secrets are sealed with AES-256-GCM under WALLET_ENCRYPTION_KEY, a key used for
 * nothing else, so rotating the JWT secret never locks wallets, and a leaked JWT
 * secret cannot decrypt them. GCM authenticates the ciphertext, so a tampered value
 * fails to decrypt instead of producing a wrong key.
 *
 * Values written before this existed are AES-256-CBC under the JWT secret. They
 * still decrypt, and BootstrapService re-encrypts them at startup.
 */
export class WalletSecretUtil {
  static encrypt(secret: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', config.wallet.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
  }

  static decrypt(stored: string): string {
    if (this.isLegacy(stored)) {
      return EncryptionUtil.decrypt(stored, config.jwt.secret);
    }
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    if (raw.length <= IV_BYTES + TAG_BYTES) {
      throw new Error('Wallet secret is malformed');
    }
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', config.wallet.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /** True for values written with the old JWT-secret scheme. */
  static isLegacy(stored: string): boolean {
    return !stored.startsWith(PREFIX);
  }
}
