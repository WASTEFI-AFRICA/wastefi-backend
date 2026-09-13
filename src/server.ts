import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { config } from './config';
import DatabaseService from './services/database.service';
import { StellarService } from './services/stellar.service';
import { logger } from './utils/logger.util';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware';
import {
  addRequestId,
  requestLogger,
  performanceMonitor,
} from './middleware/request-logger.middleware';
import { generalLimiter } from './middleware/rate-limiter.middleware';
import { sanitizeInput } from './middleware/validation.middleware';

// Load environment variables
dotenv.config();

const app: Application = express();

// Initialize database connection
DatabaseService.connect();

// Initialize Stellar service
StellarService.initialize();

// Trust proxy (for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors());

// Request processing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request ID and logging
app.use(addRequestId);
app.use(requestLogger);
app.use(performanceMonitor);

// Sanitize inputs
app.use(sanitizeInput);

// Rate limiting
app.use(generalLimiter.middleware());

// Morgan for HTTP logging (only in development)
if (config.app.env === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', async (_req, res) => {
  const dbHealthy = await DatabaseService.healthCheck();

  const health = {
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'wastefi-backend',
    version: config.app.version,
    environment: config.app.env,
    database: dbHealthy ? 'connected' : 'disconnected',
    stellar: config.stellar.network,
  };

  const statusCode = dbHealthy ? 200 : 503;
  res.status(statusCode).json(health);

  logger.info('Health check', { status: health.status });
});

// Import routes
import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';

// API routes
app.get(`/api/${config.app.apiVersion}`, (_req, res) => {
  res.json({
    message: 'WasteFi Backend API',
    version: config.app.apiVersion,
    documentation: '/api/docs',
  });
});

// Mount routes
app.use(`/api/${config.app.apiVersion}/auth`, authRoutes);
app.use(`/api/${config.app.apiVersion}/wallet`, walletRoutes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.app.port;
app.listen(PORT, () => {
  logger.info('🚀 WasteFi Backend server started', {
    port: PORT,
    environment: config.app.env,
    apiVersion: config.app.apiVersion,
    stellarNetwork: config.stellar.network,
  });
  console.log(`🚀 WasteFi Backend server running on port ${PORT}`);
  console.log(`📊 Environment: ${config.app.env}`);
  console.log(`🔗 API Version: ${config.app.apiVersion}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.warn('Received SIGINT, shutting down gracefully...');
  console.log('\n⚠️  Shutting down gracefully...');
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.warn('Received SIGTERM, shutting down gracefully...');
  console.log('\n⚠️  Shutting down gracefully...');
  await DatabaseService.disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error, stack: error.stack });
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', { reason });
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

export default app;
