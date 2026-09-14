# Production Readiness Checklist

**WasteFi Backend - Version 1.0.0**

This document provides a comprehensive checklist for deploying WasteFi Backend to production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Security Hardening](#security-hardening)
5. [Performance Optimization](#performance-optimization)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)
8. [Deployment Process](#deployment-process)
9. [Post-Deployment Verification](#post-deployment-verification)
10. [Rollback Plan](#rollback-plan)
11. [Operational Procedures](#operational-procedures)

---

## Pre-Deployment Checklist

### Code Quality

- [x] All tests passing (67/70 tests, 3 skipped)
- [x] No ESLint errors (0 errors, 88 warnings acceptable)
- [x] Code formatted with Prettier
- [x] TypeScript compilation successful
- [x] No security vulnerabilities in dependencies
- [x] Docker image builds successfully
- [x] CI/CD pipelines passing

### Documentation

- [x] API documentation complete (Swagger)
- [x] README updated
- [x] Environment variables documented
- [x] Deployment guide available
- [x] Backup procedures documented
- [x] Security best practices documented

### Infrastructure

- [ ] Production servers provisioned
- [ ] Database server configured
- [ ] Redis server configured
- [ ] Load balancer configured
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] Firewall rules configured

---

## Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://username:password@host:5432/wastefi_prod?schema=public"

# Redis (Optional but recommended)
REDIS_ENABLED=true
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TTL=3600

# JWT Authentication
JWT_SECRET=your-very-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Stellar Blockchain
STELLAR_NETWORK=public
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_ISSUER_SECRET=your-stellar-issuer-secret-key
STELLAR_ISSUER_PUBLIC=your-stellar-issuer-public-key
STELLAR_ASSET_CODE=WASTE

# Mobile Money
MPESA_CONSUMER_KEY=your-mpesa-consumer-key
MPESA_CONSUMER_SECRET=your-mpesa-consumer-secret
MPESA_PASSKEY=your-mpesa-passkey
MPESA_SHORTCODE=your-shortcode
MPESA_CALLBACK_URL=https://yourdomain.com/api/v1/payments/mpesa/callback

MTN_API_KEY=your-mtn-api-key
MTN_API_SECRET=your-mtn-api-secret
MTN_CALLBACK_URL=https://yourdomain.com/api/v1/payments/mtn/callback

AIRTEL_CLIENT_ID=your-airtel-client-id
AIRTEL_CLIENT_SECRET=your-airtel-client-secret
AIRTEL_CALLBACK_URL=https://yourdomain.com/api/v1/payments/airtel/callback

# Notifications
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@wastefi.africa

# RecycleGraph
RECYCLEGRAPH_API_URL=https://api.recyclegraph.io
RECYCLEGRAPH_API_KEY=your-recyclegraph-api-key

# Backup
BACKUP_DIR=/var/backups/wastefi/db
BACKUP_RETENTION_DAYS=30
MAX_BACKUPS=50

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_PREMIUM_MAX=1000
```

### Security Checks

✅ **CRITICAL**: Ensure all secrets are:

- Randomly generated (use `openssl rand -base64 32`)
- Stored securely (never in source control)
- Rotated regularly
- Access-restricted (minimal permissions)

---

## Database Setup

### 1. PostgreSQL Configuration

```bash
# Install PostgreSQL 14+
sudo apt-get install postgresql-14

# Create production database
sudo -u postgres psql
CREATE DATABASE wastefi_prod;
CREATE USER wastefi_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE wastefi_prod TO wastefi_user;
\q
```

### 2. Run Migrations

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://wastefi_user:password@localhost:5432/wastefi_prod"

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate deploy
```

### 3. Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_users_phone ON users(phone_number);
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_collections_user ON waste_collections(user_id);
CREATE INDEX CONCURRENTLY idx_collections_status ON waste_collections(status);
CREATE INDEX CONCURRENTLY idx_payments_status ON payments(status);
CREATE INDEX CONCURRENTLY idx_wallets_address ON wallets(stellar_address);

-- Configure connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Reload configuration
SELECT pg_reload_conf();
```

### 4. Database Backup

```bash
# Enable automated backups (cron)
0 2 * * * /usr/bin/curl -X POST -H "Authorization: Bearer ADMIN_TOKEN" https://api.wastefi.africa/api/v1/backups
```

---

## Security Hardening

### 1. HTTPS/SSL

```bash
# Obtain SSL certificate (Let's Encrypt)
sudo certbot certonly --standalone -d api.wastefi.africa

# Configure reverse proxy (Nginx)
server {
    listen 443 ssl http2;
    server_name api.wastefi.africa;

    ssl_certificate /etc/letsencrypt/live/api.wastefi.africa/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.wastefi.africa/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Firewall Configuration

```bash
# Configure UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Configure fail2ban for SSH protection
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Application Security

- [x] JWT secrets are strong (32+ characters)
- [x] Passwords are hashed with bcrypt
- [x] Rate limiting enabled (per IP and per user)
- [x] Input validation on all endpoints
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS protection (Helmet middleware)
- [x] CORS properly configured
- [x] Request size limits enforced
- [x] API keys for service-to-service auth

### 4. Database Security

```bash
# PostgreSQL hardening
# Edit /etc/postgresql/14/main/postgresql.conf
ssl = on
password_encryption = scram-sha-256

# Edit /etc/postgresql/14/main/pg_hba.conf
# Change authentication method to scram-sha-256
hostssl all all 0.0.0.0/0 scram-sha-256
```

### 5. Dependency Security

```bash
# Audit dependencies
npm audit

# Update to latest secure versions
npm update

# Run security scan in CI/CD
npm run security-check
```

---

## Performance Optimization

### 1. Redis Caching

```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis
# Edit /etc/redis/redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
bind 127.0.0.1
requirepass your-redis-password

# Enable persistence
appendonly yes
appendfilename "appendonly.aof"

# Restart Redis
sudo systemctl restart redis
```

### 2. Node.js Optimization

```bash
# Use production mode
NODE_ENV=production

# Increase memory limit for large workloads
node --max-old-space-size=2048 dist/server.js

# Use cluster mode for multi-core
# Consider using PM2 (see Deployment Process)
```

### 3. Database Connection Pooling

Configure in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Connection pool settings
  pool_timeout = 10
  connection_limit = 20
}
```

### 4. Compression

- [x] Gzip compression enabled (see `server.ts`)
- [x] Response size limits configured
- [x] Static asset caching headers

### 5. CDN Setup (Optional)

- Consider CloudFlare or AWS CloudFront for static assets
- Configure cache headers appropriately
- Enable HTTP/2 for better performance

---

## Monitoring & Logging

### 1. Application Logging

```bash
# Logs directory
mkdir -p /var/log/wastefi
chown -R wastefi:wastefi /var/log/wastefi

# Log rotation (logrotate)
# Create /etc/logrotate.d/wastefi
/var/log/wastefi/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 wastefi wastefi
    sharedscripts
    postrotate
        systemctl reload wastefi
    endscript
}
```

### 2. Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'wastefi-backend'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### 3. Grafana Dashboard

```bash
# Install Grafana
sudo apt-get install grafana

# Add Prometheus data source
# Create dashboards for:
# - API response times
# - Error rates
# - Database performance
# - Cache hit rates
# - Business metrics (collections, payments)
```

### 4. Error Tracking

Consider integrating:

- Sentry for error tracking
- LogRocket for session replay
- DataDog for comprehensive monitoring

### 5. Alerting

Configure alerts for:

- High error rates (>5%)
- Slow response times (>1s p95)
- Database connection failures
- Redis unavailability
- High memory/CPU usage (>80%)
- Failed backups
- Payment processing failures

---

## Backup & Recovery

### 1. Automated Backups

```bash
# Daily automated backups at 2 AM
0 2 * * * /usr/bin/curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.wastefi.africa/api/v1/backups \
  -d '{"type":"full"}' >> /var/log/wastefi/backup-cron.log 2>&1

# Weekly cleanup of old backups
0 3 * * 0 /usr/bin/curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.wastefi.africa/api/v1/backups/cleanup >> /var/log/wastefi/backup-cron.log 2>&1
```

### 2. Backup Storage

- [ ] Configure off-site backup storage (S3, Azure Blob)
- [ ] Test backup restoration monthly
- [ ] Document recovery procedures
- [ ] Set retention policy (30 days recommended)

### 3. Disaster Recovery Plan

1. **Database Failure**

   ```bash
   # Restore from latest backup
   curl -X POST \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api.wastefi.africa/api/v1/backups/{filename}/restore
   ```

2. **Complete System Failure**
   - Provision new server
   - Restore from backup
   - Update DNS
   - Verify all services

3. **Data Corruption**
   - Stop application
   - Identify corruption point
   - Restore from backup before corruption
   - Replay transaction logs if available

### 4. Backup Verification

```bash
# Monthly backup integrity check
0 4 1 * * /usr/bin/curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.wastefi.africa/api/v1/backups/{latest}/restore \
  -d '{"verifyOnly":true}' >> /var/log/wastefi/backup-verify.log 2>&1
```

---

## Deployment Process

### 1. Using Docker (Recommended)

```bash
# Build production image
docker build -t wastefi-backend:1.0.0 .

# Tag for registry
docker tag wastefi-backend:1.0.0 registry.wastefi.africa/wastefi-backend:1.0.0

# Push to registry
docker push registry.wastefi.africa/wastefi-backend:1.0.0

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Using PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file (ecosystem.config.js)
module.exports = {
  apps: [{
    name: 'wastefi-backend',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/wastefi/pm2-error.log',
    out_file: '/var/log/wastefi/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
};

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup systemd
```

### 3. Using Systemd

```bash
# Create /etc/systemd/system/wastefi.service
[Unit]
Description=WasteFi Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=wastefi
WorkingDirectory=/opt/wastefi-backend
Environment=NODE_ENV=production
EnvironmentFile=/opt/wastefi-backend/.env
ExecStart=/usr/bin/node /opt/wastefi-backend/dist/server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/wastefi/app.log
StandardError=append:/var/log/wastefi/error.log

[Install]
WantedBy=multi-user.target

# Enable and start service
sudo systemctl enable wastefi
sudo systemctl start wastefi
sudo systemctl status wastefi
```

### 4. Zero-Downtime Deployment

```bash
# Using PM2 reload
pm2 reload wastefi-backend

# Using blue-green deployment
# 1. Deploy to green environment
# 2. Run health checks
# 3. Switch load balancer to green
# 4. Monitor for issues
# 5. Keep blue as backup for rollback
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Basic health check
curl https://api.wastefi.africa/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-09-14T12:00:00.000Z",
  "service": "wastefi-backend",
  "version": "v1",
  "environment": "production",
  "database": "connected",
  "redis": "connected",
  "stellar": "public"
}
```

### 2. API Endpoint Tests

```bash
# Test registration
curl -X POST https://api.wastefi.africa/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254700000000",
    "firstName": "Test",
    "lastName": "User",
    "password": "SecurePass123!"
  }'

# Test login
curl -X POST https://api.wastefi.africa/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254700000000",
    "password": "SecurePass123!"
  }'

# Test authenticated endpoint
curl https://api.wastefi.africa/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Performance Tests

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test (1000 requests, 100 concurrent)
ab -n 1000 -c 100 https://api.wastefi.africa/health

# Expected: <100ms average response time
```

### 4. Monitoring Checks

- [ ] Prometheus metrics endpoint accessible
- [ ] Grafana dashboards displaying data
- [ ] Log aggregation working
- [ ] Error tracking active
- [ ] Alerts configured and tested

### 5. Integration Tests

- [ ] Stellar testnet transactions working
- [ ] Mobile money test payments successful
- [ ] SMS notifications delivered
- [ ] Email notifications received
- [ ] WebSocket connections stable
- [ ] Redis caching functional

---

## Rollback Plan

### Quick Rollback Steps

1. **Immediate Rollback (Docker)**

   ```bash
   # Rollback to previous version
   docker-compose -f docker-compose.prod.yml down
   docker pull registry.wastefi.africa/wastefi-backend:0.9.0
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Immediate Rollback (PM2)**

   ```bash
   # Rollback to previous release
   pm2 stop wastefi-backend
   cd /opt/wastefi-backend-previous
   pm2 start ecosystem.config.js
   ```

3. **Database Rollback**
   ```bash
   # Restore from pre-deployment backup
   curl -X POST \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api.wastefi.africa/api/v1/backups/{pre-deployment-backup}/restore
   ```

### Rollback Decision Criteria

Rollback immediately if:

- Critical functionality broken (auth, payments)
- Error rate >10%
- Response time p95 >5s
- Database corruption detected
- Security vulnerability exploited

---

## Operational Procedures

### Daily Operations

```bash
# Check application health
curl https://api.wastefi.africa/health

# Check logs for errors
tail -f /var/log/wastefi/app.log | grep ERROR

# Check system resources
htop
df -h
free -m

# Check database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Weekly Operations

- Review error logs and fix recurring issues
- Check backup success rate
- Review performance metrics
- Update dependencies if needed
- Review security alerts

### Monthly Operations

- Test backup restoration
- Review and optimize slow queries
- Audit user access and permissions
- Review and update documentation
- Conduct security audit
- Review and optimize costs

### Incident Response

1. **Incident Detection**
   - Monitor alerts
   - Check health endpoints
   - Review error logs

2. **Incident Assessment**
   - Severity: Critical/High/Medium/Low
   - Impact: Users affected
   - Scope: Services impacted

3. **Incident Response**
   - Notify team
   - Investigate root cause
   - Implement fix or rollback
   - Communicate with stakeholders

4. **Post-Incident**
   - Document incident
   - Conduct post-mortem
   - Implement preventive measures
   - Update runbooks

---

## Performance Benchmarks

### Expected Performance (Production)

- **API Response Time**
  - p50: <50ms
  - p95: <200ms
  - p99: <500ms

- **Database Query Time**
  - Simple queries: <10ms
  - Complex queries: <100ms

- **Cache Hit Rate**
  - Target: >70%

- **Error Rate**
  - Target: <1%

- **Uptime**
  - Target: 99.9% (43 minutes downtime/month)

---

## Security Compliance

### PCI DSS (If handling card payments)

- [ ] Encrypt cardholder data
- [ ] Maintain vulnerability management program
- [ ] Implement strong access control measures
- [ ] Regularly monitor and test networks
- [ ] Maintain information security policy

### GDPR (If handling EU data)

- [ ] Implement data protection by design
- [ ] Obtain user consent for data processing
- [ ] Provide data access and deletion rights
- [ ] Report data breaches within 72 hours
- [ ] Appoint Data Protection Officer

### General Compliance

- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Access control reviews
- [ ] Data encryption at rest and in transit
- [ ] Audit logging enabled

---

## Support & Maintenance

### Support Channels

- Email: support@wastefi.africa
- Slack: #wastefi-support
- On-call: PagerDuty rotation

### Maintenance Windows

- Preferred: Sundays 02:00-04:00 UTC
- Notification: 48 hours advance
- Status page: status.wastefi.africa

### SLA Commitments

- **P0 (Critical)**: 15 minutes response
- **P1 (High)**: 1 hour response
- **P2 (Medium)**: 4 hours response
- **P3 (Low)**: 24 hours response

---

## Conclusion

This production readiness checklist ensures WasteFi Backend is deployed securely, performs optimally, and can be maintained effectively.

**Before going live:**

1. Complete all [ ] checklist items
2. Run full integration tests
3. Conduct security audit
4. Perform load testing
5. Train operations team
6. Document emergency procedures
7. Set up monitoring and alerts
8. Schedule post-launch review

**After deployment:**

- Monitor closely for first 48 hours
- Be ready for immediate rollback
- Collect user feedback
- Iterate and improve

---

**Version:** 1.0.0  
**Last Updated:** September 14, 2026  
**Next Review:** October 14, 2026
