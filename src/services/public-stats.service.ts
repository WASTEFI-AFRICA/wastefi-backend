import { prisma } from './database.service';

export interface PublicStats {
  generatedAt: string;
  currency: string;
  totals: {
    activeCollectors: number;
    activeCollectionPoints: number;
    collectionsRecorded: number;
    collectionsVerified: number;
    verifiedWeightKg: number;
    verifiedValue: number;
  };
  byMaterial: Array<{ materialType: string; collections: number; weightKg: number }>;
  recentVerified: Array<{
    materialType: string;
    weightKg: number;
    city: string;
    verifiedAt: string;
  }>;
}

const CACHE_TTL_MS = 30_000;

/**
 * Aggregate, anonymous platform statistics for the unauthenticated public page.
 *
 * Only counts, sums and the material, weight, city and time of verified
 * collections are returned. No names, phone numbers, user ids or per-user figures
 * ever leave this service. Impact figures count verified collections only, so a
 * collector cannot inflate the public numbers by submitting unverified ones.
 */
export class PublicStatsService {
  private static cache: { at: number; data: PublicStats } | null = null;

  static async getStats(now: number = Date.now()): Promise<PublicStats> {
    // Short in-process cache so a page that many people open at once costs the
    // database one set of queries every 30 seconds, not one per visitor.
    if (this.cache && now - this.cache.at < CACHE_TTL_MS) {
      return this.cache.data;
    }

    const verified = { verifiedAt: { not: null } };

    const [
      activeCollectors,
      activeCollectionPoints,
      collectionsRecorded,
      collectionsVerified,
      verifiedSums,
      materials,
      recent,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'COLLECTOR', status: 'ACTIVE' } }),
      prisma.collectionPoint.count({ where: { isActive: true } }),
      prisma.wasteCollection.count(),
      prisma.wasteCollection.count({ where: verified }),
      prisma.wasteCollection.aggregate({
        where: verified,
        _sum: { weight: true, paymentAmount: true },
      }),
      prisma.wasteCollection.groupBy({
        by: ['materialType'],
        where: verified,
        _count: true,
        _sum: { weight: true },
        orderBy: { _sum: { weight: 'desc' } },
        take: 8,
      }),
      prisma.wasteCollection.findMany({
        where: verified,
        orderBy: { verifiedAt: 'desc' },
        take: 5,
        select: {
          materialType: true,
          weight: true,
          verifiedAt: true,
          collectionPoint: { select: { city: true } },
        },
      }),
    ]);

    const round = (value: number) => Math.round(value * 100) / 100;

    const data: PublicStats = {
      generatedAt: new Date(now).toISOString(),
      currency: 'KES',
      totals: {
        activeCollectors,
        activeCollectionPoints,
        collectionsRecorded,
        collectionsVerified,
        verifiedWeightKg: round(verifiedSums._sum.weight ?? 0),
        verifiedValue: round(verifiedSums._sum.paymentAmount ?? 0),
      },
      byMaterial: materials.map((row) => ({
        materialType: row.materialType,
        collections: row._count,
        weightKg: round(row._sum.weight ?? 0),
      })),
      recentVerified: recent.map((row) => ({
        materialType: row.materialType,
        weightKg: round(row.weight),
        city: row.collectionPoint.city,
        verifiedAt: (row.verifiedAt as Date).toISOString(),
      })),
    };

    this.cache = { at: now, data };
    return data;
  }

  /** Drop the cache. Used by tests, which create data and then read it back. */
  static resetCache(): void {
    this.cache = null;
  }
}
