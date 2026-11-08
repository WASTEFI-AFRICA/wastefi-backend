import { prepareIsolatedDatabase, disposeIsolatedDatabase } from '../helpers/isolated-database';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';
import { PointSigningService as Points } from '../../src/services/point-signing.service';
import { CollectionPointService } from '../../src/services/collection-point.service';
import { prisma } from '../../src/services/database.service';
import { SorobanService } from '../../src/services/soroban.service';
import { TESTNET_CONTRACTS as contracts } from '../../src/config/soroban-contracts';
import { config } from '../../src/config';
import { WalletSecretUtil } from '../../src/utils/wallet-secret.util';
import { JWTUtil } from '../../src/utils/jwt.util';

jest.mock('../../src/services/database.service', () => {
  const { prisma } = jest.requireActual('../helpers/isolated-database');
  return {
    __esModule: true,
    prisma,
    default: {
      getInstance: () => prisma,
      connect: () => prisma.$connect(),
      disconnect: () => prisma.$disconnect(),
    },
  };
});
jest.mock('../../src/services/soroban.service', () => ({
  ...jest.requireActual('../../src/services/soroban.service'),
  SorobanService: {
    enabled: false,
    contracts: jest.fn(),
    adminKeypair: jest.fn(),
    read: jest.fn(),
    invoke: jest.fn(),
    lookup: jest.fn(),
    ensureAccount: jest.fn(),
  },
}));
process.env.REDIS_ENABLED = 'false';
process.env.SEED_DEMO_DATA = 'false';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../../src/server');
const mocked = jest.mocked(SorobanService);
const adminKey = Keypair.random();
const registered = new Map<
  bigint,
  { owner: string; verification_status: string[]; accepted_materials: string[][] }
>();
const owners = new Map<string, bigint>();
const ownedPoints: string[] = [];
let pointId: string, adminId: string, token: string, legacyAddress: string;
const scope = () => ({
  pointId,
  networkPassphrase: config.soroban.networkPassphrase,
  registryContract: contracts.collection_point,
});
const methods = () => mocked.invoke.mock.calls.map((call) => call[1]);
const bodyData = {
  name: 'Point QA',
  latitude: 1,
  longitude: 1,
  address: 'Test street',
  city: 'Test city',
  contactPerson: 'Test',
  contactPhone: 'test-only',
};
const native = (value: xdr.ScVal) => scValToNative(value);

