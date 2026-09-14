/**
 * API Versioning Middleware
 * Supports multiple versioning strategies: URL path, header, and query parameter
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.util';

export type ApiVersion = 'v1' | 'v2' | 'v3';

interface VersioningConfig {
  defaultVersion: ApiVersion;
  supportedVersions: ApiVersion[];
  deprecatedVersions?: ApiVersion[];
  sunsetDate?: Partial<Record<ApiVersion, Date>>;
}

const config: VersioningConfig = {
  defaultVersion: 'v1',
  supportedVersions: ['v1', 'v2'],
  deprecatedVersions: [],
  sunsetDate: {},
};

/**
 * Extract API version from request
 * Priority: URL path > Header > Query param > Default
 */
export function extractVersion(req: Request): ApiVersion {
  // 1. Check URL path (e.g., /api/v1/users)
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1] as ApiVersion;
  }

  // 2. Check custom header (e.g., X-API-Version: v1)
  const headerVersion = req.headers['x-api-version'] as string;
  if (headerVersion && isValidVersion(headerVersion)) {
    return headerVersion as ApiVersion;
  }

  // 3. Check Accept header (e.g., Accept: application/vnd.wastefi.v1+json)
  const acceptHeader = req.headers['accept'];
  if (acceptHeader) {
    const acceptMatch = acceptHeader.match(/application\/vnd\.wastefi\.(v\d+)\+json/);
    if (acceptMatch) {
      return acceptMatch[1] as ApiVersion;
    }
  }

  // 4. Check query parameter (e.g., ?version=v1)
  const queryVersion = req.query.version as string;
  if (queryVersion && isValidVersion(queryVersion)) {
    return queryVersion as ApiVersion;
  }

  // 5. Default version
  return config.defaultVersion;
}

/**
 * Validate if version string is valid
 */
function isValidVersion(version: string): boolean {
  return config.supportedVersions.includes(version as ApiVersion);
}

/**
 * API versioning middleware
 */
export function apiVersioning() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Extract version from request
      const version = extractVersion(req);

      // Validate version is supported
      if (!config.supportedVersions.includes(version)) {
        res.status(400).json({
          success: false,
          error: 'Unsupported API Version',
          message: `API version '${version}' is not supported. Supported versions: ${config.supportedVersions.join(', ')}`,
          supportedVersions: config.supportedVersions,
        });
        return;
      }

      // Store version in request for later use
      (req as any).apiVersion = version;

      // Add version to response headers
      res.setHeader('X-API-Version', version);

      // Check if version is deprecated
      if (config.deprecatedVersions?.includes(version)) {
        const sunsetDate = config.sunsetDate?.[version];
        const warningMessage = sunsetDate
          ? `API version ${version} is deprecated and will be sunset on ${sunsetDate.toISOString()}`
          : `API version ${version} is deprecated`;

        res.setHeader('Warning', `299 - "${warningMessage}"`);
        res.setHeader('Sunset', sunsetDate?.toUTCString() || '');

        logger.warn('Deprecated API version used', {
          version,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      // Log version usage for analytics
      logger.debug('API version', {
        version,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      logger.error('API versioning error', { error: error as Error });
      next(error);
    }
  };
}

/**
 * Get current API version from request
 */
export function getApiVersion(req: Request): ApiVersion {
  return (req as any).apiVersion || config.defaultVersion;
}

/**
 * Check if request is using specific version
 */
export function isVersion(req: Request, version: ApiVersion): boolean {
  return getApiVersion(req) === version;
}

/**
 * Version-specific middleware factory
 * Only executes middleware for specified versions
 */
export function forVersions(versions: ApiVersion[], middleware: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const currentVersion = getApiVersion(req);

    if (versions.includes(currentVersion)) {
      return middleware(req, res, next);
    }

    next();
  };
}

/**
 * Deprecate API version
 */
export function deprecateVersion(version: ApiVersion, sunsetDate?: Date): void {
  if (!config.deprecatedVersions) {
    config.deprecatedVersions = [];
  }

  if (!config.deprecatedVersions.includes(version)) {
    config.deprecatedVersions.push(version);
  }

  if (sunsetDate && !config.sunsetDate) {
    config.sunsetDate = {};
  }

  if (sunsetDate && config.sunsetDate) {
    config.sunsetDate[version] = sunsetDate;
  }

  logger.info('API version deprecated', { version, sunsetDate });
}

/**
 * Remove version from supported list
 */
export function removeVersion(version: ApiVersion): void {
  const index = config.supportedVersions.indexOf(version);
  if (index > -1) {
    config.supportedVersions.splice(index, 1);
  }

  logger.info('API version removed', { version });
}

/**
 * Add new API version
 */
export function addVersion(version: ApiVersion): void {
  if (!config.supportedVersions.includes(version)) {
    config.supportedVersions.push(version);
    logger.info('API version added', { version });
  }
}

/**
 * Get versioning configuration
 */
export function getVersioningConfig(): VersioningConfig {
  return { ...config };
}

/**
 * Version-aware response wrapper
 * Transforms response based on API version
 */
export function versionedResponse(req: Request, data: any): any {
  const version = getApiVersion(req);

  // Apply version-specific transformations
  switch (version) {
    case 'v1':
      return transformV1(data);
    case 'v2':
      return transformV2(data);
    case 'v3':
      return transformV3(data);
    default:
      return data;
  }
}

/**
 * V1 response transformation (legacy format)
 */
function transformV1(data: any): any {
  // V1 format - simple wrapper
  return {
    success: true,
    data,
  };
}

/**
 * V2 response transformation (enhanced format)
 */
function transformV2(data: any): any {
  // V2 format - includes metadata
  return {
    success: true,
    data,
    meta: {
      version: 'v2',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * V3 response transformation (future format)
 */
function transformV3(data: any): any {
  // V3 format - placeholder for future
  return {
    success: true,
    data,
    meta: {
      version: 'v3',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Middleware to handle version-specific breaking changes
 */
export function handleBreakingChanges() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const version = getApiVersion(req);

    // Example: Phone number format changed in v2
    if (version === 'v1' && req.body.phoneNumber) {
      // V1 accepts phone without country code
      if (!req.body.phoneNumber.startsWith('+')) {
        req.body.phoneNumber = '+254' + req.body.phoneNumber; // Default to Kenya
      }
    }

    // Add more version-specific transformations here

    next();
  };
}
