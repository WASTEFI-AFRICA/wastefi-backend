import { EncryptionUtil } from '../../../src/utils/encryption.util';

describe('Encryption Utility', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'sensitive data';
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same input', () => {
      const plaintext = 'test data';
      const encrypted1 = EncryptionUtil.encrypt(plaintext);
      const encrypted2 = EncryptionUtil.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(EncryptionUtil.decrypt(encrypted1)).toBe(plaintext);
      expect(EncryptionUtil.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا العالم';
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'MySecurePassword123!';
      const hash = await EncryptionUtil.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await EncryptionUtil.hashPassword(password);
      const isValid = await EncryptionUtil.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecurePassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await EncryptionUtil.hashPassword(password);
      const isValid = await EncryptionUtil.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'MySecurePassword123!';
      const hash1 = await EncryptionUtil.hashPassword(password);
      const hash2 = await EncryptionUtil.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await EncryptionUtil.verifyPassword(password, hash1)).toBe(true);
      expect(await EncryptionUtil.verifyPassword(password, hash2)).toBe(true);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hash = await EncryptionUtil.hashPassword(password);
      const isValid = await EncryptionUtil.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should be case sensitive', async () => {
      const password = 'MyPassword';
      const hash = await EncryptionUtil.hashPassword(password);
      
      expect(await EncryptionUtil.verifyPassword('MyPassword', hash)).toBe(true);
      expect(await EncryptionUtil.verifyPassword('mypassword', hash)).toBe(false);
      expect(await EncryptionUtil.verifyPassword('MYPASSWORD', hash)).toBe(false);
    });
  });
});
