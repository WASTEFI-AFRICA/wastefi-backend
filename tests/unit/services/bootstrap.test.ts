import { BootstrapService } from '../../../src/services/bootstrap.service';

jest.mock('../../../src/services/database.service', () => ({
  __esModule: true,
  prisma: {
    user: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
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
