import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { config } from '../../../src/config';
import { TESTNET_CONTRACTS } from '../../../src/config/soroban-contracts';
import { CollectionChainContextService as Context } from '../../../src/services/collection-chain-context.service';

jest.mock('../../../src/services/database.service', () => ({
  __esModule: true,
  prisma: {},
}));
jest.mock('../../../src/services/soroban.service', () => ({
  __esModule: true,
  SorobanService: { contracts: jest.fn(), read: jest.fn() },
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const { SorobanService } = require('../../../src/services/soroban.service');
/* eslint-enable @typescript-eslint/no-var-requires */

const collector = Keypair.random().publicKey();
const point = Keypair.random().publicKey();
const OTHER = StrKey.encodeContract(Buffer.alloc(32, 5));

const stored = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  flow: 'admin_v1',
  networkPassphrase: config.soroban.networkPassphrase,
  contracts: TESTNET_CONTRACTS,
  collectorAddress: collector,
  pointAddress: point,
  ...extra,
});

beforeEach(() => {
  SorobanService.contracts.mockReset().mockReturnValue(TESTNET_CONTRACTS);
  SorobanService.read.mockReset();
});

describe('collection chain context payment mode', () => {
  it('treats a context pinned before derived payouts as caller-supplied amounts', () => {
    expect(Context.parse(stored()).payment).toBe('caller_amount_v1');
  });

  it.each(['caller_amount_v1', 'derived_v1'])('keeps a stored %s mode', (mode) => {
    expect(Context.parse(stored({ payment: mode })).payment).toBe(mode);
  });

  it.each([null, '', 'derived', 7, {}])('rejects the unknown payment mode %p', (mode) => {
    expect(() => Context.parse(stored({ payment: mode }))).toThrow(
      'Invalid collection chain context'
    );
  });

  it('pins the configured mode, or an explicit one', () => {
    expect(Context.snapshot(collector, point).payment).toBe(config.soroban.paymentMode);
    expect(Context.snapshot(collector, point, 'admin_v1', 'derived_v1').payment).toBe('derived_v1');
    expect(Context.snapshot(collector, point, 'admin_v1', 'caller_amount_v1').payment).toBe(
      'caller_amount_v1'
    );
  });

  it('round-trips through the stored JSON', () => {
    const context = Context.snapshot(collector, point, 'point_owner_v1', 'derived_v1');
    expect(Context.parse(JSON.parse(JSON.stringify(Context.json(context))))).toEqual(context);
  });
});

describe('derived payment binding check', () => {
  const derived = () => Context.parse(stored({ payment: 'derived_v1' }));

  it('passes when the payment contract is bound to the bundle transaction contract', async () => {
    SorobanService.read.mockResolvedValue(TESTNET_CONTRACTS.waste_transaction);

    await expect(Context.requireDerivedPayments(derived())).resolves.toBeUndefined();
    expect(SorobanService.read).toHaveBeenCalledWith(
      TESTNET_CONTRACTS.payment_distribution,
      'get_transaction_contract'
    );
  });

  it.each([null, OTHER])('fails closed when the binding is %p', async (bound) => {
    SorobanService.read.mockResolvedValue(bound);

    await expect(Context.requireDerivedPayments(derived())).rejects.toThrow('not bound');
  });

  it('fails closed when the chain cannot be read', async () => {
    SorobanService.read.mockRejectedValue(new Error('rpc unavailable'));

    await expect(Context.requireDerivedPayments(derived())).rejects.toThrow('rpc unavailable');
  });

  it('makes no chain call for caller-supplied payouts', async () => {
    await Context.requireDerivedPayments(Context.parse(stored()));

    expect(SorobanService.read).not.toHaveBeenCalled();
  });
});
