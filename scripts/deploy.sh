#!/bin/bash

# WasteFi Backend Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${TIMESTAMP}"

echo "🚀 Starting WasteFi Backend deployment (${ENVIRONMENT})..."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if environment file exists
if [ ! -f ".env.${ENVIRONMENT}" ]; then
    log_error "Environment file .env.${ENVIRONMENT} not found!"
    exit 1
fi

log_info "Environment file found: .env.${ENVIRONMENT}"

# Backup current deployment
if [ -d "dist" ]; then
    log_info "Creating backup..."
    mkdir -p "${BACKUP_DIR}"
    cp -r dist "${BACKUP_DIR}/"
    log_info "Backup created at ${BACKUP_DIR}"
fi

# Pull latest code
log_info "Pulling latest code from repository..."
git pull origin main

# Install dependencies
log_info "Installing dependencies..."
npm ci --only=production

# Generate Prisma Client
log_info "Generating Prisma Client..."
npx prisma generate

# Build application
log_info "Building application..."
npm run build

# Run database migrations
log_info "Running database migrations..."
npx prisma migrate deploy

# Health check on current instance
if docker-compose ps api | grep -q "Up"; then
    log_info "Testing current instance health..."
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_info "Current instance is healthy"
    else
        log_warn "Current instance health check failed"
    fi
fi

# Deploy with Docker Compose
log_info "Deploying with Docker Compose..."
docker-compose --env-file ".env.${ENVIRONMENT}" up -d --build

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
sleep 10

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_info "Deployment successful! Services are healthy."
        break
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log_error "Deployment failed! Services did not become healthy in time."
        log_warn "Rolling back to previous version..."
        
        if [ -d "${BACKUP_DIR}/dist" ]; then
            cp -r "${BACKUP_DIR}/dist" .
            docker-compose up -d --no-build
        fi
        
        exit 1
    fi
    
    sleep 2
done

# Show running services
log_info "Running services:"
docker-compose ps

# Show logs (last 20 lines)
log_info "Recent logs:"
docker-compose logs --tail=20 api

echo ""
log_info "Deployment completed successfully!"
echo ""
echo "📊 Service URLs:"
echo "   API: http://localhost:3000"
echo "   Health Check: http://localhost:3000/health"
echo "   API Docs: http://localhost:3000/api/docs"
echo ""
echo "📝 Useful commands:"
echo "   View logs: docker-compose logs -f api"
echo "   Restart: docker-compose restart api"
echo "   Stop: docker-compose down"
echo ""
