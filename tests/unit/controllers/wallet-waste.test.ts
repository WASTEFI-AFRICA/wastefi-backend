import { WalletController } from '../../../src/controllers/wallet.controller';

jest.mock('../../../src/services/database.service', () => ({
  __esModule: true,
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('../../../src/services/soroban.service', () => {
  const actual = jest.requireActual('../../../src/services/soroban.service');
  return {
    __esModule: true,
    ScArg: actual.ScArg,
    SorobanService: { enabled: true, read: jest.fn(), contracts: () => ({ waste_token: 'TOKEN' }) },
  };
});

/* eslint-disable @typescript-eslint/no-var-requires */
const { prisma } = require('../../../src/services/database.service');
const { SorobanService } = require('../../../src/services/soroban.service');
/* eslint-enable @typescript-eslint/no-var-requires */

const ADDRESS = 'GCUG3TKDZDIA37SXDYACUFQMWZ67F7LFTB65WEJU72XITYR6FQS5J4B7';

function call() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const req = { user: { userId: 'user-1', role: 'COLLECTOR' } };
  return WalletController.getWasteBalance(req as never, res as never).then(() => ({
    status: res.status.mock.calls[0][0],
    body: res.json.mock.calls[0][0],
  }));
}

describe('GET /wallet/waste', () => {
  beforeEach(() => {
    SorobanService.enabled = true;
    SorobanService.read.mockReset();
  });

  it('reports zero and no address before the user has a wallet', async () => {
    prisma.user.findUnique.mockResolvedValue({ stellarPublicKey: null });

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.data).toEqual({ address: null, balance: '0', explorerUrl: null });
    expect(SorobanService.read).not.toHaveBeenCalled();
  });

  it('reads the balance from the token contract', async () => {
    prisma.user.findUnique.mockResolvedValue({ stellarPublicKey: ADDRESS });
    SorobanService.read.mockResolvedValue(88_000_000n);

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.data.balance).toBe('88000000');
    expect(body.data.address).toBe(ADDRESS);
    expect(body.data.explorerUrl).toBe(
      `https://stellar.expert/explorer/testnet/account/${ADDRESS}`
    );
    expect(SorobanService.read.mock.calls[0][0]).toBe('TOKEN');
    expect(SorobanService.read.mock.calls[0][1]).toBe('balance');
  });

  it('answers 503 when on-chain features are off', async () => {
    prisma.user.findUnique.mockResolvedValue({ stellarPublicKey: ADDRESS });
    SorobanService.enabled = false;

    expect((await call()).status).toBe(503);
  });

  it('answers 502 when the chain cannot be read', async () => {
    prisma.user.findUnique.mockResolvedValue({ stellarPublicKey: ADDRESS });
    SorobanService.read.mockRejectedValue(new Error('rpc unavailable'));

    const { status, body } = await call();

    expect(status).toBe(502);
    expect(body.message).toBe('rpc unavailable');
  });
});
