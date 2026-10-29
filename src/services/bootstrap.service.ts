import { UserRole } from '@prisma/client';
import { StrKey } from '@stellar/stellar-sdk';
import { prisma } from './database.service';
import { EncryptionUtil } from '../utils/encryption.util';
import { PasswordValidatorUtil } from '../utils/password-validator.util';
import { WalletSecretUtil } from '../utils/wallet-secret.util';
import { WasteCollectionService } from './waste-collection.service';
import { logger } from '../utils/logger.util';

const PHONE_PATTERN = /^\+?[1-9]\d{1,14}$/;

/**
 * First-run setup.
 *
 * A fresh deployment has no administrator, and registration deliberately cannot
 * create one. On hosts that do not expose the database or a shell (most PaaS
 * platforms), the standard answer is to create the first admin from the
 * environment: set INITIAL_ADMIN_PHONE and INITIAL_ADMIN_PASSWORD and start the
 * server. It only acts while no admin exists, so it is safe to leave configured,
 * though the password variable is better removed once the admin can log in.
 */
export class BootstrapService {
  static async ensureInitialAdmin(): Promise<void> {
    const phoneNumber = process.env.INITIAL_ADMIN_PHONE;
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!phoneNumber && !password) return;

    if (!phoneNumber || !password) {
      logger.warn(
        'Initial admin not created: set both INITIAL_ADMIN_PHONE and INITIAL_ADMIN_PASSWORD'
      );
      return;
    }
    if (!PHONE_PATTERN.test(phoneNumber)) {
      logger.warn('Initial admin not created: INITIAL_ADMIN_PHONE is not a valid phone number');
      return;
    }
    try {
      PasswordValidatorUtil.customValidator(password);
    } catch (error) {
      // Log why, but never the password, and carry on starting: a misconfigured
      // bootstrap must not stop the API from serving.
      logger.warn('Initial admin not created: INITIAL_ADMIN_PASSWORD is too weak', {
        reason: (error as Error).message,
      });
      return;
    }

    const admins = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (admins > 0) {
      logger.info('Initial admin skipped: an administrator already exists');
      return;
    }

    await prisma.user.create({
      data: {
        phoneNumber,
        firstName: 'Admin',
        lastName: 'User',
        password: await EncryptionUtil.hashPassword(password),
        role: UserRole.ADMIN,
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
      },
    });
    // The password is never logged.
    logger.info('Initial administrator created', { phoneNumber });
  }

  /**
   * Re-encrypt wallet secrets still stored under the old JWT-secret scheme with
   * WALLET_ENCRYPTION_KEY. It runs at every start and does nothing once all secrets
   * are migrated. It must run before the JWT secret is next rotated, because legacy
   * values can only be read with the JWT secret they were written under.
   */
  static async migrateWalletSecrets(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { stellarSecretKey: { not: null } },
      select: { id: true, stellarSecretKey: true },
    });
    const legacy = users.filter(
      (u): u is { id: string; stellarSecretKey: string } =>
        u.stellarSecretKey !== null && WalletSecretUtil.isLegacy(u.stellarSecretKey)
    );
    if (legacy.length === 0) return;

    let migrated = 0;
    for (const user of legacy) {
      try {
        const secret = WalletSecretUtil.decrypt(user.stellarSecretKey);
        // CBC under the wrong key occasionally "decrypts" to garbage instead of
        // failing. Never overwrite the stored value unless it held a real key.
        if (!StrKey.isValidEd25519SecretSeed(secret)) {
          throw new Error('Decrypted value is not a Stellar secret key');
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { stellarSecretKey: WalletSecretUtil.encrypt(secret) },
        });
        migrated += 1;
      } catch (error) {
        // A value that no longer decrypts (for example after a JWT secret change)
        // is left as it is, and the rest still migrate.
        logger.error('Wallet secret could not be re-encrypted', {
          userId: user.id,
          reason: (error as Error).message,
        });
      }
    }
    logger.info('Wallet secrets re-encrypted', { migrated, failed: legacy.length - migrated });
  }

  /**
   * Demo data for a public deployment, so a visitor can try the whole flow. Off
   * unless SEED_DEMO_DATA=true and DEMO_ACCOUNT_PASSWORD is set.
   *
   * It creates three collection points, a demo collector, a demo collection point
   * operator (both signing in with DEMO_ACCOUNT_PASSWORD), and a few pending
   * collections from the collector. Nothing is created already verified: every
   * verified collection on a demo comes from a real approval, with its on-chain
   * record. Safe to run at every start; it only creates what is missing.
   */
  static async ensureDemoData(): Promise<void> {
    if (process.env.SEED_DEMO_DATA !== 'true') return;

    const password = process.env.DEMO_ACCOUNT_PASSWORD;
    if (!password) {
      logger.warn('Demo data not created: set DEMO_ACCOUNT_PASSWORD');
      return;
    }
    try {
      PasswordValidatorUtil.customValidator(password);
    } catch (error) {
      logger.warn('Demo data not created: DEMO_ACCOUNT_PASSWORD is too weak', {
        reason: (error as Error).message,
      });
      return;
    }

    const points = [];
    for (const point of DEMO_POINTS) {
      const existing = await prisma.collectionPoint.findFirst({
        where: { contactPhone: point.contactPhone },
      });
      points.push(
        existing ??
          (await prisma.collectionPoint.create({
            data: { ...point, isActive: true, verifiedAt: new Date() },
          }))
      );
    }

    const passwordHash = await EncryptionUtil.hashPassword(password);
    const [collector] = await Promise.all(
      DEMO_ACCOUNTS.map((account) =>
        prisma.user.upsert({
          where: { phoneNumber: account.phoneNumber },
          update: {},
          create: {
            ...account,
            password: passwordHash,
            status: 'ACTIVE',
            kycStatus: 'APPROVED',
          },
        })
      )
    );

    if ((await prisma.wasteCollection.count({ where: { collectorId: collector.id } })) > 0) {
      return;
    }
    for (const sample of DEMO_COLLECTIONS) {
      await WasteCollectionService.recordCollection(collector.id, {
        collectionPointId: points[sample.point].id,
        materialType: sample.materialType,
        materialCategory: sample.materialCategory,
        weight: sample.weight,
        notes: 'Demo collection',
      });
    }
    logger.info('Demo data created', {
      collectionPoints: points.length,
      pendingCollections: DEMO_COLLECTIONS.length,
    });
  }
}

