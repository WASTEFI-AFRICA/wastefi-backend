import { prisma } from './database.service';
import { RecycleGraphService, MaterialPassportData } from './recyclegraph.service';
import { logger } from '../utils/logger.util';

export interface CreatePassportRequest {
  wasteCollectionId: string;
  productName?: string;
  manufacturer?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  color?: string;
  composition?: Record<string, number>;
  manufacturingDate?: Date;
  expiryDate?: Date;
  recyclingInstructions?: string;
}

export class MaterialPassportService {
  /**
   * Create material passport for a waste collection
   */
  static async createPassport(request: CreatePassportRequest) {
    try {
      // Get waste collection details
      const collection = await prisma.wasteCollection.findUnique({
        where: { id: request.wasteCollectionId },
        include: {
          collector: true,
          collectionPoint: true,
        },
      });

      if (!collection) {
        throw new Error('Waste collection not found');
      }

      // Check if passport already exists
      if (collection.materialPassportId) {
        const existing = await prisma.materialPassport.findUnique({
          where: { id: collection.materialPassportId },
        });

        if (existing) {
          throw new Error('Material passport already exists for this collection');
        }
      }

      // Prepare data for RecycleGraph
      const passportData: MaterialPassportData = {
        materialType: collection.materialType,
        materialCategory: collection.materialCategory,
        weight: collection.weight,
        productName: request.productName,
        manufacturer: request.manufacturer,
        dimensions: request.dimensions,
        color: request.color,
        composition: request.composition,
        manufacturingDate: request.manufacturingDate,
        expiryDate: request.expiryDate,
        recyclingInstructions: request.recyclingInstructions,
        currentLocation: `${collection.collectionPoint.name}, ${collection.collectionPoint.city}`,
      };

      // Create passport in RecycleGraph
      let recycleGraphId: string | undefined;
      let digitalSignature: string | undefined;
      let carbonFootprint: number | undefined;
      let carbonCreditsEarned: number | undefined;

      if (RecycleGraphService.isAvailable()) {
        const rgResult = await RecycleGraphService.createMaterialPassport(passportData);

        if (rgResult.success && rgResult.data) {
          recycleGraphId = rgResult.data.id;
          digitalSignature = rgResult.data.digitalSignature;
          carbonFootprint = rgResult.data.carbonFootprint;
          carbonCreditsEarned = rgResult.data.carbonCreditsEarned;

          logger.info('Material passport created in RecycleGraph', {
            recycleGraphId,
            collectionId: request.wasteCollectionId,
          });
        }
      }

      // Create passport in our database
      const passport = await prisma.materialPassport.create({
        data: {
          materialType: collection.materialType,
          materialCategory: collection.materialCategory,
          productName: request.productName,
          manufacturer: request.manufacturer,
          weight: collection.weight,
          dimensions: request.dimensions ? JSON.stringify(request.dimensions) : null,
          color: request.color,
          composition: request.composition ? JSON.stringify(request.composition) : null,
          manufacturingDate: request.manufacturingDate,
          expiryDate: request.expiryDate,
          recyclingInstructions: request.recyclingInstructions,
          currentLocation: `${collection.collectionPoint.name}, ${collection.collectionPoint.city}`,
          chainOfCustody: JSON.stringify([
            {
              timestamp: new Date(),
              location: `${collection.collectionPoint.name}`,
              custodian: `${collection.collector.firstName} ${collection.collector.lastName}`,
              action: 'COLLECTED',
            },
          ]),
          recycleGraphId,
          digitalSignature,
          carbonFootprint,
          carbonCreditsEarned,
        },
      });

      // Update waste collection with passport ID
      await prisma.wasteCollection.update({
        where: { id: request.wasteCollectionId },
        data: {
          materialPassportId: passport.id,
          recycleGraphId,
          qualityGrade: collection.qualityGrade || 'B', // Default quality grade
        },
      });

      logger.info('Material passport created', {
        passportId: passport.id,
        collectionId: request.wasteCollectionId,
        recycleGraphId,
      });

      return {
        success: true,
        passport,
      };
    } catch (error) {
      logger.error('Failed to create material passport', {
        error: error as Error,
        wasteCollectionId: request.wasteCollectionId,
      });

      throw error;
    }
  }

  /**
   * Get material passport by ID
   */
  static async getPassport(passportId: string) {
    try {
      const passport = await prisma.materialPassport.findUnique({
        where: { id: passportId },
      });

      if (!passport) {
        throw new Error('Material passport not found');
      }

      // Parse JSON fields
      const result = {
        ...passport,
        dimensions: passport.dimensions ? JSON.parse(passport.dimensions) : null,
        composition: passport.composition ? JSON.parse(passport.composition) : null,
        chainOfCustody: passport.chainOfCustody ? JSON.parse(passport.chainOfCustody) : [],
      };

      // Get RecycleGraph data if available
      if (passport.recycleGraphId && RecycleGraphService.isAvailable()) {
        const rgResult = await RecycleGraphService.getMaterialPassport(passport.recycleGraphId);

        if (rgResult.success && rgResult.data) {
          return {
            success: true,
            passport: result,
            recycleGraphData: rgResult.data,
          };
        }
      }

      return {
        success: true,
        passport: result,
      };
    } catch (error) {
      logger.error('Failed to get material passport', {
        error: error as Error,
        passportId,
      });

      throw error;
    }
  }

