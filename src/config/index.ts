import crypto from 'crypto';

const INSECURE_JWT_SECRET = 'default-secret-change-me';

/**
 * The JWT signing secret. A missing secret falls back to a public default so that
 * local development works without setup, but a production process must never sign
 * tokens with a value anyone can read in this repository, so it refuses to start.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret === INSECURE_JWT_SECRET)) {
    throw new Error('JWT_SECRET must be set to a unique value when NODE_ENV=production');
  }
  return secret || INSECURE_JWT_SECRET;
}

/**
 * The key that encrypts custodial Stellar secret keys (see WalletSecretUtil).
 * Either 64 hex characters (`openssl rand -hex 32`), used as the key directly, or
 * any random value of at least 32 characters, hashed to a key (what Render's
 * generated values look like). Development and tests fall back to a fixed key.
 * Production refuses to start without one, because a wallet encrypted under a
 * public key is not protected.
 */
function resolveWalletEncryptionKey(): Buffer {
  const value = process.env.WALLET_ENCRYPTION_KEY;
  if (value) {
    if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, 'hex');
    if (value.length < 32) {
      throw new Error(
        'WALLET_ENCRYPTION_KEY must be at least 32 characters (openssl rand -hex 32)'
      );
    }
    return crypto.createHash('sha256').update(value).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WALLET_ENCRYPTION_KEY must be set when NODE_ENV=production');
  }
  return crypto.createHash('sha256').update('wastefi-development-wallet-key').digest();
}

export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
    version: '1.0.0',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string,
  },
  wallet: {
    encryptionKey: resolveWalletEncryptionKey(),
  },
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    masterSecret: process.env.STELLAR_MASTER_SECRET || '',
  },
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    ttl: {
      default: 3600, // 1 hour
      session: 86400, // 24 hours
      cache: 300, // 5 minutes
      rateLimit: 60, // 1 minute
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
