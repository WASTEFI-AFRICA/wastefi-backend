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
