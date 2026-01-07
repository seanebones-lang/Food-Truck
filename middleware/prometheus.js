/**
 * Prometheus Metrics Middleware
 * 
 * Exports metrics in Prometheus format for scraping.
 * Provides HTTP request metrics, response times, and error rates.
 * 
 * @module middleware/prometheus
 * @version 2.0.0
 */

const { getMetrics } = require('../utils/metrics');
const { getCacheMetrics } = require('../utils/redis');

/**
 * Prometheus metrics format
 * https://prometheus.io/docs/instrumenting/exposition_formats/
 */
class PrometheusMetrics {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Add metric value
   */
  addMetric(name, value, labels = {}) {
    const labelString = Object.keys(labels).length > 0
      ? '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
      : '';
    return `${name}${labelString} ${value}`;
  }

  /**
   * Generate Prometheus format metrics
   */
  generate() {
    const lines = [];
    
    try {
      const metrics = getMetrics();
      const cacheMetrics = getCacheMetrics();

      // HTTP Request Metrics
      lines.push('# HELP http_requests_total Total number of HTTP requests');
      lines.push('# TYPE http_requests_total counter');
      lines.push(this.addMetric('http_requests_total', metrics.httpRequests.total));

      // HTTP Requests by Method
      lines.push('# HELP http_requests_by_method_total Total requests by HTTP method');
      lines.push('# TYPE http_requests_by_method_total counter');
      for (const [method, count] of Object.entries(metrics.httpRequests.byMethod)) {
        lines.push(this.addMetric('http_requests_by_method_total', count, { method }));
      }

      // HTTP Requests by Status
      lines.push('# HELP http_requests_by_status_total Total requests by status code group');
      lines.push('# TYPE http_requests_by_status_total counter');
      for (const [status, count] of Object.entries(metrics.httpRequests.byStatus)) {
        lines.push(this.addMetric('http_requests_by_status_total', count, { status }));
      }

      // Response Time Metrics
      lines.push('# HELP http_response_time_seconds HTTP response time in seconds');
      lines.push('# TYPE http_response_time_seconds histogram');
      lines.push(this.addMetric('http_response_time_seconds_bucket{le="0.05"}', 0));
      lines.push(this.addMetric('http_response_time_seconds_bucket{le="0.1"}', 0));
      lines.push(this.addMetric('http_response_time_seconds_bucket{le="0.5"}', 0));
      lines.push(this.addMetric('http_response_time_seconds_bucket{le="1"}', 0));
      lines.push(this.addMetric('http_response_time_seconds_bucket{le="5"}', 0));
      lines.push(this.addMetric('http_response_time_seconds_bucket{le="+Inf"}', metrics.responseTimes.count));
      
      lines.push('# HELP http_response_time_seconds_sum Sum of response times');
      lines.push('# TYPE http_response_time_seconds_sum counter');
      const totalTime = metrics.responseTimes.avg * metrics.responseTimes.count / 1000; // Convert to seconds
      lines.push(this.addMetric('http_response_time_seconds_sum', totalTime));

      lines.push('# HELP http_response_time_seconds_count Total number of requests');
      lines.push('# TYPE http_response_time_seconds_count counter');
      lines.push(this.addMetric('http_response_time_seconds_count', metrics.responseTimes.count));

      // Percentiles
      lines.push('# HELP http_response_time_p50_seconds 50th percentile response time');
      lines.push('# TYPE http_response_time_p50_seconds gauge');
      lines.push(this.addMetric('http_response_time_p50_seconds', metrics.responseTimes.p50 / 1000));

      lines.push('# HELP http_response_time_p95_seconds 95th percentile response time');
      lines.push('# TYPE http_response_time_p95_seconds gauge');
      lines.push(this.addMetric('http_response_time_p95_seconds', metrics.responseTimes.p95 / 1000));

      lines.push('# HELP http_response_time_p99_seconds 99th percentile response time');
      lines.push('# TYPE http_response_time_p99_seconds gauge');
      lines.push(this.addMetric('http_response_time_p99_seconds', metrics.responseTimes.p99 / 1000));

      // Error Metrics
      lines.push('# HELP http_errors_total Total number of HTTP errors');
      lines.push('# TYPE http_errors_total counter');
      lines.push(this.addMetric('http_errors_total', metrics.errors.total));

      // Database Metrics
      lines.push('# HELP database_queries_total Total number of database queries');
      lines.push('# TYPE database_queries_total counter');
      lines.push(this.addMetric('database_queries_total', metrics.databaseQueries.total));

      lines.push('# HELP database_queries_slow_total Total number of slow database queries (>100ms)');
      lines.push('# TYPE database_queries_slow_total counter');
      lines.push(this.addMetric('database_queries_slow_total', metrics.databaseQueries.slow));

      // Cache Metrics
      lines.push('# HELP cache_operations_hits_total Total cache hits');
      lines.push('# TYPE cache_operations_hits_total counter');
      lines.push(this.addMetric('cache_operations_hits_total', cacheMetrics.hits));

      lines.push('# HELP cache_operations_misses_total Total cache misses');
      lines.push('# TYPE cache_operations_misses_total counter');
      lines.push(this.addMetric('cache_operations_misses_total', cacheMetrics.misses));

      lines.push('# HELP cache_hit_rate Cache hit rate (0-1)');
      lines.push('# TYPE cache_hit_rate gauge');
      lines.push(this.addMetric('cache_hit_rate', cacheMetrics.hitRate / 100));

      // System Metrics
      const memUsage = process.memoryUsage();
      lines.push('# HELP process_memory_usage_bytes Process memory usage in bytes');
      lines.push('# TYPE process_memory_usage_bytes gauge');
      lines.push(this.addMetric('process_memory_usage_bytes', memUsage.heapUsed, { type: 'heap' }));
      lines.push(this.addMetric('process_memory_usage_bytes', memUsage.rss, { type: 'rss' }));

      lines.push('# HELP process_uptime_seconds Process uptime in seconds');
      lines.push('# TYPE process_uptime_seconds gauge');
      lines.push(this.addMetric('process_uptime_seconds', process.uptime()));

      lines.push('# HELP nodejs_version_info Node.js version information');
      lines.push('# TYPE nodejs_version_info gauge');
      lines.push(this.addMetric('nodejs_version_info', 1, { version: process.version }));

    } catch (error) {
      console.error('Error generating Prometheus metrics:', error);
      lines.push('# ERROR generating metrics');
    }

    return lines.join('\n') + '\n';
  }
}

/**
 * Get Prometheus metrics
 * 
 * @returns {string} Prometheus format metrics
 */
function getPrometheusMetrics() {
  const prometheus = new PrometheusMetrics();
  return prometheus.generate();
}

module.exports = {
  getPrometheusMetrics,
  PrometheusMetrics,
};
