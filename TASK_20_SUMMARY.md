# Task 20: Performance Monitoring and Analytics Setup

**Status**: ✅ COMPLETED

## Overview

Implemented comprehensive performance monitoring and analytics infrastructure using Prometheus for metrics collection and Grafana for visualization, with custom business metrics and alerting.

## What Was Implemented

### 1. Metrics Service (`src/services/metrics.service.ts`)

**Complete Prometheus metrics collection service:**

#### Metric Categories

**HTTP Metrics:**

- `http_request_duration_seconds` - Request duration histogram (p50, p95, p99)
- `http_requests_total` - Total requests counter by method/route/status
- `http_request_errors_total` - Error counter by type

**Database Metrics:**

- `db_query_duration_seconds` - Query duration histogram by operation/model
- `db_connection_pool_size` - Connection pool gauge (active/idle)

**Business Metrics:**

- `collections_total` - Waste collections by status/material
- `payments_total` - Payments by status/currency/method
- `users_total` - User count by role/KYC status
- `wallet_transactions_total` - Wallet transactions by type/status

**Cache Metrics:**

- `cache_hits_total` - Cache hits by type
- `cache_misses_total` - Cache misses by type

**System Metrics (default):**

- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles` - Active handles
- `nodejs_active_requests` - Active requests

#### Methods Provided

```typescript
// HTTP tracking
recordHttpRequest(method, route, statusCode, duration);
recordHttpError(method, route, errorType);

// Database tracking
recordDbQuery(operation, model, duration);
updateDbConnectionPool(active, idle);

// Business tracking
recordCollection(status, materialType);
recordPayment(status, currency, method);
updateUserCount(role, kycStatus, count);
recordWalletTransaction(type, status);

// Cache tracking
recordCacheHit(cacheType);
recordCacheMiss(cacheType);

// Metrics retrieval
getMetrics(); // Prometheus format
getMetricsJSON(); // JSON format
```

### 2. Metrics Middleware (`src/middleware/metrics.middleware.ts`)

**Automatic HTTP metrics collection:**

- Request duration measurement using response-time
- Automatic recording of all HTTP requests
- Error tracking for 4xx and 5xx responses
- Active connection tracking

### 3. Metrics Routes (`src/routes/metrics.routes.ts`)

**Metrics exposure endpoints:**

- `GET /metrics` - Prometheus format (for scraping)
- `GET /metrics/json` - JSON format (for API consumption)

### 4. Prometheus Configuration

**`monitoring/prometheus.yml` - Complete Prometheus setup:**

- Scrape configuration for WasteFi API
- PostgreSQL exporter integration
- Redis exporter integration
- Node exporter for system metrics
- Nginx exporter integration
- 15-second scrape interval
- Alert rule loading

### 5. Alert Rules

**`monitoring/alerts/api-alerts.yml` - 10 Alert rules:**

1. **HighErrorRate** - Error rate > 5% for 5 minutes
2. **CriticalErrorRate** - Error rate > 10% for 2 minutes
3. **SlowResponseTime** - p95 > 2s for 5 minutes
4. **ServiceDown** - API unreachable for 1 minute
5. **HighRequestRate** - > 1000 req/s for 5 minutes
6. **SlowDatabaseQueries** - p95 query time > 1s
7. **LowCacheHitRate** - Hit rate < 70% for 10 minutes
8. **HighMemoryUsage** - Memory > 1GB for 5 minutes
9. **HighPaymentFailureRate** - Payment failures > 5%
10. **VerificationBacklog** - > 100 pending collections

### 6. Grafana Dashboard

**`monitoring/grafana/wastefi-dashboard.json` - 10 Panels:**

1. **Request Rate** - Requests per second by endpoint
2. **Response Time (p95)** - 95th percentile latency
3. **Error Rate** - Errors per second by type
4. **Active Users** - Current user count
5. **Collections Today** - Daily collection count
6. **Payments Processed** - Successful payments
7. **Database Query Duration** - Query performance
8. **Cache Hit Rate** - Cache effectiveness
9. **Memory Usage** - Application memory
10. **CPU Usage** - Process CPU utilization

### 7. Server Integration

**Updated `src/server.ts`:**

- Initialized MetricsService on startup
- Added metricsMiddleware for automatic tracking
- Mounted /metrics routes
- Integrated with existing monitoring

### 8. Comprehensive Documentation

**`docs/PERFORMANCE_MONITORING.md` - Complete guide:**

- Monitoring stack overview
- Metrics collection details
- Prometheus setup instructions
- Grafana dashboard configuration
- Alerting setup and rules
- Key performance indicators
- Troubleshooting guides
- Performance optimization tips
- Load testing examples
- Best practices

## Key Features

### Metrics Collection

✅ Automatic HTTP request tracking  
✅ Database query performance monitoring  
✅ Business metrics (collections, payments, users)  
✅ Cache performance tracking  
✅ System resource monitoring  
✅ Real-time metric updates

### Visualization

✅ Pre-built Grafana dashboard  
✅ 10 key performance panels  
✅ Real-time graphs and stats  
✅ Custom query support  
✅ Prometheus integration

### Alerting

✅ 10 pre-configured alert rules  
✅ Multiple severity levels  
✅ Slack/Email notification ready  
✅ Custom alert thresholds  
✅ Alert grouping and routing

### Performance

✅ Low overhead metrics collection  
✅ Efficient histogram buckets  
✅ Optimized scrape intervals  
✅ Resource usage monitoring

## Usage Examples

### Recording Custom Metrics

```typescript
import MetricsService from './services/metrics.service';

