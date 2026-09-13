import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { logger } from '../utils/logger.util';

/**
 * Middleware to validate request using express-validator
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: ValidationError) => ({
      field: 'path' in error ? error.path : 'unknown',
      message: error.msg,
      value: 'value' in error ? error.value : undefined,
    }));

    logger.warn('Validation failed', {
      url: req.url,
      method: req.method,
      errors: formattedErrors,
    });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formattedErrors,
    });
    return;
  }

  next();
};

/**
 * Sanitize request body to prevent NoSQL injection
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const key in obj) {
    // Skip prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    sanitized[key] = sanitizeObject(obj[key]);
  }
  return sanitized;
}
