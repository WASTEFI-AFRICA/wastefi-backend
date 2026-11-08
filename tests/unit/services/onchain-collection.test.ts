import { Keypair, StrKey, scValToNative, xdr } from '@stellar/stellar-sdk';
import { OnChainCollectionService } from '../../../src/services/onchain-collection.service';
import { TESTNET_CONTRACTS } from '../../../src/config/soroban-contracts';
import { config } from '../../../src/config';

jest.mock('../../../src/services/database.service', () => ({
  __esModule: true,
  prisma: {
    wasteCollection: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    chainPaymentNamespace: { createMany: jest.fn(), findUniqueOrThrow: jest.fn() },
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

const CONTEXT = {
  version: 1,
  flow: 'admin_v1',
  networkPassphrase: config.soroban.networkPassphrase,
  contracts: TESTNET_CONTRACTS,
  collectorAddress: collector.publicKey(),
  pointAddress: POINT,
};
const OTHER_CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 8));

const baseCollection = {
  id: 'collection-1',
  collectorId: 'user-1',
  materialCategory: 'Plastic',
  weight: 3.25,
  chainStatus: 'PENDING',
  chainContext: null,
  chainAmount: null,
  chainPaymentId: null,
  chainVerifyTxHash: null,
  chainPaymentTxHash: null,
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
  record?: Record<string, unknown>;
  payment?: Record<string, unknown>;
}) {
  let transactionId = 7n;
  SorobanService.read.mockImplementation(
    async (_contract: string, method: string, args: xdr.ScVal[]) => {
      switch (method) {
        case 'is_active':
          return state.active ?? true;
        case 'exists':
          return state.exists ?? true;
        case 'get_transaction':
          transactionId = scValToNative(args[0]);
          return {
            id: transactionId,
            collector: collector.publicKey(),
            collection_point: POINT,
            material_type: ['Plastic'],
            weight: 3250n,
            total_amount: 26_000_000n,
            verified: state.verified ?? false,
            status: [state.verified ? 'Completed' : 'Pending'],
            ...state.record,
          };
        case 'get_payment_for_transaction':
          return state.paymentId ?? null;
        case 'get_payment':
          return {
            id: scValToNative(args[0]),
            transaction_id: transactionId,
            recipient: collector.publicKey(),
            amount: 26_000_000n,
            status: [state.paymentStatus ?? 'Pending'],
            ...state.payment,
          };
        default:
          throw new Error(`unexpected read ${method}`);
      }
    }
  );
}

const invokedMethods = () => SorobanService.invoke.mock.calls.map((c: unknown[]) => c[1]);
const lastUpdate = () => {
  const calls = prisma.wasteCollection.update.mock.calls;
  return calls[calls.length - 1][0].data;
};

describe('OnChainCollectionService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    SorobanService.contracts.mockReturnValue(TESTNET_CONTRACTS);
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    prisma.wasteCollection.updateMany.mockResolvedValue({ count: 1 });
    prisma.wasteCollection.findUniqueOrThrow.mockResolvedValue({ chainContext: CONTEXT });
    prisma.chainPaymentNamespace.createMany.mockResolvedValue({ count: 1 });
    prisma.chainPaymentNamespace.findUniqueOrThrow.mockResolvedValue({
      transactionContract: TESTNET_CONTRACTS.waste_transaction,
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

  it('keeps using the pinned deployment and point after configuration changes', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: CONTEXT,
      collectionPoint: { id: 'point-1', stellarAddress: Keypair.random().publicKey() },
    });
    SorobanService.contracts.mockReturnValue(
      Object.fromEntries(Object.keys(TESTNET_CONTRACTS).map((name) => [name, OTHER_CONTRACT]))
    );
    chain({ active: false, exists: false });
    await OnChainCollectionService.process('collection-1');
    expect(lastUpdate()).toEqual({ chainStatus: 'PAID', chainError: null });
    for (const [contract, method] of SorobanService.invoke.mock.calls) {
      expect(contract).toBe(
        method === 'register' || method === 'update_status'
          ? TESTNET_CONTRACTS.collector_registry
          : method === 'record_with_price_lookup' || method === 'verify_transaction'
            ? TESTNET_CONTRACTS.waste_transaction
            : TESTNET_CONTRACTS.payment_distribution
      );
    }
    const recording = SorobanService.invoke.mock.calls.find(
      (call: unknown[]) => call[1] === 'record_with_price_lookup'
    );
    expect(scValToNative(recording[2][1])).toBe(POINT);
  });

  it('does not broadcast a delivery if its context cannot be saved', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({ ...baseCollection });
    prisma.wasteCollection.updateMany.mockRejectedValue(new Error('database unavailable'));
    chain({});
    await OnChainCollectionService.process('collection-1');
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainStatus).toBe('FAILED');
  });

  it('fails closed when existing progress has no pinned deployment', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainTransactionId: '7',
    });
    chain({});
    await OnChainCollectionService.process('collection-1');
    expect(SorobanService.read).not.toHaveBeenCalled();
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainError).toContain('context backfill');
  });

  it('rejects a stored context for another network before preparing a wallet', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: { ...CONTEXT, networkPassphrase: 'another network' },
    });
    await OnChainCollectionService.process('collection-1');
    expect(StellarService.createUserWallet).not.toHaveBeenCalled();
    expect(SorobanService.read).not.toHaveBeenCalled();
    expect(lastUpdate().chainStatus).toBe('FAILED');
  });

  it.each([
    { version: 2 },
    { flow: 'point_owner_v1' },
    { collectorAddress: 'invalid' },
    { pointAddress: 'invalid' },
    { contracts: { ...TESTNET_CONTRACTS, waste_transaction: 'invalid' } },
  ])('rejects an unsupported or malformed stored context: %s', async (override) => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: { ...CONTEXT, ...override },
    });
    await OnChainCollectionService.process('collection-1');
    expect(StellarService.createUserWallet).not.toHaveBeenCalled();
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainError).toContain('Invalid collection chain context');
  });

  it('does not use a replacement collector wallet for a pinned collection', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: CONTEXT,
    });
    const replacement = Keypair.random();
    StellarService.createUserWallet.mockResolvedValue({
      publicKey: replacement.publicKey(),
      secretKey: replacement.secret(),
    });
    chain({});
    await OnChainCollectionService.process('collection-1');
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainError).toContain('Collector wallet');
  });

  it.each([
    { id: 9n },
    { collector: Keypair.random().publicKey() },
    { collection_point: Keypair.random().publicKey() },
    { material_type: ['Metal'] },
    { weight: 999n },
    { total_amount: 0n },
    { verified: true, status: ['Pending'] },
    { verified: false, status: ['Cancelled'] },
    { verified: false, status: ['Disputed'] },
  ])('rejects mismatched record metadata before verification or payment: %s', async (record) => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: CONTEXT,
      chainTransactionId: '7',
    });
    chain({ record });
    await OnChainCollectionService.process('collection-1');
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainStatus).toBe('FAILED');
  });

  it('rejects a changed amount when resuming a previously recorded collection', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: CONTEXT,
      chainTransactionId: '7',
      chainAmount: '1',
    });
    chain({});
    await OnChainCollectionService.process('collection-1');
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainStatus).toBe('FAILED');
  });

  it.each([
    { id: 99n },
    { transaction_id: 99n },
    { recipient: Keypair.random().publicKey() },
    { amount: 1n },
    { status: ['Failed'] },
    { status: ['Refunded'] },
  ])('does not complete or mark paid a mismatched payment: %s', async (payment) => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: CONTEXT,
      chainTransactionId: '7',
    });
    chain({ verified: true, paymentId: 3n, payment });
    await OnChainCollectionService.process('collection-1');
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainStatus).toBe('FAILED');
  });

  it.each([null, 8n])(
    'does not replace a stored payment ID when the mapping returns %s',
    async (paymentId) => {
      prisma.wasteCollection.findUnique.mockResolvedValue({
        ...baseCollection,
        chainContext: CONTEXT,
        chainTransactionId: '7',
        chainPaymentId: '3',
      });
      chain({ verified: true, paymentId });
      await OnChainCollectionService.process('collection-1');
      expect(SorobanService.invoke).not.toHaveBeenCalled();
      expect(lastUpdate().chainError).toContain('Payment mapping');
    }
  );

  it('does not record again when the saved record hash has an unknown outcome', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: CONTEXT,
      chainRecordTxHash: 'unknown-hash',
    });
    SorobanService.lookup.mockResolvedValue({ status: 'NOT_FOUND' });
    chain({});
    await OnChainCollectionService.process('collection-1');
    expect(SorobanService.invoke).not.toHaveBeenCalled();
    expect(lastUpdate().chainError).toContain('outcome is unknown');
  });

  it('can retry recording after the previous transaction is known to have failed', async () => {
    prisma.wasteCollection.findUnique.mockResolvedValue({
      ...baseCollection,
      chainContext: CONTEXT,
      chainRecordTxHash: 'failed-hash',
    });
    SorobanService.lookup.mockResolvedValue({ status: 'FAILED' });
    chain({});
    await OnChainCollectionService.process('collection-1');
    expect(invokedMethods()).toContain('record_with_price_lookup');
    expect(lastUpdate().chainStatus).toBe('PAID');
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
      chainContext: CONTEXT,
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
      chainContext: CONTEXT,
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

describe('OnChainCollectionService.prepareCollector', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    SorobanService.contracts.mockReturnValue(TESTNET_CONTRACTS);
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    prisma.wasteCollection.updateMany.mockResolvedValue({ count: 1 });
    prisma.wasteCollection.findUniqueOrThrow.mockResolvedValue({ chainContext: CONTEXT });
    prisma.chainPaymentNamespace.createMany.mockResolvedValue({ count: 1 });
    prisma.chainPaymentNamespace.findUniqueOrThrow.mockResolvedValue({
      transactionContract: TESTNET_CONTRACTS.waste_transaction,
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

  it('registers a new collector once, however many callers ask at the same time', async () => {
    chain({ active: false, exists: false });
    prisma.wasteCollection.findUnique.mockResolvedValue({ ...baseCollection });

    // Two submissions and an approval for the same collector, all at once
    OnChainCollectionService.prepareCollector('user-1');
    OnChainCollectionService.prepareCollector('user-1');
    await OnChainCollectionService.process('collection-1');

    expect(StellarService.createUserWallet).toHaveBeenCalledTimes(1);
    expect(invokedMethods().filter((m: string) => m === 'register')).toHaveLength(1);
    expect(invokedMethods()).toContain('update_payment_status');
  });

  it('logs and carries on when preparation fails', async () => {
    StellarService.createUserWallet.mockRejectedValue(new Error('friendbot down'));

    expect(() => OnChainCollectionService.prepareCollector('user-2')).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
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
