import { Keypair } from '@stellar/stellar-sdk';
import { OnChainCollectionService } from '../../../src/services/onchain-collection.service';

jest.mock('../../../src/services/database.service', () => ({
  __esModule: true,
  prisma: {
    wasteCollection: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    collectionPoint: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  },
}));
jest.mock('../../../src/services/soroban.service', () => {
  const actual = jest.requireActual('../../../src/services/soroban.service');
  return {
    __esModule: true,
    ScArg: actual.ScArg,
    SorobanService: {
      enabled: true,
      contracts: jest.fn(),
      adminKeypair: jest.fn(),
      read: jest.fn(),
      invoke: jest.fn(),
      lookup: jest.fn(),
      ensureAccount: jest.fn(),
    },
  };
});
jest.mock('../../../src/services/stellar.service', () => ({
  __esModule: true,
  StellarService: { createUserWallet: jest.fn() },
}));
jest.mock('../../../src/utils/logger.util', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const { prisma } = require('../../../src/services/database.service');
const { SorobanService } = require('../../../src/services/soroban.service');
const { StellarService } = require('../../../src/services/stellar.service');
/* eslint-enable @typescript-eslint/no-var-requires */

const collector = Keypair.random();
const admin = Keypair.random();
const POINT = Keypair.random().publicKey();

const baseCollection = {
  id: 'collection-1',
  collectorId: 'user-1',
  materialCategory: 'Plastic',
  weight: 3.25,
  chainStatus: 'PENDING',
  chainTransactionId: null as string | null,
  chainRecordTxHash: null as string | null,
  collectionPoint: { id: 'point-1', stellarAddress: POINT },
};

/** Fake chain state that the mocked reads answer from. */
function chain(state: {
  active?: boolean;
  exists?: boolean;
  verified?: boolean;
  paymentId?: bigint | null;
  paymentStatus?: string;
}) {
  SorobanService.read.mockImplementation(async (_contract: string, method: string) => {
    switch (method) {
      case 'is_active':
        return state.active ?? true;
      case 'exists':
        return state.exists ?? true;
      case 'get_transaction':
        return { total_amount: 26_000_000n, verified: state.verified ?? false };
      case 'get_payment_for_transaction':
        return state.paymentId ?? null;
      case 'get_payment':
        return { status: [state.paymentStatus ?? 'Pending'] };
      default:
        throw new Error(`unexpected read ${method}`);
    }
  });
}

const invokedMethods = () => SorobanService.invoke.mock.calls.map((c: unknown[]) => c[1]);
const lastUpdate = () => {
  const calls = prisma.wasteCollection.update.mock.calls;
  return calls[calls.length - 1][0].data;
};

describe('OnChainCollectionService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    SorobanService.contracts.mockReturnValue({
      waste_transaction: 'TX',
      payment_distribution: 'PAY',
      collector_registry: 'REG',
      waste_token: 'TOKEN',
    });
    SorobanService.adminKeypair.mockReturnValue(admin);
    SorobanService.ensureAccount.mockResolvedValue(undefined);
    StellarService.createUserWallet.mockResolvedValue({
      publicKey: collector.publicKey(),
      secretKey: collector.secret(),
    });
    prisma.wasteCollection.update.mockResolvedValue({});
    SorobanService.invoke.mockImplementation(async (_c: string, method: string) => ({
      hash: `hash-${method}`,
      value: method === 'record_with_price_lookup' ? 7n : method === 'process_payment' ? 3n : null,
    }));
  });

  it('records, verifies, pays and marks a pending collection PAID', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({ ...baseCollection });
    chain({});

    await OnChainCollectionService.process('collection-1');

    expect(invokedMethods()).toEqual([
      'record_with_price_lookup',
      'verify_transaction',
      'process_payment',
      'update_payment_status',
    ]);
    // The record is signed by the collector, the rest by the admin
    expect(SorobanService.invoke.mock.calls[0][3].publicKey()).toBe(collector.publicKey());
    expect(SorobanService.invoke.mock.calls[1][3].publicKey()).toBe(admin.publicKey());
    expect(lastUpdate()).toEqual({ chainStatus: 'PAID', chainError: null });
    const saved = prisma.wasteCollection.update.mock.calls.map(
      (c: [{ data: unknown }]) => c[0].data
    );
    expect(saved).toContainEqual(
      expect.objectContaining({ chainTransactionId: '7', chainAmount: '26000000' })
    );
    expect(saved).toContainEqual({ chainPaymentId: '3' });
  });

  it('registers and activates a collector the registry does not know', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({ ...baseCollection });
    chain({ active: false, exists: false });

    await OnChainCollectionService.process('collection-1');

    expect(invokedMethods().slice(0, 2)).toEqual(['register', 'update_status']);
  });

  it('only activates a collector that is registered but not active', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({ ...baseCollection });
    chain({ active: false, exists: true });

    await OnChainCollectionService.process('collection-1');

    expect(invokedMethods()).not.toContain('register');
    expect(invokedMethods()[0]).toBe('update_status');
  });

  it('resumes without repeating steps that already happened on-chain', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainStatus: 'FAILED',
      chainTransactionId: '7',
    });
    chain({ verified: true, paymentId: 3n, paymentStatus: 'Completed' });

    await OnChainCollectionService.process('collection-1');

    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate()).toEqual({ chainStatus: 'PAID', chainError: null });
  });

  it('recovers a record that landed before the process stopped', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainRecordTxHash: 'hash-earlier',
    });
    SorobanService.lookup.mockResolvedValue({ status: 'SUCCESS', value: 9n });
    chain({});

    await OnChainCollectionService.process('collection-1');

    expect(invokedMethods()).not.toContain('record_with_price_lookup');
    const saved = prisma.wasteCollection.update.mock.calls.map(
      (c: [{ data: unknown }]) => c[0].data
    );
    expect(saved).toContainEqual(expect.objectContaining({ chainTransactionId: '9' }));
  });

  it('marks the collection FAILED and counts the attempt when a step fails', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({ ...baseCollection });
    chain({});
    SorobanService.invoke.mockRejectedValue(new Error('rpc unavailable'));

    await OnChainCollectionService.process('collection-1');

    expect(lastUpdate()).toEqual({
      chainStatus: 'FAILED',
      chainError: 'rpc unavailable',
      chainAttempts: { increment: 1 },
    });
  });

  it('ignores collections that are not queued or already paid', async () => {
    for (const chainStatus of [null, 'PAID']) {
      prisma.wasteCollection.findUnique.mockResolvedValue({ ...baseCollection, chainStatus });
      await OnChainCollectionService.process('collection-1');
    }
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(prisma.wasteCollection.update).not.toHaveBeenCalled();
  });

  it('gives a collection point an address the first time one is needed', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      collectionPoint: { id: 'point-1', stellarAddress: null },
    });
    prisma.collectionPoint.updateMany.mockResolvedValue({ count: 1 });
    prisma.collectionPoint.findUniqueOrThrow.mockResolvedValue({ stellarAddress: POINT });
    chain({});

    await OnChainCollectionService.process('collection-1');

    expect(prisma.collectionPoint.updateMany).toHaveBeenCalledWith({
      where: { id: 'point-1', stellarAddress: null },
      data: { stellarAddress: expect.stringMatching(/^G[A-Z2-7]{55}$/) },
    });
  });
});