beforeAll(async () => {
  prepareIsolatedDatabase();
  const user = await prisma.user.create({
    data: {
      phoneNumber: 'point-' + randomUUID(),
      firstName: 'Point',
      lastName: 'QA',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  adminId = user.id;
  token = JWTUtil.generateToken({ userId: user.id, phoneNumber: user.phoneNumber, role: 'ADMIN' });
});
beforeEach(async () => {
  registered.clear();
  owners.clear();
  legacyAddress = Keypair.random().publicKey();
  pointId = (
    await prisma.collectionPoint.create({
      data: {
        ...bodyData,
        verifiedAt: new Date(),
        acceptedMaterials: '["PET","CARDBOARD"]',
        stellarAddress: legacyAddress,
      },
    })
  ).id;
  ownedPoints.push(pointId);
  mocked.contracts.mockReturnValue(contracts);
  mocked.adminKeypair.mockReturnValue(adminKey);
  mocked.ensureAccount.mockResolvedValue(undefined);
  mocked.read.mockImplementation(async (_contract, method, args = []) => {
    if (method === 'get_collection_point_contract') return contracts.collection_point;
    if (method === 'is_paused') return false;
    if (method === 'find_point_by_owner') return owners.get(native(args[0])) ?? null;
    if (method === 'get_point') return registered.get(native(args[0]));
    throw new Error('Unexpected read');
  });
  mocked.invoke.mockImplementation(async (_contract, method, args, signer, onSubmitted) => {
    if (method === 'register_point') {
      const owner = native(args[0]);
      if (owner !== signer.publicKey()) throw new Error('Incorrect point signer');
      const id = BigInt(registered.size + 1);
      if (onSubmitted) await onSubmitted('a'.repeat(64));
      registered.set(id, {
        owner,
        verification_status: ['Unverified'],
        accepted_materials: native(args[3]),
      });
      owners.set(owner, id);
      return { hash: 'a'.repeat(64), value: id };
    }
    const point = registered.get(native(args[0]));
    if (!point) throw new Error('Unknown point');
    if (method === 'verify_point') {
      if (signer.publicKey() !== adminKey.publicKey()) throw new Error('Incorrect admin signer');
      point.verification_status = ['Verified'];
    } else if (method === 'update_point') {
      if (signer.publicKey() !== point.owner) throw new Error('Incorrect point signer');
      point.accepted_materials = native(args[3]);
    } else throw new Error('Unexpected invoke');
    return { hash: 'b'.repeat(64), value: undefined };
  });
});
afterEach(async () => {
  await prisma.collectionPoint.deleteMany({ where: { id: { in: ownedPoints.splice(0) } } });
});
afterAll(async () => {
  try {
    if (adminId) await prisma.user.delete({ where: { id: adminId } });
  } finally {
    await disposeIsolatedDatabase();
  }
});

it('creates one encrypted key under concurrent first use without replacing the legacy identity', async () => {
  const signers = await Promise.all(Array.from({ length: 6 }, () => Points.wallet(pointId)));
  expect(new Set(signers.map((key) => key.publicKey())).size).toBe(1);
  const stored = await prisma.collectionPointWallet.findUniqueOrThrow({ where: { pointId } });
  expect(stored.secretKey.startsWith('v2:')).toBe(true);
  expect(Keypair.fromSecret(WalletSecretUtil.decrypt(stored.secretKey)).publicKey()).toBe(
    stored.publicKey
  );
  expect(
    (await prisma.collectionPoint.findUniqueOrThrow({ where: { id: pointId } })).stellarAddress
  ).toBe(legacyAddress);
});

it('registers with the point signer and verifies only a trusted point with admin', async () => {
  const signer = await Points.ready(pointId, contracts, 'Cardboard');
  expect(methods()).toEqual(['register_point', 'verify_point']);
  expect(mocked.invoke.mock.calls[0][3].publicKey()).toBe(signer.publicKey());
  expect(mocked.invoke.mock.calls[1][3].publicKey()).toBe(adminKey.publicKey());
  const [, , args] = mocked.invoke.mock.calls[0];
  expect(native(args[1])).toBe('WasteFi collection point');
  expect(native(args[2])).toMatch(/^wf-point-[0-9a-f]{20}$/);
  expect(native(args[3])).toEqual([['Cardboard'], ['Paper'], ['Plastic']]);
  const binding = await prisma.pointChainRegistration.findUniqueOrThrow({
    where: { point_network_registry: scope() },
  });
  expect(binding.registrationTxHash).toBe('a'.repeat(64));
  expect(binding.leaseToken).toBeNull();
  expect(binding.leaseUntil).toBeNull();
});

it('shares a preparation among concurrent callers and does not register again later', async () => {
  await Promise.all([
    Points.ready(pointId, contracts, 'Plastic'),
    Points.ready(pointId, contracts, 'Cardboard'),
  ]);
  expect(methods().filter((method) => method === 'register_point')).toHaveLength(1);
  mocked.invoke.mockClear();
  await Points.ready(pointId, contracts, 'Plastic');
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it.each([
  { isActive: false },
  { verifiedAt: null },
  { acceptedMaterials: null },
  { acceptedMaterials: 'bad-json' },
  { acceptedMaterials: '["unsupported"]' },
])('blocks untrusted or invalid points before provisioning: %s', async (data) => {
  await prisma.collectionPoint.update({ where: { id: pointId }, data });
  await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow();
  expect(await prisma.collectionPointWallet.count({ where: { pointId } })).toBe(0);
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it('rejects an unsupported collection material before creating a wallet', async () => {
  await expect(Points.ready(pointId, contracts, 'Metal')).rejects.toThrow('not accepted');
  expect(await prisma.collectionPointWallet.count({ where: { pointId } })).toBe(0);
});

it('rejects an old or wrongly wired transaction ABI before generating or funding a key', async () => {
  mocked.read.mockRejectedValue(new Error('method unavailable'));
  await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow('method unavailable');
  expect(await prisma.collectionPointWallet.count({ where: { pointId } })).toBe(0);
  expect(mocked.ensureAccount).not.toHaveBeenCalled();
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it('does not turn a failed registry lookup into a new registration', async () => {
  const original = mocked.read.getMockImplementation()!;
  mocked.read.mockImplementation((contract, method, args) =>
    method === 'find_point_by_owner'
      ? Promise.reject(new Error('RPC unavailable'))
      : original(contract, method, args)
  );
  await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow('RPC unavailable');
  expect(mocked.invoke).not.toHaveBeenCalled();
  expect(
    (
      await prisma.pointChainRegistration.findUniqueOrThrow({
        where: { point_network_registry: scope() },
      })
    ).leaseToken
  ).toBeNull();
});

it('holds an unknown registration hash instead of registering again', async () => {
  await Points.wallet(pointId);
  await prisma.pointChainRegistration.create({
    data: { ...scope(), registrationTxHash: 'unknown-hash' },
  });
  mocked.lookup.mockResolvedValue({ status: 'NOT_FOUND' });
  await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow('outcome is unknown');
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it('recovers a registered identity even if its saved hash is no longer available', async () => {
  const signer = await Points.wallet(pointId);
  registered.set(5n, {
    owner: signer.publicKey(),
    verification_status: ['Unverified'],
    accepted_materials: [['Cardboard'], ['Paper'], ['Plastic']],
  });
  owners.set(signer.publicKey(), 5n);
  await prisma.pointChainRegistration.create({
    data: { ...scope(), registrationTxHash: 'old-hash' },
  });
  await Points.ready(pointId, contracts, 'Plastic');
  expect(methods()).toEqual(['verify_point']);
  expect(mocked.lookup).not.toHaveBeenCalled();
});

it('respects another worker lease and can recover an expired lease', async () => {
  await Points.wallet(pointId);
  await prisma.pointChainRegistration.create({
    data: { ...scope(), leaseToken: 'other-worker', leaseUntil: new Date(Date.now() + 60000) },
  });
  await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow('in progress');
  expect(
    (
      await prisma.pointChainRegistration.findUniqueOrThrow({
        where: { point_network_registry: scope() },
      })
    ).leaseToken
  ).toBe('other-worker');
  expect(mocked.invoke).not.toHaveBeenCalled();
  await prisma.pointChainRegistration.update({
    where: { point_network_registry: scope() },
    data: { leaseUntil: new Date(0) },
  });
  await Points.ready(pointId, contracts, 'Plastic');
  expect(methods()).toEqual(['register_point', 'verify_point']);
});

it('does not bypass a registry rejection or owner mismatch', async () => {
  const signer = await Points.wallet(pointId);
  owners.set(signer.publicKey(), 5n);
  registered.set(5n, {
    owner: signer.publicKey(),
    verification_status: ['Rejected'],
    accepted_materials: [['Plastic']],
  });
  await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow(
    'administrative review'
  );
  registered.get(5n)!.owner = Keypair.random().publicKey();
  await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow('mismatch');
  expect(mocked.invoke).not.toHaveBeenCalled();
});

it('updates accepted materials with the owner key before allowing verification', async () => {
  const signer = await Points.wallet(pointId);
  owners.set(signer.publicKey(), 5n);
  registered.set(5n, {
    owner: signer.publicKey(),
    verification_status: ['Verified'],
    accepted_materials: [['Plastic']],
  });
  await Points.ready(pointId, contracts, 'Cardboard');
  expect(methods()).toEqual(['update_point']);
});

it('rechecks activation and key identity when signing a pinned record', async () => {
  const signer = await Points.wallet(pointId);
  await expect(Points.signer(pointId, 'Plastic', Keypair.random().publicKey())).rejects.toThrow(
    'pinned identity'
  );
  await prisma.collectionPoint.update({ where: { id: pointId }, data: { isActive: false } });
  await expect(Points.signer(pointId, 'Plastic', signer.publicKey())).rejects.toThrow('active');
});

it('never replaces a missing or corrupt key for a pinned identity', async () => {
  await expect(
    Points.ready(pointId, contracts, 'Plastic', Keypair.random().publicKey())
  ).rejects.toThrow('key is missing');
  expect(await prisma.collectionPointWallet.count({ where: { pointId } })).toBe(0);
  const signer = await Points.wallet(pointId);
  await prisma.collectionPointWallet.update({
    where: { pointId },
    data: { secretKey: 'v2:invalid' },
  });
  await expect(Points.signer(pointId, 'Plastic', signer.publicKey())).rejects.toThrow(
    'could not be opened'
  );
  expect(
    (await prisma.collectionPointWallet.findUniqueOrThrow({ where: { pointId } })).publicKey
  ).toBe(signer.publicKey());
});

it('omits private wallet data from public point responses and nearby service branches', async () => {
  await Points.wallet(pointId);
  for (const path of [
    '/collection-points',
    '/collection-points?latitude=1&longitude=1&radius=10',
    '/collection-points/nearby?latitude=1&longitude=1',
    `/collection-points/${pointId}`,
  ]) {
    const response = await request(app).get('/api/v1' + path);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('secretKey');
    expect(JSON.stringify(response.body)).not.toContain('signingWallet');
  }
  for (const city of [null, 'Test city']) {
    await prisma.user.update({ where: { id: adminId }, data: { city } });
    const nearby = await CollectionPointService.getNearbyForUser(adminId);
    expect(JSON.stringify(nearby)).not.toContain('secretKey');
  }
});

it('ignores nested wallet injection and protected scalar changes on point updates', async () => {
  const signer = await Points.wallet(pointId);
  const response = await request(app)
    .put(`/api/v1/collection-points/${pointId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Updated point',
      stellarAddress: Keypair.random().publicKey(),
      verifiedAt: null,
      signingWallet: { update: { secretKey: 'injected', publicKey: Keypair.random().publicKey() } },
    });
  expect(response.status).toBe(200);
  expect(response.body.data.name).toBe('Updated point');
  expect(JSON.stringify(response.body)).not.toContain('secretKey');
  expect(
    (await prisma.collectionPoint.findUniqueOrThrow({ where: { id: pointId } })).stellarAddress
  ).toBe(legacyAddress);
  expect((await Points.wallet(pointId)).publicKey()).toBe(signer.publicKey());
});

it('keeps create and verify responses public and ignores wallet creation injection', async () => {
  const created = await request(app)
    .post('/api/v1/collection-points')
    .set('Authorization', `Bearer ${token}`)
    .send({
      ...bodyData,
      acceptedMaterials: ['PET'],
      signingWallet: { create: { publicKey: Keypair.random().publicKey(), secretKey: 'injected' } },
    });
  expect(created.status).toBe(201);
  const id = created.body.data.id;
  ownedPoints.push(id);
  expect(JSON.stringify(created.body)).not.toContain('secretKey');
  expect(await prisma.collectionPointWallet.count({ where: { pointId: id } })).toBe(0);
  await Points.wallet(id);
  const verified = await request(app)
    .post(`/api/v1/collection-points/${id}/verify`)
    .set('Authorization', `Bearer ${token}`);
  expect(verified.status).toBe(200);
  expect(JSON.stringify(verified.body)).not.toContain('secretKey');
  expect(JSON.stringify(verified.body)).not.toContain('signingWallet');
});

it('can register after the previously submitted registration is confirmed failed', async () => {
  await Points.wallet(pointId);
  await prisma.pointChainRegistration.create({
    data: { ...scope(), registrationTxHash: 'failed-hash' },
  });
  mocked.lookup.mockResolvedValue({ status: 'FAILED' });
  await Points.ready(pointId, contracts, 'Plastic');
  expect(methods()).toEqual(['register_point', 'verify_point']);
  expect(
    (
      await prisma.pointChainRegistration.findUniqueOrThrow({
        where: { point_network_registry: scope() },
      })
    ).registrationTxHash
  ).toBe('a'.repeat(64));
});

it.each([null, 'incorrect-registry'])(
  'rejects a missing or mismatched registry before creating a key: %s',
  async (registry) => {
    mocked.read.mockResolvedValue(registry);
    await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow('does not match');
    expect(await prisma.collectionPointWallet.count({ where: { pointId } })).toBe(0);
    expect(mocked.invoke).not.toHaveBeenCalled();
  }
);

it.each([contracts.waste_transaction, contracts.collection_point])(
  'does not provision through a paused contract: %s',
  async (paused) => {
    const original = mocked.read.getMockImplementation()!;
    mocked.read.mockImplementation((contract, method, args) =>
      method === 'is_paused' && contract === paused
        ? Promise.resolve(true)
        : original(contract, method, args)
    );
    await expect(Points.ready(pointId, contracts, 'Plastic')).rejects.toThrow('paused');
    expect(await prisma.collectionPointWallet.count({ where: { pointId } })).toBe(0);
    expect(mocked.invoke).not.toHaveBeenCalled();
  }
);

it('does not propagate private storage error details', async () => {
  jest
    .spyOn(prisma.collectionPointWallet, 'createMany')
    .mockRejectedValueOnce(new Error('private storage payload'));
  await expect(Points.wallet(pointId)).rejects.toThrow('Point signing key could not be stored');
});
