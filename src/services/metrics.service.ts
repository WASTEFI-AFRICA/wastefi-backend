import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger.util';

/**
 * Metrics Service using Prometheus
 *
 * Provides application metrics collection and exposure for monitoring
 */
class MetricsService {
  private registry: Registry;
  private initialized = false;

  // HTTP Metrics
  public httpRequestDuration: Histogram<string>;
  public httpRequestTotal: Counter<string>;
  public httpRequestErrors: Counter<string>;

  // Database Metrics
  public dbQueryDuration: Histogram<string>;
  public dbConnectionPool: Gauge<string>;

  // Business Metrics
  public collectionsTotal: Counter<string>;
  public paymentsTotal: Counter<string>;
  public usersTotal: Gauge<string>;
  public walletTransactions: Counter<string>;

  // Cache Metrics
  public cacheHits: Counter<string>;
  public cacheMisses: Counter<string>;

  // System Metrics
  public activeConnections: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // Initialize metrics (will be set up in initialize())
    this.httpRequestDuration = {} as Histogram<string>;
    this.httpRequestTotal = {} as Counter<string>;
    this.httpRequestErrors = {} as Counter<string>;
    this.dbQueryDuration = {} as Histogram<string>;
    this.dbConnectionPool = {} as Gauge<string>;
    this.collectionsTotal = {} as Counter<string>;
    this.paymentsTotal = {} as Counter<string>;
    this.usersTotal = {} as Gauge<string>;
    this.walletTransactions = {} as Counter<string>;
    this.cacheHits = {} as Counter<string>;
    this.cacheMisses = {} as Counter<string>;
    this.activeConnections = {} as Gauge<string>;
  }

  /**
   * Initialize metrics collection
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('Metrics service already initialized');
      return;
    }

    try {
      // Collect default metrics (CPU, memory, etc.)
      collectDefaultMetrics({ register: this.registry });

      // HTTP Request Duration
      this.httpRequestDuration = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        registers: [this.registry],
      });

      // HTTP Request Total
      this.httpRequestTotal = new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
        registers: [this.registry],
      });

      // HTTP Request Errors
      this.httpRequestErrors = new Counter({
        name: 'http_request_errors_total',
        help: 'Total number of HTTP request errors',
        labelNames: ['method', 'route', 'error_type'],
        registers: [this.registry],
      });

      // Database Query Duration
      this.dbQueryDuration = new Histogram({
        name: 'db_query_duration_seconds',
        help: 'Duration of database queries in seconds',
        labelNames: ['operation', 'model'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        registers: [this.registry],
      });

      // Database Connection Pool
      this.dbConnectionPool = new Gauge({
        name: 'db_connection_pool_size',
        help: 'Current size of database connection pool',
        labelNames: ['state'],
        registers: [this.registry],
      });

      // Collections Total
      this.collectionsTotal = new Counter({
        name: 'collections_total',
        help: 'Total number of waste collections',
        labelNames: ['status', 'material_type'],
        registers: [this.registry],
      });

      // Payments Total
      this.paymentsTotal = new Counter({
        name: 'payments_total',
        help: 'Total number of payments processed',
        labelNames: ['status', 'currency', 'method'],
        registers: [this.registry],
      });

      // Users Total
      this.usersTotal = new Gauge({
        name: 'users_total',
        help: 'Total number of registered users',
        labelNames: ['role', 'kyc_status'],
        registers: [this.registry],
      });

      // Wallet Transactions
      this.walletTransactions = new Counter({
        name: 'wallet_transactions_total',
        help: 'Total number of wallet transactions',
        labelNames: ['type', 'status'],
        registers: [this.registry],
      });

      // Cache Hits
      this.cacheHits = new Counter({
        name: 'cache_hits_total',
        help: 'Total number of cache hits',
        labelNames: ['cache_type'],
        registers: [this.registry],
      });

      // Cache Misses
      this.cacheMisses = new Counter({
        name: 'cache_misses_total',
        help: 'Total number of cache misses',
        labelNames: ['cache_type'],
        registers: [this.registry],
      });

      // Active Connections
      this.activeConnections = new Gauge({
        name: 'active_connections',
        help: 'Number of active connections',
        labelNames: ['type'],
        registers: [this.registry],
      });

      this.initialized = true;
      logger.info('✅ Metrics service initialized');
    } catch (error) {
      logger.error('Failed to initialize metrics service', { error: error as Error });
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<any> {
    const metrics = await this.registry.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    if (!this.initialized) return;

    try {
      this.httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration);
      this.httpRequestTotal.labels(method, route, statusCode.toString()).inc();
    } catch (error) {
      logger.error('Failed to record HTTP request metric', { error: error as Error });
    }
  }

  /**
   * Record HTTP error
   */
  recordHttpError(method: string, route: string, errorType: string): void {
    if (!this.initialized) return;

    try {
      this.httpRequestErrors.labels(method, route, errorType).inc();
    } catch (error) {
      logger.error('Failed to record HTTP error metric', { error: error as Error });
    }
  }

  /**
   * Record database query
   */
  recordDbQuery(operation: string, model: string, duration: number): void {
    if (!this.initialized) return;

    try {
      this.dbQueryDuration.labels(operation, model).observe(duration);
    } catch (error) {
      logger.error('Failed to record DB query metric', { error: error as Error });
    }
  }

  /**
   * Update database connection pool metrics
   */
  updateDbConnectionPool(active: number, idle: number): void {
    if (!this.initialized) return;

    try {
      this.dbConnectionPool.labels('active').set(active);
      this.dbConnectionPool.labels('idle').set(idle);
    } catch (error) {
      logger.error('Failed to update DB connection pool metric', { error: error as Error });
    }
  }

  /**
   * Record waste collection
   */
  recordCollection(status: string, materialType: string): void {
    if (!this.initialized) return;

    try {
      this.collectionsTotal.labels(status, materialType).inc();
    } catch (error) {
      logger.error('Failed to record collection metric', { error: error as Error });
    }
  }

  /**
   * Record payment
   */
  recordPayment(status: string, currency: string, method: string): void {
    if (!this.initialized) return;

    try {
      this.paymentsTotal.labels(status, currency, method).inc();
    } catch (error) {
      logger.error('Failed to record payment metric', { error: error as Error });
    }
  }

  /**
   * Update user count
   */
  updateUserCount(role: string, kycStatus: string, count: number): void {
    if (!this.initialized) return;

    try {
      this.usersTotal.labels(role, kycStatus).set(count);
    } catch (error) {
      logger.error('Failed to update user count metric', { error: error as Error });
    }
  }

  /**
   * Record wallet transaction
   */
  recordWalletTransaction(type: string, status: string): void {
    if (!this.initialized) return;

    try {
      this.walletTransactions.labels(type, status).inc();
    } catch (error) {
      logger.error('Failed to record wallet transaction metric', { error: error as Error });
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string): void {
    if (!this.initialized) return;

    try {
      this.cacheHits.labels(cacheType).inc();
    } catch (error) {
      logger.error('Failed to record cache hit metric', { error: error as Error });
    }
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string): void {
    if (!this.initialized) return;

    try {
      this.cacheMisses.labels(cacheType).inc();
    } catch (error) {
      logger.error('Failed to record cache miss metric', { error: error as Error });
    }
  }

  /**
   * Update active connections
   */
  updateActiveConnections(type: string, count: number): void {
    if (!this.initialized) return;

    try {
      this.activeConnections.labels(type).set(count);
    } catch (error) {
      logger.error('Failed to update active connections metric', { error: error as Error });
    }
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.registry.clear();
    this.initialized = false;
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export default new MetricsService();