// Record a waste collection
MetricsService.recordCollection('VERIFIED', 'PET Bottles');

// Record a payment
MetricsService.recordPayment('COMPLETED', 'KES', 'MPESA');

// Record cache hit
MetricsService.recordCacheHit('user-profile');

// Update user count
MetricsService.updateUserCount('USER', 'APPROVED', 150);
```

### Querying Metrics

**Prometheus format:**

```bash
curl http://localhost:3000/metrics
```

**JSON format:**

```bash
curl http://localhost:3000/metrics/json
```

### Prometheus Queries

**Request rate:**

```promql
rate(http_requests_total[5m])
```

**95th percentile response time:**

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Error rate:**

```promql
rate(http_request_errors_total[5m]) / rate(http_requests_total[5m])
```

**Cache hit rate:**

```promql
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

## Monitoring Stack Setup

### Quick Start

```bash
# 1. Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# 2. Access interfaces
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001

# 3. Import dashboard
# Upload monitoring/grafana/wastefi-dashboard.json

# 4. Configure alerts
# Alerts loaded from monitoring/alerts/
```

### Prometheus Targets

- **wastefi-api**: Application metrics
- **postgres-exporter**: Database metrics
- **redis-exporter**: Cache metrics
- **node-exporter**: System metrics
- **nginx-exporter**: Proxy metrics

## Performance Targets

### Response Time SLOs

| Percentile | Target  | Alert Threshold |
| ---------- | ------- | --------------- |
| p50        | < 100ms | 200ms           |
| p95        | < 500ms | 1s              |
| p99        | < 1s    | 2s              |

### Error Rate SLOs

| Error Type | Target | Alert Threshold |
| ---------- | ------ | --------------- |
| 4xx errors | < 2%   | 5%              |
| 5xx errors | < 0.1% | 0.5%            |

### Availability SLO

- **Target**: 99.9% uptime
- **Alert**: < 99% in 5 minutes

### Resource Limits

- CPU usage < 70%
- Memory usage < 80%
- Disk usage < 85%
- Cache hit rate > 70%

## Alert Configuration

### Severity Levels

- **Critical**: Immediate action required (service down, critical errors)
- **Warning**: Investigation needed (performance degradation)
- **Info**: Awareness only (high traffic, trends)

### Notification Channels

```yaml
# Slack
api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'
channel: '#alerts'

# Email
to: 'ops@wastefi.com'
from: 'monitoring@wastefi.com'

# PagerDuty
service_key: 'YOUR_PAGERDUTY_KEY'
```

## Metrics Endpoints

### Prometheus Format

```
GET /metrics
Content-Type: text/plain; version=0.0.4
```

