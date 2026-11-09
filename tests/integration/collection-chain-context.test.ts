import { config } from '../../src/config';
import { randomUUID, randomBytes } from 'crypto';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { prisma } from '../../src/services/database.service';
import { TESTNET_CONTRACTS, SorobanContracts } from '../../src/config/soroban-contracts';
import { CollectionChainContextService as Context } from '../../src/services/collection-chain-context.service';
import { CollectionChainBackfillService as Backfill } from '../../src/services/collection-chain-backfill.service';
import { SorobanService } from '../../src/services/soroban.service';

jest.mock('../../src/services/soroban.service', () => ({
  ...jest.requireActual('../../src/services/soroban.service'),
  SorobanService: { contracts: jest.fn(), read: jest.fn(), lookup: jest.fn(), invoke: jest.fn() },
}));

const contracts = () => ({
  ...TESTNET_CONTRACTS,
  waste_transaction: StrKey.encodeContract(randomBytes(32)),
  payment_distribution: StrKey.encodeContract(randomBytes(32)),
});
let bundle: SorobanContracts;
let collector: string;
let point: string;
let userId: string;
let pointId: string;
const rows: string[] = [];
const namespaces = new Set<string>();
const mocked = jest.mocked(SorobanService);

async function createRow() {
  const row = await prisma.wasteCollection.create({
    data: {
      collectorId: userId,
      collectionPointId: pointId,
      materialType: 'PET',
      materialCategory: 'Plastic',
      weight: 2,
      imageUrls: '[]',
      paymentAmount: 50,
      verifiedAt: new Date(),
      chainStatus: 'PENDING',
    },
  });
  rows.push(row.id);
  return row;
}

function record(id = 7n) {
  return {
    id,
    collector,
    collection_point: point,
    material_type: ['Plastic'],
    weight: 2000n,
    total_amount: 16_000_000n,
    verified: false,
    status: ['Pending'],
  };
}

beforeEach(async () => {
  bundle = contracts();
  namespaces.add(bundle.payment_distribution);
  mocked.contracts.mockReturnValue(bundle);
  collector = Keypair.random().publicKey();
  point = Keypair.random().publicKey();
  userId = (
    await prisma.user.create({
      data: {
        phoneNumber: `pin-${randomUUID()}`,
        firstName: 'Context',
        lastName: 'Test',
        stellarPublicKey: collector,
      },
    })
  ).id;
  pointId = (
    await prisma.collectionPoint.create({
      data: {
        name: 'Context test',
        latitude: 1,
        longitude: 1,
        address: 'Test street',
        city: 'Test city',
        contactPerson: 'Test',
        contactPhone: 'test-only',
        stellarAddress: point,
      },
    })
  ).id;
});

afterEach(async () => {
  await prisma.wasteCollection.deleteMany({ where: { id: { in: rows.splice(0) } } });
  await prisma.collectionPoint.delete({ where: { id: pointId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.chainPaymentNamespace.deleteMany({
    where: { paymentContract: { in: [...namespaces] } },
  });
  namespaces.clear();
});
afterAll(() => prisma.$disconnect());

it('pins once when two workers choose different deployments for one collection', async () => {
  const row = await createRow();
  const first = Context.snapshot(collector, point);
  const other = contracts();
  namespaces.add(other.payment_distribution);
  mocked.contracts.mockReturnValue(other);
  const second = Context.snapshot(collector, point);
  const [a, b] = await Promise.all([Context.pinNew(row.id, first), Context.pinNew(row.id, second)]);
  expect(a).toEqual(b);
  const stored = await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } });
  expect(stored.chainContext).toEqual(a);
  expect(
    await prisma.chainPaymentNamespace.count({
      where: { paymentContract: { in: [...namespaces] } },
    })
  ).toBe(1);
});

it('rejects reuse of a payment namespace and rolls back the new collection binding', async () => {
  const a = await createRow();
  await Context.pinNew(a.id, Context.snapshot(collector, point));
  const b = await createRow();
  mocked.contracts.mockReturnValue({ ...bundle, waste_transaction: contracts().waste_transaction });
  await expect(Context.pinNew(b.id, Context.snapshot(collector, point))).rejects.toThrow(
    'already bound'
  );
  expect(
    (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: b.id } })).chainContext
  ).toBeNull();
  expect(
    (
      await prisma.chainPaymentNamespace.findUniqueOrThrow({
        where: {
          network_payment: {
            networkPassphrase: Context.snapshot(collector, point).networkPassphrase,
            paymentContract: bundle.payment_distribution,
          },
        },
      })
    ).transactionContract
  ).toBe(bundle.waste_transaction);
});

