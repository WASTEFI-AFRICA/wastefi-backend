import { Prisma } from '@prisma/client';
import { prisma } from './database.service';
import { SorobanService, ScArg } from './soroban.service';
import { OnChainCollectionService } from './onchain-collection.service';
import { CollectionChainContextService, chainInteger } from './collection-chain-context.service';

/** Explicit maintenance operation, never run automatically on server startup. */
export class CollectionChainBackfillService {
  static async pin(
    collectionId: string,
    apply: boolean
  ): Promise<'pinned' | 'would_pin' | 'already_pinned' | 'not_started'> {
    const row = await prisma.wasteCollection.findUniqueOrThrow({
      where: { id: collectionId },
      include: {
        collector: { select: { stellarPublicKey: true } },
        collectionPoint: { select: { stellarAddress: true } },
      },
    });
    if (row.chainContext) {
      const existing = CollectionChainContextService.parse(row.chainContext);
      CollectionChainContextService.requireCurrentNetwork(existing);
      return 'already_pinned';
    }
    if (!CollectionChainContextService.hasProgress(row)) return 'not_started';
    const collector = row.collector.stellarPublicKey;
    const point = row.collectionPoint.stellarAddress;
    if (!collector || !point) throw new Error('Existing signing addresses are missing');
    const context = CollectionChainContextService.snapshot(collector, point, 'admin_v1');
    const namespace = await prisma.chainPaymentNamespace.findUnique({
      where: {
        network_payment: {
          networkPassphrase: context.networkPassphrase,
          paymentContract: context.contracts.payment_distribution,
        },
      },
    });
    if (namespace && namespace.transactionContract !== context.contracts.waste_transaction) {
      throw new Error('Payment contract is already bound to another transaction contract');
    }
    let transactionId = row.chainTransactionId;
    if (!transactionId && row.chainRecordTxHash) {
      const outcome = await SorobanService.lookup(row.chainRecordTxHash);
      if (outcome.status === 'SUCCESS') transactionId = chainInteger(outcome.value).toString();
      else if (outcome.status !== 'FAILED')
        throw new Error('Recorded transaction outcome is unknown');
    }
    if (transactionId) {
      CollectionChainContextService.assertRecord(
        await SorobanService.read(context.contracts.waste_transaction, 'get_transaction', [
          ScArg.u64(transactionId),
        ]),
        context,
        {
          id: transactionId,
          material: OnChainCollectionService.materialType(row.materialCategory),
          grams: OnChainCollectionService.grams(row.weight),
          amount: row.chainAmount,
        }
      );
      if (row.chainPaymentId) {
        const mapped = await SorobanService.read(
          context.contracts.payment_distribution,
          'get_payment_for_transaction',
          [ScArg.u64(transactionId)]
        );
        if (mapped == null || chainInteger(mapped) !== chainInteger(row.chainPaymentId)) {
          throw new Error('Payment mapping does not match the stored payment ID');
        }
        const status = CollectionChainContextService.assertPayment(
          await SorobanService.read(context.contracts.payment_distribution, 'get_payment', [
            ScArg.u64(row.chainPaymentId),
          ]),
          context,
          transactionId,
          chainInteger(row.chainPaymentId),
          chainInteger(row.chainAmount)
        );
        if (row.chainStatus === 'PAID' && status !== 'Completed') {
          throw new Error('Stored payment is not completed on-chain');
        }
      } else if (row.chainStatus === 'PAID') {
        throw new Error('Paid collection is missing its payment ID');
      }
    } else if (
      row.chainAmount ||
      row.chainPaymentId ||
      row.chainVerifyTxHash ||
      row.chainPaymentTxHash ||
      ['RECORDED', 'VERIFIED', 'PAID'].includes(row.chainStatus || '')
    ) {
      throw new Error('Existing progress is missing its transaction ID');
    }
    if (!apply) return 'would_pin';
    // Compare the inspected progress as well as the null context. A maintenance
    // command must not overwrite a worker or another command's intervening write.
    return prisma.$transaction(async (tx) => {
      const changed = await tx.wasteCollection.updateMany({
        where: {
          id: row.id,
          chainContext: { equals: Prisma.DbNull },
          chainStatus: row.chainStatus,
          chainTransactionId: row.chainTransactionId,
          chainAmount: row.chainAmount,
          chainPaymentId: row.chainPaymentId,
          chainRecordTxHash: row.chainRecordTxHash,
          chainVerifyTxHash: row.chainVerifyTxHash,
          chainPaymentTxHash: row.chainPaymentTxHash,
        },
        data: {
          chainContext: CollectionChainContextService.json(context),
          ...(transactionId && !row.chainTransactionId
            ? { chainTransactionId: transactionId }
            : {}),
        },
      });
      if (!changed.count) {
        throw new Error('Collection changed during backfill; inspect it again');
      }
      await CollectionChainContextService.claimPaymentNamespace(tx, context);
      return 'pinned' as const;
    });
  }
}
