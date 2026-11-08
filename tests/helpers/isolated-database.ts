import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';

// A file-local schema keeps changing point fixtures out of global stats assertions.
const schema = 'point_signing_' + randomUUID().replace(/-/g, '');
const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost/wastefi_test');
url.searchParams.set('schema', schema);
export const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

export function prepareIsolatedDatabase(): void {
  const result = spawnSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'],
    {
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: 'utf8',
      timeout: 60_000,
    }
  );
  if (result.error || result.status !== 0)
    throw new Error('Could not prepare the isolated point-signing test schema');
}

export async function disposeIsolatedDatabase(): Promise<void> {
  try {
    // schema is generated locally from UUID hex and never accepts caller input.
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}
