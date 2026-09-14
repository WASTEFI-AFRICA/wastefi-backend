# Performance Monitoring & Analytics Guide

Complete guide for monitoring and analyzing WasteFi Backend performance.

## Table of Contents

- [Overview](#overview)
- [Metrics Collection](#metrics-collection)
- [Prometheus Setup](#prometheus-setup)
- [Grafana Dashboards](#grafana-dashboards)
- [Alerting](#alerting)
- [Key Metrics](#key-metrics)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Overview

WasteFi Backend uses **Prometheus** for metrics collection and **Grafana** for visualization.

### Monitoring Stack

```
Application (Node.js)
    ↓ (exports metrics)
Prometheus
    ↓ (queries)
Grafana Dashboards
    ↓ (sends alerts)
Alertmanager → Slack/Email
```

### Key Features

- ✅ Real-time metrics collection
- ✅ HTTP request/response monitoring
- ✅ Database query performance
- ✅ Cache hit rate tracking
- ✅ Business metrics (collections, payments, users)
- ✅ System resource monitoring (CPU, memory)
- ✅ Custom alerts and notifications

## Metrics Collection

### Metrics Service

The `MetricsService` provides comprehensive application metrics using Prometheus client.

### Available Metrics

#### HTTP Metrics
- `http_request_duration_seconds` - Request duration histogram
- `http_requests_total` - Total HTTP requests counter
- `http_request_errors_total` - HTTP errors counter

#### Database Metrics
- `db_query_duration_seconds` - Query duration histogram
- `db_connection_pool_size` - Connection pool gauge

#### Business Metrics
- `collections_total` - Waste collections counter
- `payments_total` - Payments processed counter
- `users_total` - Registered users gauge
- `wallet_transactions_total` - Wallet transactions counter

#### Cache Metrics
- `cache_hits_total` - Cache hits counter
- `cache_misses_total` - Cache misses counter

#### System Metrics (default)
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles` - Active handles
- `nodejs_active_requests` - Active requests

### Accessing Metrics

**Prometheus Format:**
```
GET /metrics
```

**JSON Format:**
```
GET /metrics/json
```

### Example Metrics Output

```prometheus
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/health",status_code="200"} 1234

# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/v1/users",status_code="200",le="0.1"} 450
http_request_duration_seconds_bucket{method="GET",route="/api/v1/users",status_code="200",le="0.5"} 498
http_request_duration_seconds_bucket{method="GET",route="/api/v1/users",status_code="200",le="+Inf"} 500

# HELP collections_total Total number of waste collections
# TYPE collections_total counter
collections_total{status="VERIFIED",material_type="PET Bottles"} 89
collections_total{status="PENDING",material_type="Aluminum Cans"} 12
```

## Prometheus Setup

### Installation with Docker

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alerts:/etc/prometheus/alerts
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    ports:
      - 9090:9090
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning
    ports:
      - 3001:3000
    restart: unless-stopped
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

### Start Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### Access Interfaces

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

## Grafana Dashboards

### Importing Dashboard

1. **Open Grafana**: http://localhost:3001
2. **Login**: admin/admin
3. **Import Dashboard**:
   - Click "+" → "Import"
   - Upload `monitoring/grafana/wastefi-dashboard.json`
   - Select Prometheus as data source
   - Click "Import"

### Key Panels

#### 1. Request Rate
Shows requests per second by endpoint
```promql
rate(http_requests_total[5m])
```

#### 2. Response Time (p95)
95th percentile response time
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

#### 3. Error Rate
Errors per second
```promql
rate(http_request_errors_total[5m])
```

#### 4. Active Users
Current number of users
```promql
sum(users_total)
```

#### 5. Collections Today
Collections in last 24 hours
```promql
sum(increase(collections_total[24h]))
```

#### 6. Payments Processed
Successful payments today
```promql
sum(increase(payments_total{status="COMPLETED"}[24h]))
```

#### 7. Cache Hit Rate
Percentage of cache hits
```promql
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

#### 8. Database Performance
Query duration by operation
```promql
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

### Creating Custom Panels

```json
{
  "title": "API Uptime",
  "type": "stat",
  "targets": [
    {
      "expr": "up{job=\"wastefi-api\"}",
      "legendFormat": "Status"
    }
  ]
}
```

## Alerting

### Alert Rules

Defined in `monitoring/alerts/api-alerts.yml`

#### High Error Rate Alert

```yaml
- alert: HighErrorRate
  expr: rate(http_request_errors_total[5m]) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High API error rate detected"
    description: "Error rate is {{ $value }}"
```

#### Service Down Alert

```yaml
- alert: ServiceDown
  expr: up{job="wastefi-api"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "WasteFi API is down"
```

### Alertmanager Configuration

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'slack'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'
```

### Slack Notifications

1. Create Slack webhook
2. Update `alertmanager.yml`
3. Restart Alertmanager

```bash
docker-compose restart alertmanager
```

## Key Metrics

### Performance Metrics

#### Response Time Targets

| Percentile | Target | Alert Threshold |
|------------|--------|-----------------|
| p50 | < 100ms | 200ms |
| p95 | < 500ms | 1s |
| p99 | < 1s | 2s |

#### Error Rate Targets

| Error Type | Target | Alert Threshold |
|------------|--------|-----------------|
| 4xx errors | < 2% | 5% |
| 5xx errors | < 0.1% | 0.5% |

#### Availability

- **Target**: 99.9% uptime
- **Alert**: < 99% in 5 minutes

### Business Metrics

#### Collections
- Total collections per day
- Collections by material type
- Verification rate
- Average weight per collection

#### Payments
- Payment success rate
- Payment processing time
- Total value processed
- Payment method distribution

#### Users
- Active users
- New registrations per day
- KYC completion rate
- User retention

### System Metrics

#### Resource Usage
- CPU usage < 70%
- Memory usage < 80%
- Disk usage < 85%

#### Database
- Query latency p95 < 100ms
- Connection pool utilization < 80%
- Transaction rate

#### Cache
- Hit rate > 70%
- Memory usage
- Eviction rate

## Performance Optimization

### Query Optimization

```typescript
// Record slow queries
MetricsService.recordDbQuery('findMany', 'User', duration);

// Monitor in Grafana
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket{operation="findMany"}[5m]))
```

### Caching Strategy

```typescript
import { cacheAside } from './utils/cache.util';
import MetricsService from './services/metrics.service';

const data = await cacheAside(key, fetcher, { ttl: 300 });

// Metrics recorded automatically
if (cached) {
  MetricsService.recordCacheHit('user');
} else {
  MetricsService.recordCacheMiss('user');
}
```

### Load Testing

```bash
# Install k6
brew install k6  # macOS
sudo apt install k6  # Linux

# Run load test
k6 run loadtest.js
```

**loadtest.js:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% < 500ms
    http_req_failed: ['rate<0.01'],     // <1% errors
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## Troubleshooting

### High Response Time

**Symptoms:**
- p95 latency > 1s
- Slow user experience

**Investigation:**
1. Check database queries
   ```promql
   histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
   ```

2. Review slow endpoints
   ```promql
   topk(5, http_request_duration_seconds{quantile="0.95"})
   ```

3. Check cache hit rate
   ```promql
   rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
   ```

**Solutions:**
- Add database indexes
- Implement caching
- Optimize queries
- Add pagination

### High Error Rate

**Symptoms:**
- Error rate > 5%
- Failed requests

**Investigation:**
1. Check error distribution
   ```promql
   rate(http_request_errors_total[5m])
   ```

2. Review error logs
   ```bash
   docker-compose logs api | grep ERROR
   ```

3. Check dependencies
   - Database connectivity
   - Redis availability
   - External APIs

**Solutions:**
- Fix application bugs
- Improve error handling
- Add retry logic
- Increase timeouts

### Memory Leak

**Symptoms:**
- Memory usage increasing over time
- Out of memory errors

**Investigation:**
1. Monitor memory trend
   ```promql
   process_resident_memory_bytes / 1024 / 1024
   ```

2. Take heap snapshot
   ```bash
   docker exec api kill -USR2 1
   ```

3. Analyze with Chrome DevTools

**Solutions:**
- Fix memory leaks in code
- Implement connection pooling
- Clear unused caches
- Restart service periodically

### Database Performance

**Symptoms:**
- Slow queries
- Connection pool exhausted

**Investigation:**
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check connection pool
SELECT count(*) as connections 
FROM pg_stat_activity;
```

**Solutions:**
- Add indexes
- Optimize queries
- Increase pool size
- Use read replicas

## Best Practices

### 1. Define SLOs
- Availability: 99.9%
- Latency p95: < 500ms
- Error rate: < 1%

### 2. Monitor User Experience
- Track real user metrics
- Monitor critical user journeys
- Alert on degraded experience

### 3. Capacity Planning
- Monitor resource trends
- Plan for growth
- Scale proactively

### 4. Incident Response
- Define alert severity
- Create runbooks
- Practice incident drills

### 5. Regular Reviews
- Weekly performance review
- Monthly capacity planning
- Quarterly optimization

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Database Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

## Support

For monitoring issues:
- Check Prometheus targets
- Review Grafana queries
- Verify metrics endpoint
- Contact: devops@wastefi.com
