import { WalletSecretUtil } from '../../../src/utils/wallet-secret.util';
import { EncryptionUtil } from '../../../src/utils/encryption.util';
import { config } from '../../../src/config';

const SECRET = 'SBK2VIYYSVG76E7VC3QHYARNFLY2EAQXDHRC7BMXBBGIFG74ARPRMNQM';

describe('WalletSecretUtil', () => {
  it('round-trips a secret', () => {
    const sealed = WalletSecretUtil.encrypt(SECRET);
    expect(sealed.startsWith('v2:')).toBe(true);
    expect(sealed).not.toContain(SECRET);
    expect(WalletSecretUtil.decrypt(sealed)).toBe(SECRET);
  });

  it('uses a fresh IV for every encryption', () => {
    expect(WalletSecretUtil.encrypt(SECRET)).not.toBe(WalletSecretUtil.encrypt(SECRET));
  });

  it('rejects a tampered ciphertext', () => {
    const sealed = WalletSecretUtil.encrypt(SECRET);
    const raw = Buffer.from(sealed.slice(3), 'base64');
    raw[raw.length - 1] ^= 0x01;
    const tampered = 'v2:' + raw.toString('base64');
    expect(() => WalletSecretUtil.decrypt(tampered)).toThrow();
  });

  it('rejects a truncated value', () => {
    expect(() => WalletSecretUtil.decrypt('v2:AAAA')).toThrow('Wallet secret is malformed');
  });

  it('still reads values written with the old JWT-secret scheme', () => {
    const legacy = EncryptionUtil.encrypt(SECRET, config.jwt.secret);
    expect(WalletSecretUtil.isLegacy(legacy)).toBe(true);
    expect(WalletSecretUtil.decrypt(legacy)).toBe(SECRET);
  });

  it('does not depend on the JWT secret for new values', () => {
    const sealed = WalletSecretUtil.encrypt(SECRET);
    const original = config.jwt.secret;
    try {
      (config.jwt as { secret: string }).secret = 'rotated-jwt-secret';
      expect(WalletSecretUtil.decrypt(sealed)).toBe(SECRET);
    } finally {
      (config.jwt as { secret: string }).secret = original;
    }
  });
});

describe('WALLET_ENCRYPTION_KEY', () => {
  const saved = {
    key: process.env.WALLET_ENCRYPTION_KEY,
    env: process.env.NODE_ENV,
    jwt: process.env.JWT_SECRET,
  };

  afterEach(() => {
    if (saved.key === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
    else process.env.WALLET_ENCRYPTION_KEY = saved.key;
    process.env.NODE_ENV = saved.env;
    if (saved.jwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved.jwt;
    jest.resetModules();
  });

  const loadKey = (): Buffer => {
    let key: Buffer | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      key = require('../../../src/config').config.wallet.encryptionKey;
    });
    return key as Buffer;
  };

  it('uses a 64 hex character value as the key', () => {
    process.env.WALLET_ENCRYPTION_KEY = 'ab'.repeat(32);
    expect(loadKey().equals(Buffer.from('ab'.repeat(32), 'hex'))).toBe(true);
  });

  it('hashes a long non-hex value to a 32 byte key', () => {
    process.env.WALLET_ENCRYPTION_KEY = 'a-generated-value-that-is-not-hex-0123456789';
    expect(loadKey()).toHaveLength(32);
  });

  it('rejects a short value', () => {
    process.env.WALLET_ENCRYPTION_KEY = 'too-short';
    expect(loadKey).toThrow('at least 32 characters');
  });

  it('is required in production', () => {
    delete process.env.WALLET_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-test-jwt-secret';
    expect(loadKey).toThrow('WALLET_ENCRYPTION_KEY must be set');
  });
});
