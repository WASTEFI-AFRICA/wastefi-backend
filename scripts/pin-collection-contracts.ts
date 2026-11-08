import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/services/database.service';
import { SorobanService } from '../src/services/soroban.service';
import { CollectionChainBackfillService } from '../src/services/collection-chain-backfill.service';
import { config } from '../src/config';

const usage = `Preview: npm run stellar:pin-collections
Apply: npm run stellar:pin-collections -- --apply --transaction-contract=ORIGINAL_ADDRESS --payment-contract=ORIGINAL_ADDRESS
Stop API workers and retain the original network and contract configuration for both commands.`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(usage);
    return;
  }
  if (
    args.some(
      (arg) =>
        arg !== '--apply' &&
        !arg.startsWith('--transaction-contract=') &&
        !arg.startsWith('--payment-contract=')
    )
  ) {
    throw new Error('Unknown argument. ' + usage);
  }
  const contracts = SorobanService.contracts();
  const apply = args.includes('--apply');
  const transaction = args.find((arg) => arg.startsWith('--transaction-contract='))?.split('=')[1];
  const payment = args.find((arg) => arg.startsWith('--payment-contract='))?.split('=')[1];
  if (
    apply &&
    (transaction !== contracts.waste_transaction || payment !== contracts.payment_distribution)
  ) {
    throw new Error(
      'Apply requires both original contract addresses to match the current configuration. ' + usage
    );
  }
  if (!SorobanService.enabled)
    throw new Error(
      'Configure the original deployment admin identity for read-only RPC simulations.'
    );
  console.log(JSON.stringify({ apply, network: config.soroban.networkPassphrase, contracts }));
  let afterId: string | undefined;
  let pinned = 0;
  let failed = 0;
  for (;;) {
    const rows = await prisma.wasteCollection.findMany({
      where: {
        chainContext: { equals: Prisma.DbNull },
        ...(afterId ? { id: { gt: afterId } } : {}),
        OR: [
          { chainStatus: { in: ['RECORDED', 'VERIFIED', 'PAID'] } },
          { chainTransactionId: { not: null } },
          { chainRecordTxHash: { not: null } },
          { chainPaymentId: { not: null } },
          { chainVerifyTxHash: { not: null } },
          { chainPaymentTxHash: { not: null } },
          { chainAmount: { not: null } },
        ],
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true },
    });
    if (!rows.length) break;
    for (const row of rows) {
      try {
        console.log(
          JSON.stringify({
            collectionId: row.id,
            result: await CollectionChainBackfillService.pin(row.id, apply),
          })
        );
        pinned++;
      } catch {
        // Do not dump SDK errors, environment values or request objects.
        console.error(JSON.stringify({ collectionId: row.id, result: 'needs_review' }));
        failed++;
      }
    }
    afterId = rows[rows.length - 1].id;
  }
  console.log(JSON.stringify({ apply, inspected: pinned + failed, succeeded: pinned, failed }));
  if (failed) process.exitCode = 1;
}

main()
  .catch(() => {
    console.error(
      'Backfill stopped. Check the original deployment, database and arguments; use --help for usage.'
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