/** Collection points for the demo. The phone numbers are placeholders, not real lines. */
const DEMO_POINTS = [
  {
    name: 'Nairobi Central Collection Point',
    description: 'Demo collection point in central Nairobi',
    latitude: -1.2864,
    longitude: 36.8172,
    address: 'Tom Mboya Street',
    city: 'Nairobi',
    contactPerson: 'Demo operator',
    contactPhone: '+254700000201',
    acceptedMaterials: JSON.stringify(['PET', 'HDPE', 'ALUMINUM', 'GLASS_CLEAR']),
  },
  {
    name: 'Westlands Recycling Hub',
    description: 'Demo collection point in Westlands',
    latitude: -1.2676,
    longitude: 36.8108,
    address: 'Waiyaki Way',
    city: 'Nairobi',
    contactPerson: 'Demo operator',
    contactPhone: '+254700000202',
    acceptedMaterials: JSON.stringify(['PET', 'CARDBOARD', 'PAPER_MIXED', 'ALUMINUM']),
  },
  {
    name: 'Mombasa Coastal Recycling Hub',
    description: 'Demo collection point in Mombasa',
    latitude: -4.0435,
    longitude: 39.6682,
    address: 'Moi Avenue',
    city: 'Mombasa',
    contactPerson: 'Demo operator',
    contactPhone: '+254700000203',
    acceptedMaterials: JSON.stringify(['PET', 'HDPE', 'GLASS_CLEAR', 'CARDBOARD']),
  },
];

/** The collector comes first; ensureDemoData relies on that order. */
const DEMO_ACCOUNTS = [
  {
    phoneNumber: '+254700000101',
    firstName: 'Demo',
    lastName: 'Collector',
    role: UserRole.COLLECTOR,
  },
  {
    phoneNumber: '+254700000102',
    firstName: 'Demo',
    lastName: 'Operator',
    role: UserRole.COLLECTION_POINT,
  },
];

const DEMO_COLLECTIONS = [
  { point: 0, materialType: 'PET', materialCategory: 'Plastic', weight: 6.5 },
  { point: 1, materialType: 'ALUMINUM', materialCategory: 'Metal', weight: 2.4 },
  { point: 2, materialType: 'CARDBOARD', materialCategory: 'Cardboard', weight: 12 },
  { point: 0, materialType: 'GLASS_CLEAR', materialCategory: 'Glass', weight: 8 },
];