it('allows separate collections in the same deployment to share a payment namespace', async () => {
  const a = await createRow();
  const b = await createRow();
  const context = Context.snapshot(collector, point);
  await Promise.all([Context.pinNew(a.id, context), Context.pinNew(b.id, context)]);
  expect(
    await prisma.chainPaymentNamespace.count({
      where: { paymentContract: bundle.payment_distribution },
    })
  ).toBe(1);
});

it('does not auto-bind a preexisting record to the current deployment', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({ where: { id: row.id }, data: { chainTransactionId: '7' } });
  await expect(Context.pinNew(row.id, Context.snapshot(collector, point))).rejects.toThrow(
    'backfill'
  );
  expect(
    (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).chainContext
  ).toBeNull();
  expect(
    await prisma.chainPaymentNamespace.count({
      where: { paymentContract: bundle.payment_distribution },
    })
  ).toBe(0);
});

it('previews a historical record without changing rows or claiming a namespace', async () => {
  const row = await createRow();
  const before = await prisma.wasteCollection.update({
    where: { id: row.id },
    data: {
      chainStatus: 'RECORDED',
      chainTransactionId: '7',
      chainRecordTxHash: 'historic-record',
    },
  });
  mocked.read.mockResolvedValue(record());
  expect(await Backfill.pin(row.id, false)).toBe('would_pin');
  expect(await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).toEqual(before);
  expect(
    await prisma.chainPaymentNamespace.count({
      where: { paymentContract: bundle.payment_distribution },
    })
  ).toBe(0);
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it('backfills a checked historical record and preserves its progress and hashes', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({
    where: { id: row.id },
    data: {
      chainStatus: 'RECORDED',
      chainTransactionId: '7',
      chainAmount: '16000000',
      chainRecordTxHash: 'historic-record',
    },
  });
  mocked.read.mockResolvedValue(record());
  expect(await Backfill.pin(row.id, true)).toBe('pinned');
  const stored = await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } });
  expect(stored).toMatchObject({
    chainStatus: 'RECORDED',
    chainTransactionId: '7',
    chainAmount: '16000000',
    chainRecordTxHash: 'historic-record',
  });
  expect(stored.chainContext).toEqual(
    Context.snapshot(collector, point, 'admin_v1', 'caller_amount_v1')
  );
  expect(mocked.read.mock.calls[0][0]).toBe(bundle.waste_transaction);
  expect(mocked.invoke).not.toHaveBeenCalled();
  mocked.read.mockClear();
  expect(await Backfill.pin(row.id, true)).toBe('already_pinned');
  expect(mocked.read).not.toHaveBeenCalled();
  expect(
    (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).updatedAt
  ).toEqual(stored.updatedAt);
});

it('recovers and persists a confirmed transaction ID with its context', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({
    where: { id: row.id },
    data: { chainRecordTxHash: 'confirmed-hash' },
  });
  mocked.lookup.mockResolvedValue({ status: 'SUCCESS', value: 9n });
  mocked.read.mockResolvedValue(record(9n));
  expect(await Backfill.pin(row.id, true)).toBe('pinned');
  expect(
    (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).chainTransactionId
  ).toBe('9');
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it('leaves unknown submitted outcomes for review instead of guessing a deployment', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({
    where: { id: row.id },
    data: { chainRecordTxHash: 'unknown-hash' },
  });
  mocked.lookup.mockResolvedValue({ status: 'NOT_FOUND' });
  await expect(Backfill.pin(row.id, true)).rejects.toThrow('outcome is unknown');
  expect(
    (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).chainContext
  ).toBeNull();
});