### JSON Format

```
GET /metrics/json
Content-Type: application/json
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "name": "http_requests_total",
      "type": "counter",
      "help": "Total number of HTTP requests",
      "values": [...]
    }
  ],
  "timestamp": "2026-09-14T10:00:00Z"
}
```

## Performance Optimization

### Database Query Monitoring

```typescript
const start = Date.now();
const result = await prisma.user.findMany();
const duration = (Date.now() - start) / 1000;

MetricsService.recordDbQuery('findMany', 'User', duration);
```

### Cache Performance Tracking

```typescript
const cached = await RedisService.get(key);
if (cached) {
  MetricsService.recordCacheHit('user');
  return cached;
} else {
  MetricsService.recordCacheMiss('user');
  const data = await fetchData();
  await RedisService.set(key, data);
  return data;
}
```

## Dependencies Installed

```json
{
  "dependencies": {
    "prom-client": "^15.1.3",
    "express-rate-limit": "^7.1.5",
    "response-time": "^2.3.2"
  },
  "devDependencies": {
    "@types/response-time": "^2.3.8"
  }
}
```

## Files Created

### Application Files

- ✅ `src/services/metrics.service.ts` - Metrics collection service
- ✅ `src/middleware/metrics.middleware.ts` - Automatic HTTP tracking
- ✅ `src/routes/metrics.routes.ts` - Metrics endpoints

### Configuration Files

- ✅ `monitoring/prometheus.yml` - Prometheus configuration
- ✅ `monitoring/alerts/api-alerts.yml` - Alert rules
- ✅ `monitoring/grafana/wastefi-dashboard.json` - Grafana dashboard

### Documentation

- ✅ `docs/PERFORMANCE_MONITORING.md` - Complete monitoring guide

### Modified Files

- ✅ `src/server.ts` - Integrated metrics service
- ✅ `package.json` - Added monitoring dependencies

## Build Status

✅ Build completed successfully  
✅ TypeScript compilation passed  
✅ All dependencies installed

## Benefits

### Operations

- 📊 Real-time visibility into application performance
- 🚨 Proactive alerting before issues impact users
- 📈 Trend analysis for capacity planning
- 🔍 Quick troubleshooting with detailed metrics
- 📉 Performance regression detection

### Development

- 🎯 Performance targets clearly defined
- 🐛 Easy identification of slow endpoints
- 💾 Database query optimization insights
- 🗄️ Cache effectiveness monitoring
- 📊 Business metrics tracking

### Business

- 💼 Real-time business metrics (collections, payments)
- 👥 User growth tracking
- 💰 Revenue monitoring
- 📊 Platform health visibility
- 🎯 SLO achievement tracking

## Monitoring Workflow

### Daily Operations

1. **Morning Check**: Review dashboards, check for alerts
2. **Incident Response**: Investigate triggered alerts
3. **Performance Review**: Check key metrics vs targets
4. **Capacity Planning**: Monitor resource trends

### Weekly Review

1. Review SLO achievement
2. Analyze performance trends
3. Identify optimization opportunities
4. Update alert thresholds if needed

### Monthly Planning

1. Capacity planning based on trends
2. Performance optimization initiatives
3. Alert rule refinement
4. Dashboard improvements

## Commit Message

```bash
git add .
git commit -m "Add performance monitoring and analytics with Prometheus"
```

## Summary

Task 20 successfully implemented comprehensive performance monitoring with:

1. ✅ Complete Prometheus metrics collection service
2. ✅ Automatic HTTP request tracking middleware
3. ✅ Business metrics (collections, payments, users, wallet)
4. ✅ Database and cache performance monitoring
5. ✅ System resource tracking (CPU, memory, event loop)
6. ✅ Prometheus configuration with scraping setup
7. ✅ 10 pre-configured alert rules
8. ✅ Pre-built Grafana dashboard with 10 panels
9. ✅ Comprehensive monitoring documentation
10. ✅ Build verification completed successfully

The application now has production-grade performance monitoring providing real-time visibility, proactive alerting, and comprehensive analytics for operations, development, and business stakeholders.

**Next**: Ready for Task 21