describe('OnChainCollectionService helpers', () => {
  it('maps categories to the contract material types', () => {
    expect(OnChainCollectionService.materialType('Plastic')).toBe('Plastic');
    expect(OnChainCollectionService.materialType(' e-waste ')).toBe('Electronics');
    expect(OnChainCollectionService.materialType('Something new')).toBe('Other');
  });

  it('converts kilograms to whole grams', () => {
    expect(OnChainCollectionService.grams(3.25)).toBe(3250n);
    expect(OnChainCollectionService.grams(0.0004)).toBe(0n);
    expect(OnChainCollectionService.grams(1.2345)).toBe(1235n);
  });

  it('registers collectors under a pseudonym that passes the contract checks', () => {
    const { name, reference } = OnChainCollectionService.pseudonym('user-1');
    expect(name).toBe('WasteFi collector');
    expect(reference).toMatch(/^wf-[0-9a-f]{16}$/);
    expect(reference.length).toBeGreaterThanOrEqual(10);
    expect(reference.length).toBeLessThanOrEqual(20);
    expect(OnChainCollectionService.pseudonym('user-1').reference).toBe(reference);
    expect(OnChainCollectionService.pseudonym('user-2').reference).not.toBe(reference);
  });
});

describe('OnChainCollectionService sweep scheduling', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.wasteCollection.findUnique.mockResolvedValue(null);
  });

  const setPending = (value: boolean) => {
    (OnChainCollectionService as unknown as { workPending: boolean }).workPending = value;
  };

  it('does not query the database while nothing is pending', async () => {
    setPending(false);

    await OnChainCollectionService.tick();

    expect(prisma.wasteCollection.findMany).not.toHaveBeenCalled();
  });

  it('stops sweeping once a sweep finds nothing due', async () => {
    setPending(true);
    prisma.wasteCollection.findMany.mockResolvedValue([]);

    await OnChainCollectionService.tick();
    await OnChainCollectionService.tick();

    expect(prisma.wasteCollection.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps sweeping while collections are due', async () => {
    setPending(true);
    prisma.wasteCollection.findMany.mockResolvedValue([{ id: 'collection-1' }]);

    await OnChainCollectionService.tick();
    await OnChainCollectionService.tick();

    expect(prisma.wasteCollection.findMany).toHaveBeenCalledTimes(2);
  });

  it('resumes sweeping when a collection is approved', async () => {
    setPending(false);
    prisma.wasteCollection.findMany.mockResolvedValue([]);

    OnChainCollectionService.kick('collection-2');
    await OnChainCollectionService.tick();

    expect(prisma.wasteCollection.findMany).toHaveBeenCalledTimes(1);
  });
});