it('refuses to pin the wrong chain record', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({ where: { id: row.id }, data: { chainTransactionId: '7' } });
  mocked.read.mockResolvedValue({ ...record(), collection_point: Keypair.random().publicKey() });
  await expect(Backfill.pin(row.id, true)).rejects.toThrow('does not match');
  expect(
    (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).chainContext
  ).toBeNull();
  expect(
    await prisma.chainPaymentNamespace.count({
      where: { paymentContract: bundle.payment_distribution },
    })
  ).toBe(0);
});

it('does not overwrite progress that changed during the backfill inspection', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({ where: { id: row.id }, data: { chainTransactionId: '7' } });
  mocked.read.mockImplementation(async () => {
    await prisma.wasteCollection.update({ where: { id: row.id }, data: { chainAmount: '1' } });
    return record();
  });
  await expect(Backfill.pin(row.id, true)).rejects.toThrow('changed during backfill');
  const stored = await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } });
  expect(stored.chainContext).toBeNull();
  expect(stored.chainAmount).toBe('1');
});

it('checks completed payments while pinning paid history without changing payment hashes', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({
    where: { id: row.id },
    data: {
      chainStatus: 'PAID',
      chainTransactionId: '7',
      chainAmount: '16000000',
      chainPaymentId: '3',
      chainPaymentTxHash: 'old-payment-hash',
    },
  });
  mocked.read.mockImplementation(async (_contract, method) => {
    if (method === 'get_transaction') return { ...record(), verified: true, status: ['Completed'] };
    if (method === 'get_payment_for_transaction') return 3n;
    return {
      id: 3n,
      transaction_id: 7n,
      recipient: collector,
      amount: 16_000_000n,
      status: ['Completed'],
    };
  });
  expect(await Backfill.pin(row.id, true)).toBe('pinned');
  expect(await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
    chainStatus: 'PAID',
    chainPaymentId: '3',
    chainPaymentTxHash: 'old-payment-hash',
    chainContext: Context.snapshot(collector, point, 'admin_v1', 'caller_amount_v1'),
  });
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it.each(['mapping', 'recipient', 'not_completed'])(
  'rejects invalid paid history: %s',
  async (failure) => {
    const row = await createRow();
    await prisma.wasteCollection.update({
      where: { id: row.id },
      data: {
        chainStatus: 'PAID',
        chainTransactionId: '7',
        chainAmount: '16000000',
        chainPaymentId: '3',
      },
    });
    mocked.read.mockImplementation(async (_contract, method) => {
      if (method === 'get_transaction')
        return { ...record(), verified: true, status: ['Completed'] };
      if (method === 'get_payment_for_transaction') return failure === 'mapping' ? 99n : 3n;
      return {
        id: 3n,
        transaction_id: 7n,
        amount: 16_000_000n,
        recipient: failure === 'recipient' ? Keypair.random().publicKey() : collector,
        status: [failure === 'not_completed' ? 'Pending' : 'Completed'],
      };
    });
    await expect(Backfill.pin(row.id, true)).rejects.toThrow();
    expect(
      (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).chainContext
    ).toBeNull();
    expect(mocked.invoke).not.toHaveBeenCalled();
  }
);

it('reports a conflicting payment namespace during preview without writing metadata', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({ where: { id: row.id }, data: { chainTransactionId: '7' } });
  const context = Context.snapshot(collector, point);
  await prisma.chainPaymentNamespace.create({
    data: {
      networkPassphrase: context.networkPassphrase,
      paymentContract: bundle.payment_distribution,
      transactionContract: contracts().waste_transaction,
    },
  });
  await expect(Backfill.pin(row.id, false)).rejects.toThrow('already bound');
  expect(mocked.read).not.toHaveBeenCalled();
  expect(
    (await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } })).chainContext
  ).toBeNull();
});

it('always backfills legacy work as admin even when the current default is point mode', async () => {
  const row = await createRow();
  await prisma.wasteCollection.update({ where: { id: row.id }, data: { chainTransactionId: '7' } });
  mocked.read.mockResolvedValue(record());
  const previous = config.soroban.collectionFlow;
  config.soroban.collectionFlow = 'point_owner_v1';
  try {
    await Backfill.pin(row.id, true);
    const stored = await prisma.wasteCollection.findUniqueOrThrow({ where: { id: row.id } });
    expect(Context.parse(stored.chainContext).flow).toBe('admin_v1');
  } finally {
    config.soroban.collectionFlow = previous;
  }
});
