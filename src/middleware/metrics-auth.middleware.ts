import { createHash, timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Gate the Prometheus endpoints: in production a bearer token from
 * METRICS_TOKEN is required; anywhere else the endpoints stay open
 * (local dev, CI). Fails closed when METRICS_TOKEN is not set.
 */
export const requireMetricsToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }
  const expected = process.env.METRICS_TOKEN;
  const header = req.headers.authorization;
  if (
    expected &&
    header !== undefined &&
    safeEqual(`Bearer ${expected}`, header)
  ) {
    next();
    return;
  }
  res.status(401).json({
    success: false,
    error: 'Authentication required',
    message: 'Valid metrics token required',
  });
};

/** Constant-time comparison on equal-length digests (CWE-208). */
function safeEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  return timingSafeEqual(da, db);
}
