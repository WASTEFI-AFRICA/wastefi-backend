# Deployment Guide

Complete guide for deploying WasteFi Backend to production.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Management](#database-management)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Overview

WasteFi Backend can be deployed using:

- **Docker Compose** (Recommended) - Complete stack with all services
- **Manual Deployment** - Direct Node.js deployment
- **Cloud Platforms** - AWS, Google Cloud, Azure, DigitalOcean
- **Kubernetes** - For large-scale deployments

### Deployment Stack

- **Application**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Reverse Proxy**: Nginx (optional)
- **Process Manager**: PM2 (manual deployment)

## Prerequisites

### Required

- **Docker** 20.10+ and Docker Compose 2.0+
- **Git** for version control
- **SSL Certificates** (Let's Encrypt recommended)
- **Domain Name** (e.g., api.wastefi.com)

### Environment Requirements

- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB minimum
- **Network**: Public IP address
- **OS**: Linux (Ubuntu 20.04+ recommended)

## Docker Deployment

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/wastefi/backend.git
cd backend

# 2. Copy environment file
cp .env.production .env.production.local

# 3. Edit configuration
nano .env.production.local
# Fill in all required values (see Environment Configuration section)

# 4. Deploy
./scripts/deploy.sh production
```

### Step-by-Step Deployment

#### 1. Prepare Environment

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### 2. Clone and Configure

```bash
# Clone repository
git clone https://github.com/wastefi/backend.git
cd backend

# Create production environment file
cp .env.production .env.production.local

# Edit configuration (see Environment Configuration section)
nano .env.production.local
```

#### 3. Build and Deploy

```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f api
```

#### 4. Run Database Migrations

```bash
# Run migrations
docker-compose exec api npx prisma migrate deploy

# Seed database (optional, for development)
docker-compose exec api npx prisma db seed
```

#### 5. Verify Deployment

```bash
# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/api/docs
```

### Service Management

```bash
# View logs
docker-compose logs -f [service-name]

# Restart service
docker-compose restart api

# Stop all services
docker-compose down

# Update and restart
git pull origin main
docker-compose up -d --build

# Remove volumes (caution: deletes data!)
docker-compose down -v
```

## Manual Deployment

### Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 14+
sudo apt install postgresql postgresql-contrib

# Install Redis (optional)
sudo apt install redis-server

# Install PM2
npm install -g pm2
```

### Deployment Steps

#### 1. Setup Application

```bash
# Clone repository
git clone https://github.com/wastefi/backend.git
cd backend

# Install dependencies
npm ci --only=production

# Copy environment file
cp .env.production .env

# Edit configuration
nano .env

# Generate Prisma Client
npx prisma generate

# Build application
npm run build
```

#### 2. Setup Database

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE wastefi;"
sudo -u postgres psql -c "CREATE USER wastefi_user WITH PASSWORD 'strong_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE wastefi TO wastefi_user;"

# Run migrations
npx prisma migrate deploy
```

#### 3. Start with PM2

```bash
# Start application
pm2 start dist/server.js --name wastefi-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### 4. Configure Nginx

```bash
# Install Nginx
sudo apt install nginx

# Copy Nginx configuration
sudo cp nginx/conf.d/wastefi.conf /etc/nginx/sites-available/wastefi
sudo ln -s /etc/nginx/sites-available/wastefi /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Cloud Deployment

### AWS (Elastic Beanstalk)

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init wastefi-backend --platform node.js-18 --region us-east-1

# Create environment
eb create wastefi-prod --database.engine postgres

# Deploy
eb deploy

# Check status
eb status

# View logs
eb logs
```

### Google Cloud (Cloud Run)

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/wastefi-backend

# Deploy
gcloud run deploy wastefi-backend \
  --image gcr.io/PROJECT_ID/wastefi-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Set environment variables
gcloud run services update wastefi-backend \
  --set-env-vars DATABASE_URL=$DATABASE_URL,JWT_SECRET=$JWT_SECRET
```

### DigitalOcean (App Platform)

1. Connect GitHub repository
2. Configure environment variables
3. Select build command: `npm run build`
4. Select run command: `npm start`
5. Deploy

### Heroku

```bash
# Create app
heroku create wastefi-backend

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set JWT_SECRET=your-secret

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

## Environment Configuration

### Required Variables

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/wastefi

# JWT
JWT_SECRET=<strong-random-secret>

# Stellar
STELLAR_NETWORK=testnet
STELLAR_MASTER_SECRET=<stellar-secret>
```

### Optional Variables

```env
# Redis
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<password>

# Mobile Money
MPESA_CONSUMER_KEY=<key>
MPESA_CONSUMER_SECRET=<secret>

# SMS/Email
TWILIO_ACCOUNT_SID=<sid>
EMAIL_HOST=smtp.gmail.com
```

### Generating Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Redis password
openssl rand -base64 32
```

## Database Management

### Migrations

```bash
# Run migrations
npx prisma migrate deploy

# Create new migration (development)
npx prisma migrate dev --name description

# Reset database (caution!)
npx prisma migrate reset
```

### Backup

```bash
# Backup database
./scripts/backup-db.sh

# Manual backup
docker-compose exec postgres pg_dump -U postgres wastefi > backup.sql

# Backup with gzip
docker-compose exec postgres pg_dump -U postgres wastefi | gzip > backup.sql.gz
```

### Restore

```bash
# Restore from backup
./scripts/restore-db.sh backups/db/wastefi_20260914_120000.sql.gz

# Manual restore
cat backup.sql | docker-compose exec -T postgres psql -U postgres wastefi
```

## Monitoring

### Health Check

```bash
# Check application health
curl http://localhost:3000/health

# Expected response
{
  "status": "ok",
  "timestamp": "2026-09-14T10:00:00Z",
  "database": "connected",
  "redis": "connected"
}
```

### Logs

```bash
# Docker logs
docker-compose logs -f api
docker-compose logs --tail=100 api

# PM2 logs
pm2 logs wastefi-api
pm2 logs --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Resource Usage

```bash
# Docker stats
docker stats wastefi-api

# PM2 monitoring
pm2 monit

# System resources
htop
```

## Backup & Recovery

### Automated Backups

#### Daily Backup Cron Job

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/backend/scripts/backup-db.sh >> /var/log/wastefi-backup.log 2>&1
```

### Disaster Recovery

1. **Database Restore**: Use `restore-db.sh` script
2. **Application Redeploy**: Use `deploy.sh` script
3. **Configuration Recovery**: Restore from version control

### Backup Locations

- **Local**: `backups/db/`
- **S3**: `s3://wastefi-backups/db/`
- **Cloud Storage**: Google Cloud Storage, Azure Blob

## Security

### SSL/TLS Configuration

#### Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.wastefi.com

# Auto-renewal is setup automatically
# Test renewal
sudo certbot renew --dry-run
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable

# Only allow database access from localhost
sudo ufw deny 5432/tcp
```

### Environment Security

- ✅ Never commit `.env` files
- ✅ Use strong passwords (32+ characters)
- ✅ Rotate secrets regularly
- ✅ Use secret management (AWS Secrets Manager, HashiCorp Vault)
- ✅ Enable database encryption
- ✅ Use SSL for all connections

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs api

# Check service status
docker-compose ps

# Restart service
docker-compose restart api

# Rebuild and restart
docker-compose up -d --build
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U postgres -c "SELECT 1;"

# Check DATABASE_URL
docker-compose exec api printenv DATABASE_URL
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Restart service
docker-compose restart api

# Increase Docker memory limit
# Edit docker-compose.yml:
services:
  api:
    mem_limit: 2g
```

### Application Errors

```bash
# View recent logs
docker-compose logs --tail=100 api

# Check health endpoint
curl http://localhost:3000/health

# Restart application
docker-compose restart api
```

## Performance Optimization

### Node.js Optimization

```env
# Increase Node.js memory
NODE_OPTIONS=--max-old-space-size=4096
```

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_collections_user ON waste_collections(user_id);

-- Analyze tables
ANALYZE users;
ANALYZE waste_collections;
```

### Redis Caching

```env
# Enable Redis
REDIS_ENABLED=true

# Configure TTLs
REDIS_TTL_DEFAULT=3600
REDIS_TTL_SESSION=86400
```

## Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] Database created and migrated
- [ ] Secrets generated and stored securely
- [ ] Firewall configured
- [ ] Backup strategy in place

### Post-Deployment

- [ ] Health check passes
- [ ] API documentation accessible
- [ ] Logs are clean
- [ ] Monitoring configured
- [ ] Backup tested
- [ ] Load testing performed
- [ ] Security audit completed

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Support

For deployment issues:

- Check logs first
- Review troubleshooting section
- Contact: support@wastefi.com
