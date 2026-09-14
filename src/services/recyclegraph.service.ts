import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.util';
import crypto from 'crypto';

export interface RecycleGraphConfig {
  apiUrl: string;
  apiKey: string;
}

export interface MaterialPassportData {
  materialType: string;
  materialCategory: string;
  weight: number;
  productName?: string;
  manufacturer?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  color?: string;
  composition?: Record<string, number>; // e.g., { "PET": 95, "HDPE": 5 }
  manufacturingDate?: Date;
  expiryDate?: Date;
  recyclingInstructions?: string;
  currentLocation?: string;
  carbonFootprint?: number;
}

export interface RecycleGraphPassport {
  id: string;
  materialType: string;
  materialCategory: string;
  weight: number;
  digitalSignature: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  carbonFootprint: number;
  carbonCreditsEarned: number;
  recyclingPotential: number; // percentage
  qualityGrade: 'A' | 'B' | 'C' | 'D';
  chainOfCustody: Array<{
    timestamp: Date;
    location: string;
    custodian: string;
    action: string;
  }>;
  metadata: Record<string, any>;
}

export interface RecycleGraphResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class RecycleGraphService {
  private static client: AxiosInstance | null = null;
  private static config: RecycleGraphConfig | null = null;

  /**
   * Initialize RecycleGraph service
   */
  static initialize(): void {
    const apiUrl = process.env.RECYCLEGRAPH_API_URL;
    const apiKey = process.env.RECYCLEGRAPH_API_KEY;

    if (!apiUrl || !apiKey) {
      logger.warn('RecycleGraph service not configured - API credentials missing');
      return;
    }

    this.config = { apiUrl, apiKey };

    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      timeout: 30000,
    });

    logger.info('RecycleGraph service initialized', { apiUrl });
  }

  /**
   * Create a material passport in RecycleGraph
   */
  static async createMaterialPassport(
    data: MaterialPassportData
  ): Promise<RecycleGraphResponse<RecycleGraphPassport>> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'RecycleGraph service not configured',
        };
      }

      // Generate digital signature for the material
      const digitalSignature = this.generateDigitalSignature(data);

      // Create passport in RecycleGraph
      const response = await this.client.post('/v1/passports', {
        materialType: data.materialType,
        materialCategory: data.materialCategory,
        weight: data.weight,
        productName: data.productName,
        manufacturer: data.manufacturer,
        dimensions: data.dimensions,
        color: data.color,
        composition: data.composition,
        manufacturingDate: data.manufacturingDate,
        expiryDate: data.expiryDate,
        recyclingInstructions: data.recyclingInstructions,
        currentLocation: data.currentLocation,
        carbonFootprint: data.carbonFootprint,
        digitalSignature,
      });

      logger.info('Material passport created in RecycleGraph', {
        passportId: response.data.id,
        materialType: data.materialType,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to create material passport in RecycleGraph', {
        error: error as Error,
        materialType: data.materialType,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create material passport',
      };
    }
  }

  /**
   * Get material passport from RecycleGraph
   */
  static async getMaterialPassport(
    passportId: string
  ): Promise<RecycleGraphResponse<RecycleGraphPassport>> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'RecycleGraph service not configured',
        };
      }

      const response = await this.client.get(`/v1/passports/${passportId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to get material passport from RecycleGraph', {
        error: error as Error,
        passportId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get material passport',
      };
    }
  }

  /**
   * Update material passport location and custody
   */
  static async updatePassportCustody(
    passportId: string,
    location: string,
    custodian: string,
    action: string
  ): Promise<RecycleGraphResponse<any>> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'RecycleGraph service not configured',
        };
      }

      const response = await this.client.post(`/v1/passports/${passportId}/custody`, {
        location,
        custodian,
        action,
        timestamp: new Date().toISOString(),
      });

      logger.info('Material passport custody updated', {
        passportId,
        location,
        action,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to update passport custody', {
        error: error as Error,
        passportId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update custody',
      };
    }
  }

  /**
   * Verify material passport authenticity
   */
  static async verifyPassport(passportId: string): Promise<RecycleGraphResponse<any>> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'RecycleGraph service not configured',
        };
      }

      const response = await this.client.post(`/v1/passports/${passportId}/verify`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to verify passport', {
        error: error as Error,
        passportId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify passport',
      };
    }
  }

  /**
   * Calculate carbon credits for recycled material
   */
  static async calculateCarbonCredits(
    materialType: string,
    weight: number,
    qualityGrade: string
  ): Promise<RecycleGraphResponse<{ credits: number; footprint: number }>> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'RecycleGraph service not configured',
        };
      }

      const response = await this.client.post('/v1/carbon/calculate', {
        materialType,
        weight,
        qualityGrade,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to calculate carbon credits', {
        error: error as Error,
        materialType,
        weight,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate carbon credits',
      };
    }
  }

  /**
   * Get recycling instructions for material
   */
  static async getRecyclingInstructions(
    materialType: string
  ): Promise<RecycleGraphResponse<{ instructions: string; requirements: string[] }>> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'RecycleGraph service not configured',
        };
      }

      const response = await this.client.get(`/v1/materials/${materialType}/instructions`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to get recycling instructions', {
        error: error as Error,
        materialType,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get recycling instructions',
      };
    }
  }

  /**
   * Search material passports
   */
  static async searchPassports(
    query: string,
    filters?: {
      materialType?: string;
      materialCategory?: string;
      location?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<RecycleGraphResponse<RecycleGraphPassport[]>> {
    try {
      if (!this.client || !this.config) {
        return {
          success: false,
          error: 'RecycleGraph service not configured',
        };
      }

      const response = await this.client.get('/v1/passports/search', {
        params: {
          query,
          ...filters,
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to search passports', {
        error: error as Error,
        query,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search passports',
      };
    }
  }

  /**
   * Generate digital signature for material
   */
  private static generateDigitalSignature(data: MaterialPassportData): string {
    const signatureData = JSON.stringify({
      materialType: data.materialType,
      materialCategory: data.materialCategory,
      weight: data.weight,
      timestamp: new Date().toISOString(),
    });

    return crypto.createHash('sha256').update(signatureData).digest('hex');
  }

  /**
   * Check if RecycleGraph service is available
   */
  static isAvailable(): boolean {
    return this.client !== null && this.config !== null;
  }

  /**
   * Get service health status
   */
  static async getHealthStatus(): Promise<{ healthy: boolean; responseTime: number }> {
    if (!this.client || !this.config) {
      return { healthy: false, responseTime: 0 };
    }

    try {
      const start = Date.now();
      await this.client.get('/v1/health');
      const responseTime = Date.now() - start;

      return { healthy: true, responseTime };
    } catch (error) {
      return { healthy: false, responseTime: 0 };
    }
  }
}
