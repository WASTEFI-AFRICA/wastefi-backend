import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { config } from './config';
import DatabaseService from './services/database.service';
import { StellarService } from './services/stellar.service';

// Load environment variables
dotenv.config();

const app: Application = express();

// Initialize database connection
DatabaseService.connect();

// Initialize Stellar service
StellarService.initialize();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  const dbHealthy = await DatabaseService.healthCheck();
  
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'wastefi-backend',
    version: config.app.version,
    database: dbHealthy ? 'connected' : 'disconnected',
  });
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
  });
});

// Start server
const PORT = config.app.port;
app.listen(PORT, () => {
  console.log(`🚀 WasteFi Backend server running on port ${PORT}`);
  console.log(`📊 Environment: ${config.app.env}`);
  console.log(`🔗 API Version: ${config.app.apiVersion}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Shutting down gracefully...');
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Shutting down gracefully...');
  await DatabaseService.disconnect();
  process.exit(0);
});

export default app;
