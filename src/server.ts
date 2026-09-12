import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { config } from './config';

// Load environment variables
dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'wastefi-backend',
    version: config.app.version,
  });
});

// API routes placeholder
app.get(`/api/${config.app.apiVersion}`, (_req, res) => {
  res.json({
    message: 'WasteFi Backend API',
    version: config.app.apiVersion,
    documentation: '/api/docs',
  });
});

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

export default app;
