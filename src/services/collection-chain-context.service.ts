import { Prisma } from '@prisma/client';
import { StrKey } from '@stellar/stellar-sdk';
import { config } from '../config';
import { CollectionFlow, SorobanContracts } from '../config/soroban-contracts';
import { prisma } from './database.service';
import { SorobanService } from './soroban.service';

/** Public deployment metadata only. Never put secrets or RPC credentials here. */
export type CollectionChainContext = {
  version: 1;
  flow: CollectionFlow;
  networkPassphrase: string;
  contracts: SorobanContracts;
  collectorAddress: string;
  pointAddress: string;
};

const CONTRACT_NAMES: (keyof SorobanContracts)[] = [
  'waste_token',
  'collector_registry',
  'collection_point',
  'material_pricing',
  'reputation',
  'waste_transaction',
  'payment_distribution',
];

type Progress = {
  chainStatus: string | null;
  chainTransactionId: string | null;
  chainAmount: string | null;
  chainPaymentId: string | null;
  chainRecordTxHash: string | null;
  chainVerifyTxHash: string | null;
  chainPaymentTxHash: string | null;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid collection chain context');
  }
  return value as Record<string, unknown>;
}

/** Decode SDK unit variants without accepting compound or malformed variants. */
export function chainVariant(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') return value[0];
  throw new Error('Invalid on-chain status or material');
}

export function chainInteger(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error('Invalid on-chain integer');
}

export class CollectionChainContextService {
  static snapshot(
    collectorAddress: string,
    pointAddress: string,
    flow: CollectionFlow = config.soroban.collectionFlow
  ): CollectionChainContext {
    return this.parse({
      version: 1,
      flow,
      networkPassphrase: config.soroban.networkPassphrase,
      contracts: { ...SorobanService.contracts() },
      collectorAddress,
      pointAddress,
    });
  }

  static parse(value: unknown): CollectionChainContext {
    const raw = object(value);
    const contracts = object(raw.contracts);
    if (
      raw.version !== 1 ||
      (raw.flow !== 'admin_v1' && raw.flow !== 'point_owner_v1') ||
      typeof raw.networkPassphrase !== 'string' ||
      !raw.networkPassphrase.trim() ||
      typeof raw.collectorAddress !== 'string' ||
      !StrKey.isValidEd25519PublicKey(raw.collectorAddress) ||
      typeof raw.pointAddress !== 'string' ||
      !StrKey.isValidEd25519PublicKey(raw.pointAddress) ||
      CONTRACT_NAMES.some(
        (name) => typeof contracts[name] !== 'string' || !StrKey.isValidContract(contracts[name])
      )
    ) {
      throw new Error('Invalid collection chain context');
    }
    // Select only recognized public metadata, even if a stored JSON value has extras.
    return {
      version: 1,
      flow: raw.flow as CollectionFlow,
      networkPassphrase: raw.networkPassphrase,
      contracts: Object.fromEntries(
        CONTRACT_NAMES.map((name) => [name, contracts[name]])
      ) as unknown as SorobanContracts,
      collectorAddress: raw.collectorAddress,
      pointAddress: raw.pointAddress,
    };
  }

  static requireCurrentNetwork(context: CollectionChainContext): void {
    if (context.networkPassphrase !== config.soroban.networkPassphrase) {
      throw new Error('Collection belongs to a different Stellar network');
    }
  }

  static hasProgress(collection: Progress): boolean {
    return (
      ['RECORDED', 'VERIFIED', 'PAID'].includes(collection.chainStatus || '') ||
      Boolean(
        collection.chainTransactionId ||
        collection.chainAmount ||
        collection.chainPaymentId ||
        collection.chainRecordTxHash ||
        collection.chainVerifyTxHash ||
        collection.chainPaymentTxHash
      )
    );
  }

  static json(context: CollectionChainContext): Prisma.InputJsonObject {
    return { ...context, contracts: { ...context.contracts } };
  }

  /** First writer wins before recording a delivery. Never reinterpret existing progress. */
  static async pinNew(
    collectionId: string,
    candidate: CollectionChainContext
  ): Promise<CollectionChainContext> {
    return prisma.$transaction(async (tx) => {
      await tx.wasteCollection.updateMany({
        where: {
          id: collectionId,
          chainContext: { equals: Prisma.DbNull },
          chainTransactionId: null,
          chainAmount: null,
          chainPaymentId: null,
          chainRecordTxHash: null,
          chainVerifyTxHash: null,
          chainPaymentTxHash: null,
          chainStatus: { in: ['PENDING', 'FAILED'] },
        },
        data: { chainContext: this.json(candidate) },
      });
      const stored = await tx.wasteCollection.findUniqueOrThrow({
        where: { id: collectionId },
        select: { chainContext: true },
      });
      if (!stored.chainContext)
        throw new Error('Existing on-chain progress needs context backfill');
      const context = this.parse(stored.chainContext);
      this.requireCurrentNetwork(context);
      await this.claimPaymentNamespace(tx, context);
      return context;
    });
  }

  static async claimPaymentNamespace(
    tx: Prisma.TransactionClient,
    context: CollectionChainContext
  ): Promise<void> {
    await tx.chainPaymentNamespace.createMany({
      data: [
        {
          networkPassphrase: context.networkPassphrase,
          paymentContract: context.contracts.payment_distribution,
          transactionContract: context.contracts.waste_transaction,
        },
      ],
      skipDuplicates: true,
    });
    const namespace = await tx.chainPaymentNamespace.findUniqueOrThrow({
      where: {
        network_payment: {
          networkPassphrase: context.networkPassphrase,
          paymentContract: context.contracts.payment_distribution,
        },
      },
    });
    if (namespace.transactionContract !== context.contracts.waste_transaction) {
      throw new Error('Payment contract is already bound to another transaction contract');
    }
  }

  static assertRecord(
    value: unknown,
    context: CollectionChainContext,
    expected: { id: string; material: string; grams: bigint; amount: string | null }
  ): { total_amount: bigint; verified: boolean } {
    const record = object(value);
    const amount = chainInteger(record.total_amount);
    const status = chainVariant(record.status);
    if (
      chainInteger(record.id) !== chainInteger(expected.id) ||
      record.collector !== context.collectorAddress ||
      record.collection_point !== context.pointAddress ||
      chainVariant(record.material_type) !== expected.material ||
      chainInteger(record.weight) !== expected.grams ||
      amount <= 0n ||
      amount > (1n << 127n) - 1n ||
      (expected.amount !== null && amount !== chainInteger(expected.amount)) ||
      typeof record.verified !== 'boolean' ||
      (record.verified ? status !== 'Completed' : status !== 'Pending')
    ) {
      throw new Error('On-chain record does not match this collection');
    }
    return { total_amount: amount, verified: record.verified };
  }

  static assertPayment(
    value: unknown,
    context: CollectionChainContext,
    transactionId: string,
    paymentId: bigint,
    amount: bigint
  ): string {
    const payment = object(value);
    const status = chainVariant(payment.status);
    if (
      chainInteger(payment.id) !== paymentId ||
      chainInteger(payment.transaction_id) !== chainInteger(transactionId) ||
      payment.recipient !== context.collectorAddress ||
      chainInteger(payment.amount) !== amount ||
      !['Pending', 'Processing', 'Completed'].includes(status)
    ) {
      throw new Error('On-chain payment does not match this collection');
    }
    return status;
  }
}
