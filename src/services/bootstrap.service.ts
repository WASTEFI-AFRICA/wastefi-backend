import { UserRole } from '@prisma/client';
import { prisma } from './database.service';
import { EncryptionUtil } from '../utils/encryption.util';
import { PasswordValidatorUtil } from '../utils/password-validator.util';
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
}
