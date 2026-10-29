import { BootstrapService } from '../../../src/services/bootstrap.service';
import { WalletSecretUtil } from '../../../src/utils/wallet-secret.util';
import { EncryptionUtil } from '../../../src/utils/encryption.util';
import { config } from '../../../src/config';

jest.mock('../../../src/services/database.service', () => ({
  __esModule: true,
  prisma: {
    user: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    collectionPoint: { findFirst: jest.fn(), create: jest.fn() },
    wasteCollection: { count: jest.fn() },
  },
}));
jest.mock('../../../src/services/waste-collection.service', () => ({
  __esModule: true,
  WasteCollectionService: { recordCollection: jest.fn() },
}));
jest.mock('../../../src/utils/logger.util', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../src/services/database.service');

const STRONG = 'Str0ng!Passw0rd#1';

describe('BootstrapService.ensureInitialAdmin', () => {
  const saved = {
    phone: process.env.INITIAL_ADMIN_PHONE,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  };

  beforeEach(() => {
    prisma.user.count.mockReset();
    prisma.user.create.mockReset();
    delete process.env.INITIAL_ADMIN_PHONE;
    delete process.env.INITIAL_ADMIN_PASSWORD;
  });

  afterAll(() => {
    process.env.INITIAL_ADMIN_PHONE = saved.phone;
    process.env.INITIAL_ADMIN_PASSWORD = saved.password;
  });

  it('does nothing when no initial admin is configured', async () => {
    await BootstrapService.ensureInitialAdmin();
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does nothing when only one of the two variables is set', async () => {
    process.env.INITIAL_ADMIN_PHONE = '+254700000000';
    await BootstrapService.ensureInitialAdmin();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates an active ADMIN with a hashed password when none exists', async () => {
    process.env.INITIAL_ADMIN_PHONE = '+254700000123';
    process.env.INITIAL_ADMIN_PASSWORD = STRONG;
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockResolvedValue({});

    await BootstrapService.ensureInitialAdmin();

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe('ADMIN');
    expect(data.status).toBe('ACTIVE');
    expect(data.phoneNumber).toBe('+254700000123');
    expect(data.password).not.toBe(STRONG);
    expect(data.password).toMatch(/^\$2[aby]\$/);
  });

  it('does not create a second admin when one already exists', async () => {
    process.env.INITIAL_ADMIN_PHONE = '+254700000123';
    process.env.INITIAL_ADMIN_PASSWORD = STRONG;
    prisma.user.count.mockResolvedValue(1);

    await BootstrapService.ensureInitialAdmin();

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a weak password without throwing', async () => {
    process.env.INITIAL_ADMIN_PHONE = '+254700000123';
    process.env.INITIAL_ADMIN_PASSWORD = 'weak';

    await expect(BootstrapService.ensureInitialAdmin()).resolves.toBeUndefined();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses an invalid phone number without throwing', async () => {
    process.env.INITIAL_ADMIN_PHONE = 'not-a-phone';
    process.env.INITIAL_ADMIN_PASSWORD = STRONG;

    await expect(BootstrapService.ensureInitialAdmin()).resolves.toBeUndefined();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('BootstrapService.migrateWalletSecrets', () => {
  const SECRET = 'SBK2VIYYSVG76E7VC3QHYARNFLY2EAQXDHRC7BMXBBGIFG74ARPRMNQM';

  beforeEach(() => {
    prisma.user.findMany.mockReset();
    prisma.user.update.mockReset();
  });

  it('re-encrypts legacy secrets and leaves current ones alone', async () => {
    const legacy = EncryptionUtil.encrypt(SECRET, config.jwt.secret);
    const current = WalletSecretUtil.encrypt(SECRET);
    prisma.user.findMany.mockResolvedValue([
      { id: 'legacy-user', stellarSecretKey: legacy },
      { id: 'current-user', stellarSecretKey: current },
    ]);

    await BootstrapService.migrateWalletSecrets();

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'legacy-user' });
    expect(WalletSecretUtil.isLegacy(data.stellarSecretKey)).toBe(false);
    expect(WalletSecretUtil.decrypt(data.stellarSecretKey)).toBe(SECRET);
  });

  it('skips a secret that no longer decrypts and migrates the rest', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'broken', stellarSecretKey: EncryptionUtil.encrypt(SECRET, 'some-old-jwt-secret') },
      { id: 'fine', stellarSecretKey: EncryptionUtil.encrypt(SECRET, config.jwt.secret) },
    ]);

    await BootstrapService.migrateWalletSecrets();

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'fine' });
  });

  it('does nothing when every secret is current', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'current-user', stellarSecretKey: WalletSecretUtil.encrypt(SECRET) },
    ]);

    await BootstrapService.migrateWalletSecrets();

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('BootstrapService.ensureDemoData', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WasteCollectionService } = require('../../../src/services/waste-collection.service');
  const saved = { seed: process.env.SEED_DEMO_DATA, password: process.env.DEMO_ACCOUNT_PASSWORD };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.SEED_DEMO_DATA = 'true';
    process.env.DEMO_ACCOUNT_PASSWORD = STRONG;
    prisma.collectionPoint.findFirst.mockResolvedValue(null);
    prisma.collectionPoint.create.mockImplementation(
      async ({ data }: { data: { name: string } }) => ({
        id: `point-${data.name}`,
      })
    );
    prisma.user.upsert.mockImplementation(
      async ({ create }: { create: { phoneNumber: string; role: string } }) => ({
        id: `user-${create.phoneNumber}`,
        role: create.role,
      })
    );
    prisma.wasteCollection.count.mockResolvedValue(0);
  });

  afterAll(() => {
    if (saved.seed === undefined) delete process.env.SEED_DEMO_DATA;
    else process.env.SEED_DEMO_DATA = saved.seed;
    if (saved.password === undefined) delete process.env.DEMO_ACCOUNT_PASSWORD;
    else process.env.DEMO_ACCOUNT_PASSWORD = saved.password;
  });

  it('does nothing unless SEED_DEMO_DATA is true', async () => {
    delete process.env.SEED_DEMO_DATA;

    await BootstrapService.ensureDemoData();

    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });

  it('does nothing with a missing or weak demo password', async () => {
    delete process.env.DEMO_ACCOUNT_PASSWORD;
    await BootstrapService.ensureDemoData();
    process.env.DEMO_ACCOUNT_PASSWORD = 'weak';
    await BootstrapService.ensureDemoData();

    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('creates points, a collector, an operator and pending collections', async () => {
    await BootstrapService.ensureDemoData();

    expect(prisma.collectionPoint.create).toHaveBeenCalledTimes(3);
    const roles = prisma.user.upsert.mock.calls.map(
      (c: [{ create: { role: string } }]) => c[0].create.role
    );
    expect(roles).toEqual(['COLLECTOR', 'COLLECTION_POINT']);
    const created = prisma.user.upsert.mock.calls[0][0].create;
    expect(created.status).toBe('ACTIVE');
    expect(created.password).not.toBe(STRONG);
    expect(WasteCollectionService.recordCollection).toHaveBeenCalledTimes(4);
    for (const [collectorId, data] of WasteCollectionService.recordCollection.mock.calls) {
      expect(collectorId).toBe('user-+254700000101');
      expect(data).not.toHaveProperty('verifiedAt');
    }
  });

  it('reuses existing points and adds no collections once the collector has some', async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue({ id: 'existing-point' });
    prisma.wasteCollection.count.mockResolvedValue(4);

    await BootstrapService.ensureDemoData();

    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
    expect(prisma.user.upsert.mock.calls[0][0].update).toEqual({});
    expect(WasteCollectionService.recordCollection).not.toHaveBeenCalled();
  });
});
