import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types/auth.types';

/** Central admins/verifiers retain platform access. Operators require an active point. */
export function enforcePointScope(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'COLLECTION_POINT') {
    next();
    return;
  }
  const point = req.collectionPoint;
  if (!point || !point.isActive) {
    res.status(403).json({
      success: false,
      code: point ? 'COLLECTION_POINT_INACTIVE' : 'COLLECTION_POINT_REQUIRED',
      message: point
        ? 'Your collection point is inactive. Contact an administrator.'
        : 'Ask an administrator to assign you to a collection point.',
    });
    return;
  }
  if (req.query.collectionPointId && req.query.collectionPointId !== point.id) {
    res.status(403).json({
      success: false,
      code: 'COLLECTION_POINT_FORBIDDEN',
      message: 'You can only access your assigned collection point.',
    });
    return;
  }
  next();
}

export function collectionScope(req: AuthRequest) {
  return req.user?.role === 'COLLECTION_POINT'
    ? {
        mode: 'assigned_point',
        point: { id: req.collectionPoint!.id, name: req.collectionPoint!.name },
      }
    : { mode: 'platform', point: null };
}
