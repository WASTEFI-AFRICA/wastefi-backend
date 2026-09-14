# WasteFi Backend

**API, Integrations, and Business Logic**

![CI](https://github.com/wastefi/backend/workflows/CI/badge.svg)
![CD](https://github.com/wastefi/backend/workflows/CD/badge.svg)
[![codecov](https://codecov.io/gh/wastefi/backend/branch/main/graph/badge.svg)](https://codecov.io/gh/wastefi/backend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

#### Getting Started

- [API Documentation](docs/API_DOCUMENTATION.md) - Complete API reference
- [API Quick Reference](docs/API_QUICK_REFERENCE.md) - Quick lookup guide
- [Swagger Guide](docs/SWAGGER_GUIDE.md) - Using interactive documentation
- [Postman Setup](docs/POSTMAN_SETUP.md) - Testing with Postman

#### Features & Integration

- [Authentication Guide](docs/AUTHENTICATION.md) - JWT and API key auth
- [Stellar Integration](docs/STELLAR_INTEGRATION.md) - Blockchain payments
- [Wallet Setup](docs/WALLET_SETUP.md) - Stellar wallet management
- [User Management](docs/USER_MANAGEMENT.md) - User profiles and KYC
- [Collection Points](docs/COLLECTION_POINTS.md) - Geolocation services
- [Waste Collections](docs/WASTE_COLLECTIONS.md) - Collection tracking
- [Payments](docs/PAYMENTS.md) - Payment processing
- [Mobile Money Integration](docs/MOBILE_MONEY.md) - M-Pesa, MTN, Airtel
- [Material Passports](docs/RECYCLEGRAPH_INTEGRATION.md) - RecycleGraph DPP
- [WebSocket Real-Time Updates](docs/WEBSOCKET.md) - Live notifications
- [Admin Dashboard](docs/ADMIN_DASHBOARD.md) - Admin APIs

#### Operations & Deployment

- [Monitoring & Logging](docs/MONITORING.md) - Observability
- [Performance Monitoring](docs/PERFORMANCE_MONITORING.md) - Prometheus metrics
- [Rate Limiting](docs/RATE_LIMITING.md) - Rate limit configuration
- [API Versioning](docs/API_VERSIONING.md) - Version management
- [Backup & Recovery](docs/BACKUP_RECOVERY.md) - Database backups
- [Redis Caching](docs/REDIS_CACHING.md) - Cache configuration
- [Testing Guide](docs/TESTING.md) - Test suite documentation
- [Deployment Guide](docs/DEPLOYMENT.md) - Deployment instructions
- [CI/CD Pipeline](docs/CICD.md) - Automated workflows

#### Production & Security

- [Production Readiness](PRODUCTION_READINESS.md) - Pre-launch checklist
- [Security Policy](SECURITY.md) - Security practices and reporting
- [Changelog](CHANGELOG.md) - Version history

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (32+ chars)
- `REDIS_ENABLED` - Enable Redis caching (true/false)
- `STELLAR_NETWORK` - Stellar network (testnet/public)
- Mobile money credentials (M-Pesa, MTN, Airtel)
- Notification services (Twilio, SendGrid)

See [Production Readiness](PRODUCTION_READINESS.md) for complete configuration guide.

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run in watch mode
npm test -- --watch
```

Current test coverage: 67 passing tests (3 skipped)
Target coverage: 70% (see [Testing Guide](docs/TESTING.md))

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

## Security

Security is a top priority. Please review our [Security Policy](SECURITY.md) for:

- Supported versions
- Security features
- Reporting vulnerabilities
- Best practices

**Report security issues to**: security@wastefi.africa

## Support

- **Documentation**: Check the [docs](docs/) folder
- **API Reference**: Visit `/api/docs` when server is running
- **Issues**: [GitHub Issues](https://github.com/wastefi-africa/wastefi-backend/issues)
- **Email**: support@wastefi.africa
- **Community**: Join our Slack workspace

## Roadmap

See [CHANGELOG.md](CHANGELOG.md) for completed features.

### Future Enhancements

- GraphQL API support
- Multi-language support (i18n)
- Advanced analytics dashboard
- Machine learning for fraud detection
- Mobile app SDK
- Webhook subscriptions
- Two-factor authentication (2FA)
- OAuth 2.0 integration

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgments

- [Stellar Development Foundation](https://stellar.org/) - Blockchain infrastructure
- [RecycleGraph](https://recyclegraph.io/) - Material tracking protocol
- Open source community - For excellent tools and libraries

## Project Status

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Build**: ![CI](https://github.com/wastefi/backend/workflows/CI/badge.svg)  
**Coverage**: [![codecov](https://codecov.io/gh/wastefi/backend/branch/main/graph/badge.svg)](https://codecov.io/gh/wastefi/backend)

---

**Built with ❤️ by the WasteFi Team**  
**Empowering financial inclusion through waste collection**
