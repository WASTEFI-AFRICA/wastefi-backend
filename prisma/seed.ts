import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { EncryptionUtil } from '../src/utils/encryption.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create the admin user. Login requires a password, so the admin gets one: from
  // SEED_ADMIN_PASSWORD if set, otherwise a random one that is printed once below.
  // Nothing about the password is hardcoded in this repository.
  const adminPhone = '+254700000000';
  const suppliedPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminPassword = suppliedPassword || crypto.randomBytes(18).toString('base64url');
  const passwordHash = await EncryptionUtil.hashPassword(adminPassword);

  // An admin created by an older seed has no password; give it one without
  // overwriting a password someone has since chosen.
  const existingAdmin = await prisma.user.findUnique({ where: { phoneNumber: adminPhone } });
  const needsPassword = !existingAdmin || !existingAdmin.password;

  const admin = await prisma.user.upsert({
    where: { phoneNumber: adminPhone },
    update: needsPassword ? { password: passwordHash } : {},
    create: {
      phoneNumber: adminPhone,
      email: 'admin@wastefi.com',
      firstName: 'Admin',
      lastName: 'User',
      password: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      country: 'Kenya',
    },
  });
  if (needsPassword && !suppliedPassword) {
    console.log(
      `Admin login: ${adminPhone} / ${adminPassword}  (shown once; set SEED_ADMIN_PASSWORD to choose your own)`
    );
  }
  console.log('Created admin user:', admin.id);

  // Create sample collection points
  const existingPoint1 = await prisma.collectionPoint.findFirst({
    where: { contactPhone: '+254700000001' },
  });

  const collectionPoint1 =
    existingPoint1 ||
    (await prisma.collectionPoint.create({
      data: {
        name: 'Nairobi Central Collection Point',
        description: 'Main collection point in downtown Nairobi',
        latitude: -1.2864,
        longitude: 36.8172,
        address: 'Tom Mboya Street, Nairobi',
        city: 'Nairobi',
        country: 'Kenya',
        contactPerson: 'John Doe',
        contactPhone: '+254700000001',
        contactEmail: 'nairobi@wastefi.com',
        isActive: true,
        verifiedAt: new Date(),
        operatingHours: JSON.stringify({
          monday: '08:00-18:00',
          tuesday: '08:00-18:00',
          wednesday: '08:00-18:00',
          thursday: '08:00-18:00',
          friday: '08:00-18:00',
          saturday: '08:00-14:00',
          sunday: 'closed',
        }),
        acceptedMaterials: JSON.stringify(['PET', 'HDPE', 'Glass', 'Aluminum', 'Steel']),
      },
    }));
  console.log('Created collection point:', collectionPoint1.id);

  const existingPoint2 = await prisma.collectionPoint.findFirst({
    where: { contactPhone: '+254700000002' },
  });

  const collectionPoint2 =
    existingPoint2 ||
    (await prisma.collectionPoint.create({
      data: {
        name: 'Mombasa Coastal Recycling Hub',
        description: 'Coastal collection point serving Mombasa region',
        latitude: -4.0435,
        longitude: 39.6682,
        address: 'Moi Avenue, Mombasa',
        city: 'Mombasa',
        country: 'Kenya',
        contactPerson: 'Jane Smith',
        contactPhone: '+254700000002',
        contactEmail: 'mombasa@wastefi.com',
        isActive: true,
        verifiedAt: new Date(),
        operatingHours: JSON.stringify({
          monday: '07:00-17:00',
          tuesday: '07:00-17:00',
          wednesday: '07:00-17:00',
          thursday: '07:00-17:00',
          friday: '07:00-17:00',
          saturday: '07:00-12:00',
          sunday: 'closed',
        }),
        acceptedMaterials: JSON.stringify(['PET', 'HDPE', 'PP', 'Glass']),
      },
    }));
  console.log('Created collection point:', collectionPoint2.id);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
