/**
 * Example of versioned routes
 * Shows how to implement version-specific logic
 */

import { Router, Request, Response } from 'express';
import { getApiVersion, isVersion, forVersions } from '../middleware/api-versioning.middleware';

const router = Router();

/**
 * Example: Get user endpoint with version-specific logic
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Simulate user data
  const user = {
    id,
    name: 'John Doe',
    email: 'john@example.com',
    phoneNumber: '+254712345678',
    createdAt: new Date('2026-01-01'),
  };

  // Version-specific response format
  if (isVersion(req, 'v1')) {
    // V1: Simple format, phone without country code
    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber.substring(4), // Remove country code for V1
        created: user.createdAt.toISOString().split('T')[0], // Simple date
      },
    });
  }

  if (isVersion(req, 'v2')) {
    // V2: Enhanced format with metadata
    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber, // Full international format
        createdAt: user.createdAt.toISOString(), // ISO 8601
      },
      meta: {
        version: 'v2',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Default fallback
  return res.json({ success: true, data: user });
});

/**
 * Example: Middleware that only runs for specific versions
 */
router.post(
  '/data',
  forVersions(['v2'], (_req: Request, _res: Response, next: Function) => {
    // This middleware only runs for V2
    console.log('V2-specific processing');
    next();
  }),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Data processed',
      version: getApiVersion(req),
    });
  }
);

/**
 * Example: Feature only available in V2
 */
router.get('/advanced-feature', async (req: Request, res: Response) => {
  if (!isVersion(req, 'v2')) {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: 'This feature is only available in API v2',
      upgradeInfo: {
        availableIn: 'v2',
        documentation: 'https://docs.wastefi.com/api/v2/advanced-feature',
      },
    });
  }

  // V2-specific feature logic
  return res.json({
    success: true,
    data: {
      feature: 'advanced',
      available: true,
    },
    meta: {
      version: 'v2',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