  /**
   * Update passport custody
   */
  static async updateCustody(
    passportId: string,
    location: string,
    custodian: string,
    action: string
  ) {
    try {
      const passport = await prisma.materialPassport.findUnique({
        where: { id: passportId },
      });

      if (!passport) {
        throw new Error('Material passport not found');
      }

      // Update chain of custody
      const chainOfCustody = passport.chainOfCustody ? JSON.parse(passport.chainOfCustody) : [];

      chainOfCustody.push({
        timestamp: new Date(),
        location,
        custodian,
        action,
      });

      // Update in database
      const updated = await prisma.materialPassport.update({
        where: { id: passportId },
        data: {
          currentLocation: location,
          chainOfCustody: JSON.stringify(chainOfCustody),
          updatedAt: new Date(),
        },
      });

      // Update in RecycleGraph if available
      if (passport.recycleGraphId && RecycleGraphService.isAvailable()) {
        await RecycleGraphService.updatePassportCustody(
          passport.recycleGraphId,
          location,
          custodian,
          action
        );
      }

      logger.info('Material passport custody updated', {
        passportId,
        location,
        action,
      });

      return {
        success: true,
        passport: {
          ...updated,
          chainOfCustody,
        },
      };
    } catch (error) {
      logger.error('Failed to update passport custody', {
        error: error as Error,
        passportId,
      });

      throw error;
    }
  }

  /**
   * Verify material passport
   */
  static async verifyPassport(passportId: string, verificationMethod: string) {
    try {
      const passport = await prisma.materialPassport.findUnique({
        where: { id: passportId },
      });

      if (!passport) {
        throw new Error('Material passport not found');
      }

      // Verify in RecycleGraph if available
      let verified = false;
      if (passport.recycleGraphId && RecycleGraphService.isAvailable()) {
        const rgResult = await RecycleGraphService.verifyPassport(passport.recycleGraphId);
        verified = rgResult.success;
      } else {
        verified = true; // Default to verified if RecycleGraph not available
      }

      // Update passport
      const updated = await prisma.materialPassport.update({
        where: { id: passportId },
        data: {
          verifiedAt: verified ? new Date() : null,
          verificationMethod: verified ? verificationMethod : null,
        },
      });

      logger.info('Material passport verified', {
        passportId,
        verified,
        verificationMethod,
      });

      return {
        success: true,
        verified,
        passport: updated,
      };
    } catch (error) {
      logger.error('Failed to verify passport', {
        error: error as Error,
        passportId,
      });

      throw error;
    }
  }

  /**
   * Calculate carbon credits for passport
   */
  static async calculateCarbonCredits(passportId: string) {
    try {
      const passport = await prisma.materialPassport.findUnique({
        where: { id: passportId },
      });

      if (!passport) {
        throw new Error('Material passport not found');
      }

      let carbonFootprint = 0;
      let carbonCreditsEarned = 0;

      // Calculate using RecycleGraph if available
      if (RecycleGraphService.isAvailable()) {
        const rgResult = await RecycleGraphService.calculateCarbonCredits(
          passport.materialType,
          passport.weight,
          'B' // Default quality grade
        );

        if (rgResult.success && rgResult.data) {
          carbonFootprint = rgResult.data.footprint;
          carbonCreditsEarned = rgResult.data.credits;
        }
      } else {
        // Simple calculation if RecycleGraph not available
        // Example: 1 kg of recycled plastic saves 2 kg CO2
        const carbonSavingsFactor: Record<string, number> = {
          Plastic: 2.0,
          Paper: 1.5,
          Metal: 3.5,
          Glass: 1.0,
          Organic: 0.5,
        };

        const factor = carbonSavingsFactor[passport.materialCategory] || 1.0;
        carbonFootprint = passport.weight * factor;
        carbonCreditsEarned = carbonFootprint * 0.1; // 10% as credits
      }

      // Update passport
      const updated = await prisma.materialPassport.update({
        where: { id: passportId },
        data: {
          carbonFootprint,
          carbonCreditsEarned,
        },
      });

      logger.info('Carbon credits calculated', {
        passportId,
        carbonFootprint,
        carbonCreditsEarned,
      });

      return {
        success: true,
        carbonFootprint,
        carbonCreditsEarned,
        passport: updated,
      };
    } catch (error) {
      logger.error('Failed to calculate carbon credits', {
        error: error as Error,
        passportId,
      });

      throw error;
    }
  }

  /**
   * Get passports for a user
   */
  static async getUserPassports(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      // Get user's waste collections with passports
      const [collections, total] = await Promise.all([
        prisma.wasteCollection.findMany({
          where: {
            collectorId: userId,
            materialPassportId: { not: null },
          },
          include: {
            collectionPoint: {
              select: {
                name: true,
                city: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.wasteCollection.count({
          where: {
            collectorId: userId,
            materialPassportId: { not: null },
          },
        }),
      ]);

      // Get passport details for each collection
      const passports = await Promise.all(
        collections.map(async (collection) => {
          if (!collection.materialPassportId) return null;

          const passport = await prisma.materialPassport.findUnique({
            where: { id: collection.materialPassportId },
          });

          return passport
            ? {
                ...passport,
                collection: {
                  id: collection.id,
                  materialType: collection.materialType,
                  weight: collection.weight,
                  createdAt: collection.createdAt,
                  collectionPoint: collection.collectionPoint,
                },
              }
            : null;
        })
      );

      return {
        passports: passports.filter((p) => p !== null),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get user passports', {
        error: error as Error,
        userId,
      });

      throw error;
    }
  }
}
