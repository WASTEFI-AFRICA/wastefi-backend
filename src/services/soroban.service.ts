import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { config } from '../config';

export interface InvokeResult {
  hash: string;
  value: unknown;
}

export type LookupResult =
  { status: 'SUCCESS'; value: unknown } | { status: 'FAILED' } | { status: 'NOT_FOUND' };

/** Converters from JavaScript values to the argument types the contracts take. */
export const ScArg = {
  address: (publicKey: string): xdr.ScVal => new Address(publicKey).toScVal(),
  u64: (value: bigint | number | string): xdr.ScVal =>
    nativeToScVal(BigInt(value), { type: 'u64' }),
  i128: (value: bigint | number | string): xdr.ScVal =>
    nativeToScVal(BigInt(value), { type: 'i128' }),
  string: (value: string): xdr.ScVal => nativeToScVal(value, { type: 'string' }),
  /** A unit variant of a #[contracttype] enum, such as MaterialType::Plastic. */
  variant: (name: string): xdr.ScVal => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name)]),
};

/**
 * A small client for the WasteFi Soroban contracts.
 *
 * `invoke` submits a contract call and waits for it to land; `read` simulates a
 * call without submitting anything. Calls from the same signer are queued, so two
 * transactions never race for the same account sequence number.
 */
export class SorobanService {
  private static server: rpc.Server | null = null;
  private static queues = new Map<string, Promise<unknown>>();

  /** On-chain recording is switched on by setting SOROBAN_ADMIN_SECRET. */
  static get enabled(): boolean {
    return Boolean(config.soroban.adminSecret);
  }

  static adminKeypair(): Keypair {
    return Keypair.fromSecret(config.soroban.adminSecret);
  }

  static contracts() {
    return config.soroban.contracts;
  }

  private static rpcServer(): rpc.Server {
    if (!this.server) {
      this.server = new rpc.Server(config.soroban.rpcUrl, {
        allowHttp: config.soroban.rpcUrl.startsWith('http://'),
      });
    }
    return this.server;
  }

  /**
   * A transaction calling one contract function. `account` must carry the live
   * sequence number when the transaction will be submitted; a simulation ignores it.
   */
  private static buildCall(
    account: Account,
    contractId: string,
    method: string,
    args: xdr.ScVal[]
  ) {
    return new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.soroban.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(60)
      .build();
  }

  /**
   * Simulate a read-only call and return its result. Nothing is submitted, so the
   * source account's sequence number does not matter and is not fetched, which
   * saves a network round trip on every read.
   */
  static async read(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<unknown> {
    const source = new Account(this.adminKeypair().publicKey(), '0');
    const tx = this.buildCall(source, contractId, method, args);
    const sim = await this.rpcServer().simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`${method} failed in simulation: ${sim.error}`);
    }
    return sim.result ? scValToNative(sim.result.retval) : undefined;
  }

  /**
   * Submit a contract call signed by `signer`, which is also the transaction source
   * and pays the fee, so its signature covers any `require_auth` on its own address.
   * `onSubmitted` receives the hash as soon as the network accepts the transaction,
   * before it is confirmed, so the caller can store it and recover after a crash.
   */
  static async invoke(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    signer: Keypair,
    onSubmitted?: (hash: string) => Promise<void>
  ): Promise<InvokeResult> {
    return this.serialize(signer.publicKey(), async () => {
      const server = this.rpcServer();
      const account = await server.getAccount(signer.publicKey());
      const tx = this.buildCall(account, contractId, method, args);
      const prepared = await server.prepareTransaction(tx);
      prepared.sign(signer);

      const sent = await server.sendTransaction(prepared);
      if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
        throw new Error(`${method} was not accepted by the network (${sent.status})`);
      }
      if (onSubmitted) await onSubmitted(sent.hash);

      const result = await this.lookup(sent.hash, 30);
      if (result.status === 'SUCCESS') return { hash: sent.hash, value: result.value };
      if (result.status === 'FAILED') throw new Error(`${method} failed on-chain (${sent.hash})`);
      throw new Error(`${method} was not confirmed in time (${sent.hash})`);
    });
  }

  /**
   * The outcome of a submitted transaction. NOT_FOUND means it is still pending or
   * was never included; after its 60 second time bound it can no longer land.
   */
  static async lookup(hash: string, attempts = 1): Promise<LookupResult> {
    const result = await this.rpcServer().pollTransaction(hash, {
      attempts,
      sleepStrategy: rpc.BasicSleepStrategy,
    });
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        status: 'SUCCESS',
        value: result.returnValue ? scValToNative(result.returnValue) : undefined,
      };
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) return { status: 'FAILED' };
    return { status: 'NOT_FOUND' };
  }

  /** Make sure an account exists. On testnet a missing one is funded by Friendbot. */
  static async ensureAccount(publicKey: string): Promise<void> {
    try {
      await this.rpcServer().getAccount(publicKey);
    } catch {
      if (config.stellar.network !== 'testnet') {
        throw new Error(`Stellar account ${publicKey} does not exist`);
      }
      await this.rpcServer().fundAddress(publicKey);
    }
  }

  private static async serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    this.queues.set(key, run);
    try {
      return await run;
    } finally {
      if (this.queues.get(key) === run) this.queues.delete(key);
    }
  }
}
