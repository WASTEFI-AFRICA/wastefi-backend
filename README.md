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
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   └── server.ts        # Application entry point
├── dist/                # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## API Documentation

API documentation will be available at `/api/docs` once Swagger is integrated.

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT
