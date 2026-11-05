import { SorobanService } from '../../../src/services/soroban.service';

/** Swap in a fake RPC server; ensureAccount only uses these two calls. */
function fakeServer(server: { getAccount: jest.Mock; fundAddress: jest.Mock }) {
  (SorobanService as unknown as { server: unknown }).server = server;
}

const ADDRESS = 'GCUG3TKDZDIA37SXDYACUFQMWZ67F7LFTB65WEJU72XITYR6FQS5J4B7';

describe('SorobanService.ensureAccount', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    (SorobanService as unknown as { server: unknown }).server = null;
  });

  it('does nothing for an account that already exists', async () => {
    const server = { getAccount: jest.fn().mockResolvedValue({}), fundAddress: jest.fn() };
    fakeServer(server);

    await SorobanService.ensureAccount(ADDRESS);

    expect(server.fundAddress).not.toHaveBeenCalled();
  });

  it('funds a missing account and waits until the RPC node sees it', async () => {
    const server = {
      getAccount: jest
        .fn()
        .mockRejectedValueOnce(new Error('Account not found'))
        .mockRejectedValueOnce(new Error('Account not found'))
        .mockResolvedValue({}),
      fundAddress: jest.fn().mockResolvedValue({}),
    };
    fakeServer(server);

    const done = SorobanService.ensureAccount(ADDRESS);
    await jest.runAllTimersAsync();
    await done;

    expect(server.fundAddress).toHaveBeenCalledWith(ADDRESS);
    expect(server.getAccount).toHaveBeenCalledTimes(3);
  });

  // Horizon's Friendbot funded the account a moment ago, and the RPC node lags
  it('treats "already funded" as funded and waits for the account to appear', async () => {
    const server = {
      getAccount: jest
        .fn()
        .mockRejectedValueOnce(new Error('Account not found'))
        .mockRejectedValueOnce(new Error('Account not found'))
        .mockResolvedValue({}),
      fundAddress: jest
        .fn()
        .mockRejectedValue(new Error('account already funded to starting balance')),
    };
    fakeServer(server);

    const done = expect(SorobanService.ensureAccount(ADDRESS)).resolves.toBeUndefined();
    await jest.runAllTimersAsync();
    await done;
  });

  it('passes on any other funding error', async () => {
    const server = {
      getAccount: jest.fn().mockRejectedValue(new Error('Account not found')),
      fundAddress: jest.fn().mockRejectedValue(new Error('friendbot unavailable')),
    };
    fakeServer(server);

    await expect(SorobanService.ensureAccount(ADDRESS)).rejects.toThrow('friendbot unavailable');
  });

  it('gives up if the account never appears', async () => {
    const server = {
      getAccount: jest.fn().mockRejectedValue(new Error('Account not found')),
      fundAddress: jest.fn().mockResolvedValue({}),
    };
    fakeServer(server);

    const done = expect(SorobanService.ensureAccount(ADDRESS)).rejects.toThrow('not visible');
    await jest.runAllTimersAsync();
    await done;
    expect(server.getAccount).toHaveBeenCalledTimes(16);
  });
});
