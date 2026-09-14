# WasteFi Backend

**API, Integrations, and Business Logic**

## Overview

WasteFi Backend provides the core API and business logic for the WasteFi platform - a financial inclusion solution through waste collection powered by open material standards.

## Features

- RESTful API for waste collection management
- Stellar blockchain integration for payments
- Mobile money integration (M-Pesa, MTN, Airtel)
- RecycleGraph protocol integration for material tracking
- Digital product passport generation
- Carbon credit calculation
- SMS notifications for offline users
- **Comprehensive logging and monitoring**
- **Request tracking with unique IDs**
- **Rate limiting and DDoS protection**
- **Input validation and sanitization**
- **Centralized error handling**

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: Stellar (Soroban)
- **Caching**: Redis
- **Authentication**: JWT

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Seed the database with sample data
npm run prisma:seed
```

### Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Database Management

```bash
# Run migrations
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate

# Open Prisma Studio (Database GUI)
npm run prisma:studio

# Seed database
npm run prisma:seed

# Push schema without migrations (dev only)
npm run db:push

# Reset database (WARNING: deletes all data)
npm run db:reset
```

### Linting and Formatting

```bash
# Run linter
npm run lint

# Format code
npm run format
```

## Project Structure

```
wastefi-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   │   ├── auth.middleware.ts         # Authentication
│   │   ├── error.middleware.ts        # Error handling
│   │   ├── rate-limiter.middleware.ts # Rate limiting
│   │   ├── request-logger.middleware.ts # Request logging
│   │   └── validation.middleware.ts   # Input validation
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   │   ├── auth.service.ts       # Authentication logic
│   │   ├── database.service.ts   # Database management
│   │   └── stellar.service.ts    # Stellar integration
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   │   ├── encryption.util.ts # Encryption utilities
│   │   ├── jwt.util.ts        # JWT utilities
│   │   └── logger.util.ts     # Logging system
│   └── server.ts        # Application entry point
├── prisma/              # Prisma schema and migrations
├── scripts/             # Utility scripts
├── docs/                # Documentation
├── dist/                # Compiled JavaScript
└── package.json
```

## API Documentation

### Interactive Documentation (Swagger UI)

Access the interactive API documentation:

```
http://localhost:3000/api/docs
```

Features:
- 🔍 Browse all API endpoints
- 📝 View request/response schemas
- ✅ Test endpoints directly in browser
- 🔐 Built-in authentication testing
- 📥 Download OpenAPI specification

**OpenAPI Spec**: `http://localhost:3000/api/docs.json`

### Key Endpoints

- **Authentication**: `/api/v1/auth/*`
  - POST `/register` - Register new user
  - POST `/login` - Login user
  - GET `/profile` - Get user profile
  - POST `/api-keys` - Create API key

- **Wallet**: `/api/v1/wallet/*`
  - POST `/create` - Create Stellar wallet
  - GET `/balance` - Get wallet balance
  - POST `/send` - Send payment
  - GET `/transactions` - Transaction history

- **Health**: `/health` - Service health check

### Documentation

- [API Documentation](docs/API_DOCUMENTATION.md) - Complete API reference
- [Swagger Guide](docs/SWAGGER_GUIDE.md) - Using interactive documentation
- [Authentication Guide](docs/AUTHENTICATION.md)
- [Stellar Integration](docs/STELLAR_INTEGRATION.md)
- [Wallet Setup](docs/WALLET_SETUP.md)
- [User Management](docs/USER_MANAGEMENT.md)
- [Collection Points](docs/COLLECTION_POINTS.md)
- [Waste Collections](docs/WASTE_COLLECTIONS.md)
- [Payments](docs/PAYMENTS.md)
- [Mobile Money Integration](docs/MOBILE_MONEY.md)
- [Material Passports](docs/RECYCLEGRAPH_INTEGRATION.md)
- [WebSocket Real-Time Updates](docs/WEBSOCKET.md)
- [Admin Dashboard](docs/ADMIN_DASHBOARD.md)
- [Monitoring & Logging](docs/MONITORING.md)
- [Database Setup](DATABASE_SETUP.md)

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT
