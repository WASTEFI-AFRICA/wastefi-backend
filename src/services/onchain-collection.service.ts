import crypto from 'crypto';
import { ChainStatus, Prisma } from '@prisma/client';
import { Keypair } from '@stellar/stellar-sdk';
import { prisma } from './database.service';
import { SorobanService, ScArg } from './soroban.service';
import { StellarService } from './stellar.service';
import { logger } from '../utils/logger.util';
import { CollectionChainContextService, chainInteger } from './collection-chain-context.service';

const MAX_ATTEMPTS = 5;
const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_BATCH = 5;

/** The MaterialType variants of the contracts, keyed by lower-case category name. */
const MATERIAL_TYPES: Record<string, string> = {
  plastic: 'Plastic',
  glass: 'Glass',
  metal: 'Metal',
  paper: 'Paper',
  cardboard: 'Cardboard',
  electronics: 'Electronics',
  'e-waste': 'Electronics',
  organic: 'Organic',
  textile: 'Textile',
  rubber: 'Rubber',
};

type CollectionWithRelations = Prisma.WasteCollectionGetPayload<{
  include: { collectionPoint: true };
}>;

/**
 * Records approved collections on the Soroban contracts.
 *
 * When a collection point approves a collection, it is queued here and taken
 * through four steps, each signed by the account the contract requires:
 *
 *   1. waste_transaction.record_with_price_lookup, signed by the collector's
 *      custodial wallet; the contract prices it from material_pricing
 *   2. waste_transaction.verify_transaction, signed by the admin, which also
 *      updates the collector's reputation
 *   3. payment_distribution.process_payment, signed by the admin
 *   4. payment_distribution.update_payment_status(Completed), signed by the admin,
 *      which mints the WASTE to the collector
 *
 * Each delivery pins its deployment and public signing identities before recording.
 * Retries use that context and validate chain records and payments before proceeding.
 * Every step checks the chain before acting and stores its transaction hash, so a
 * collection interrupted at any point (a crash, an RPC outage) resumes where it
 * stopped instead of recording twice. Failures are retried by a sweep every minute,
 * up to MAX_ATTEMPTS. Verification in the database never waits for, or is undone
 * by, the chain.
 *
 * Collectors are registered on-chain under a pseudonym derived from their user id.
 * Names and phone numbers never go on the public ledger.
 */
export class OnChainCollectionService {
  private static inFlight = new Set<string>();
  // One preparation per collector at a time, shared by everyone who asks.
  private static preparing = new Map<string, Promise<Keypair>>();
  private static timer: NodeJS.Timeout | null = null;
  // Whether the sweep might find work. The sweep only queries the database while
  // this is set, so an idle server lets a scale-to-zero database (Neon's free tier)
  // suspend instead of waking it every minute.
  private static workPending = false;

  static get enabled(): boolean {
    return SorobanService.enabled;
  }

