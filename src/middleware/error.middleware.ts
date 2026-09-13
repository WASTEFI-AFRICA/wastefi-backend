import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.util';
import { config } from '../config';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    isOperational = true;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
    isOperational = true;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    isOperational = true;
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    isOperational = true;
  }

  // Log error
  logger.error('Error occurred', {
    error: err,
    message: err.message,
    stack: err.stack,
    statusCode,
    url: req.url,
    method: req.method,
    userId: (req as any).user?.userId,
  });

  // Send error response
  const errorResponse: {
    success: boolean;
    error: string;
    message: string;
    stack?: string;
  } = {
    success: false,
    error: isOperational ? message : 'Internal server error',
    message: isOperational ? err.message : 'An unexpected error occurred',
  };

  // Include stack trace in development
  if (config.app.env === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
  });

  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error formatter
 */
export const formatValidationErrors = (errors: any[]): string[] => {
  return errors.map((error) => {
    if (error.param && error.msg) {
      return `${error.param}: ${error.msg}`;
    }
    return error.msg || 'Validation error';
  });
};