  /** Start the retry sweep. Does nothing unless on-chain recording is enabled. */
  static start(): void {
    if (!this.enabled || this.timer) return;
    // Look once for work left unfinished before a restart.
    this.workPending = true;
    this.timer = setInterval(() => void this.tick(), SWEEP_INTERVAL_MS);
    this.timer.unref();
    logger.info('On-chain collection recording enabled');
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Get a collector ready to record on-chain ahead of time: create and fund their
   * wallet and register them in collector_registry. Called when they submit a
   * collection, so these steps are not added to the wait after an approval.
   */
  static prepareCollector(userId: string): void {
    if (!this.enabled) return;
    this.readyCollector(userId, SorobanService.contracts().collector_registry).catch(
      (error: unknown) =>
        logger.warn('Collector could not be prepared on-chain yet', {
          userId,
          reason: (error as Error).message,
        })
    );
  }

  /** Process a collection in the background. Used right after it is approved. */
  static kick(collectionId: string): void {
    if (!this.enabled) return;
    this.workPending = true;
    void this.process(collectionId);
  }

  /** One run of the timer: sweep only while there may be work, and stop once there is none. */
  static async tick(): Promise<void> {
    if (!this.workPending) return;
    try {
      this.workPending = (await this.sweep()) > 0;
    } catch (error) {
      logger.error('On-chain sweep failed', { reason: (error as Error).message });
    }
  }

  /**
   * Process every collection that still has steps left, a few at a time. Returns how
   * many were due, so the caller knows whether to keep sweeping.
   */
  static async sweep(): Promise<number> {
    const due = await prisma.wasteCollection.findMany({
      where: {
        OR: [
          {
            chainStatus: { in: [ChainStatus.PENDING, ChainStatus.RECORDED, ChainStatus.VERIFIED] },
          },
          { chainStatus: ChainStatus.FAILED, chainAttempts: { lt: MAX_ATTEMPTS } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: SWEEP_BATCH,
      select: { id: true },
    });
    for (const { id } of due) {
      await this.process(id);
    }
    return due.length;
  }

  /** Take one collection as far through the steps as it will go. Never throws. */
  static async process(collectionId: string): Promise<void> {
    if (this.inFlight.has(collectionId)) return;
    this.inFlight.add(collectionId);
    try {
      const collection = await prisma.wasteCollection.findUnique({
        where: { id: collectionId },
        include: { collectionPoint: true },
      });
      if (!collection || !collection.chainStatus || collection.chainStatus === ChainStatus.PAID) {
        return;
      }
      await this.run(collection);
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      await prisma.wasteCollection
        .update({
          where: { id: collectionId },
          data: {
            chainStatus: ChainStatus.FAILED,
            chainError: message,
            chainAttempts: { increment: 1 },
          },
        })
        .catch(() => undefined);
      logger.error('On-chain recording failed', { collectionId, reason: message });
    } finally {
      this.inFlight.delete(collectionId);
    }
  }

  private static async run(collection: CollectionWithRelations): Promise<void> {
    let context = collection.chainContext
      ? CollectionChainContextService.parse(collection.chainContext)
      : null;
    if (context) CollectionChainContextService.requireCurrentNetwork(context);
    else if (CollectionChainContextService.hasProgress(collection)) {
      throw new Error('Existing on-chain progress needs context backfill');
    }
    const admin = SorobanService.adminKeypair();
    const save = (data: Prisma.WasteCollectionUpdateInput) =>
      prisma.wasteCollection.update({ where: { id: collection.id }, data });

    const registry =
      context?.contracts.collector_registry ?? SorobanService.contracts().collector_registry;
    let collector = await this.readyCollector(collection.collectorId, registry);
    if (!context) {
      const pointAddress = await this.ensurePointAddress(collection.collectionPoint);
      context = await CollectionChainContextService.pinNew(
        collection.id,
        CollectionChainContextService.snapshot(collector.publicKey(), pointAddress)
      );
      // A concurrent worker may already have pinned a different deployment.
      if (registry !== context.contracts.collector_registry) {
        collector = await this.readyCollector(
          collection.collectorId,
          context.contracts.collector_registry
        );
      }
    }
    if (collector.publicKey() !== context.collectorAddress) {
      throw new Error('Collector wallet does not match the pinned chain context');
    }
    const contracts = context.contracts;
    const pointAddress = context.pointAddress;

    // 1. Record, signed by the collector
    let transactionId = collection.chainTransactionId;
    if (!transactionId && collection.chainRecordTxHash) {
      // A previous attempt submitted the record; find out whether it landed.
      const earlier = await SorobanService.lookup(collection.chainRecordTxHash);
      if (earlier.status === 'SUCCESS') transactionId = chainInteger(earlier.value).toString();
      else if (earlier.status !== 'FAILED') {
        // A missing RPC result is not proof that the record never landed.
        throw new Error('Recorded transaction outcome is unknown; refusing to record again');
      }
    }
    if (!transactionId) {
      const recorded = await SorobanService.invoke(
        contracts.waste_transaction,
        'record_with_price_lookup',
        [
          ScArg.address(collector.publicKey()),
          ScArg.address(pointAddress),
          ScArg.variant(this.materialType(collection.materialCategory)),
          ScArg.u64(this.grams(collection.weight)),
        ],
        collector,
        (hash) => save({ chainRecordTxHash: hash }).then(() => undefined)
      );
      transactionId = chainInteger(recorded.value).toString();
    }
    const record = CollectionChainContextService.assertRecord(
      await SorobanService.read(contracts.waste_transaction, 'get_transaction', [
        ScArg.u64(transactionId),
      ]),
      context,
      {
        id: transactionId,
        material: this.materialType(collection.materialCategory),
        grams: this.grams(collection.weight),
        amount: collection.chainAmount,
      }
    );
    await save({
      chainTransactionId: transactionId,
      chainAmount: record.total_amount.toString(),
      chainStatus: ChainStatus.RECORDED,
      chainError: null,
    });

    // 2. Verify, signed by the admin. This also updates the collector's reputation.
    if (!record.verified) {
      const verified = await SorobanService.invoke(
        contracts.waste_transaction,
        'verify_transaction',
        [ScArg.u64(transactionId)],
        admin,
        (hash) => save({ chainVerifyTxHash: hash }).then(() => undefined)
      );
      await save({ chainVerifyTxHash: verified.hash });
    }
    await save({ chainStatus: ChainStatus.VERIFIED });

    // 3. Record the payment, once per transaction
    const mappedPayment = await SorobanService.read(
      contracts.payment_distribution,
      'get_payment_for_transaction',
      [ScArg.u64(transactionId)]
    );
    let paymentId = mappedPayment == null ? null : chainInteger(mappedPayment);
    if (
      collection.chainPaymentId &&
      (paymentId === null || paymentId !== chainInteger(collection.chainPaymentId))
    ) {
      throw new Error('Payment mapping does not match the stored payment ID');
    }
    if (paymentId === null) {
      const created = await SorobanService.invoke(
        contracts.payment_distribution,
        'process_payment',
        [
          ScArg.u64(transactionId),
          ScArg.address(collector.publicKey()),
          ScArg.i128(record.total_amount),
        ],
        admin
      );
      paymentId = chainInteger(created.value);
    }
    await save({ chainPaymentId: paymentId.toString() });

    // 4. Complete it, which mints the WASTE to the collector
    const paymentStatus = CollectionChainContextService.assertPayment(
      await SorobanService.read(contracts.payment_distribution, 'get_payment', [
        ScArg.u64(paymentId),
      ]),
      context,
      transactionId,
      paymentId,
      record.total_amount
    );
    if (paymentStatus !== 'Completed') {
      const paid = await SorobanService.invoke(
        contracts.payment_distribution,
        'update_payment_status',
        [ScArg.u64(paymentId), ScArg.variant('Completed')],
        admin,
        (hash) => save({ chainPaymentTxHash: hash }).then(() => undefined)
      );
      await save({ chainPaymentTxHash: paid.hash });
    }
    await save({ chainStatus: ChainStatus.PAID, chainError: null });
    logger.info('Collection recorded and paid on-chain', {
      collectionId: collection.id,
      transactionId,
    });
  }

  /**
   * The collector's wallet, funded and registered as active. Concurrent callers for
   * the same collector share one run, so nobody registers them twice.
   */
  private static readyCollector(userId: string, registry: string): Promise<Keypair> {
    const key = JSON.stringify([userId, registry]);
    const existing = this.preparing.get(key);
    if (existing) return existing;

    const ready = (async () => {
      const wallet = await StellarService.createUserWallet(userId);
      const collector = Keypair.fromSecret(wallet.secretKey);
      await SorobanService.ensureAccount(collector.publicKey());
      await this.ensureRegistered(userId, collector, registry);
      return collector;
    })().finally(() => this.preparing.delete(key));

    this.preparing.set(key, ready);
    return ready;
  }

  /** Register and activate the collector in collector_registry if needed. */
  private static async ensureRegistered(
    userId: string,
    collector: Keypair,
    registry: string
  ): Promise<void> {
    const address = ScArg.address(collector.publicKey());

    if (await SorobanService.read(registry, 'is_active', [address])) return;

    if (!(await SorobanService.read(registry, 'exists', [address]))) {
      const { name, reference } = this.pseudonym(userId);
      await SorobanService.invoke(
        registry,
        'register',
        [address, ScArg.string(name), ScArg.string(reference)],
        collector
      );
    }
    await SorobanService.invoke(
      registry,
      'update_status',
      [address, ScArg.variant('Active')],
      SorobanService.adminKeypair()
    );
  }

  /** A collection point's on-chain identity, created the first time it is needed. */
  private static async ensurePointAddress(point: {
    id: string;
    stellarAddress: string | null;
  }): Promise<string> {
    if (point.stellarAddress) return point.stellarAddress;
    // Only the first writer sets it; everyone then reads the stored value.
    await prisma.collectionPoint.updateMany({
      where: { id: point.id, stellarAddress: null },
      data: { stellarAddress: Keypair.random().publicKey() },
    });
    const stored = await prisma.collectionPoint.findUniqueOrThrow({
      where: { id: point.id },
      select: { stellarAddress: true },
    });
    return stored.stellarAddress as string;
  }

  /**
   * What the registry stores in place of a name and phone number. The reference is
   * stable for a user but reveals nothing about them.
   */
  static pseudonym(userId: string): { name: string; reference: string } {
    const digest = crypto.createHash('sha256').update(`wastefi-collector:${userId}`).digest('hex');
    return { name: 'WasteFi collector', reference: `wf-${digest.slice(0, 16)}` };
  }

  /** The contracts' MaterialType variant for a category; unknown ones become Other. */
  static materialType(category: string): string {
    return MATERIAL_TYPES[category.trim().toLowerCase()] ?? 'Other';
  }

  /** Kilograms in the database, whole grams on-chain. */
  static grams(weightKg: number): bigint {
    return BigInt(Math.round(weightKg * 1000));
  }
}
