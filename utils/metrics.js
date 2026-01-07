/**
 * Metrics Collection Utility
 * 
 * Provides basic metrics collection for monitoring application performance.
 * Can be extended with Prometheus, StatsD, or other monitoring systems.
 * 
 * @module utils/metrics
 * @version 2.0.0
 */

/**
 * In-memory metrics storage
 */
const metrics = {
  httpRequests: {
    total: 0,
    byMethod: {},
    byStatus: {},
    byEndpoint: {},
  },
  responseTimes: [],
  errors: [],
  databaseQueries: {
    total: 0,
    slow: 0, // queries >100ms
  },
  cacheOperations: {
    hits: 0,
    misses: 0,
  },
};

/**
 * Maximum number of response times to keep in memory
 */
const MAX_METRICS_HISTORY = 1000;

/**
 * Track HTTP request
 * 
 * @param {string} method - HTTP method
 * @param {string} endpoint - Request endpoint
 * @param {number} statusCode - Response status code
 * @param {number} responseTime - Response time in milliseconds
 */
function trackHttpRequest(method, endpoint, statusCode, responseTime) {
  metrics.httpRequests.total++;
  
  // Track by method
  metrics.httpRequests.byMethod[method] = (metrics.httpRequests.byMethod[method] || 0) + 1;
  
  // Track by status code
  const statusGroup = `${Math.floor(statusCode / 100)}xx`;
  metrics.httpRequests.byStatus[statusGroup] = (metrics.httpRequests.byStatus[statusGroup] || 0) + 1;
  
  // Track by endpoint (normalize paths)
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  metrics.httpRequests.byEndpoint[normalizedEndpoint] = 
    (metrics.httpRequests.byEndpoint[normalizedEndpoint] || 0) + 1;
  
  // Track response times
  metrics.responseTimes.push(responseTime);
  if (metrics.responseTimes.length > MAX_METRICS_HISTORY) {
    metrics.responseTimes.shift();
  }
  
  // Track slow requests (>1 second)
  if (responseTime > 1000) {
    trackError('SLOW_REQUEST', {
      endpoint,
      method,
      responseTime,
      statusCode,
    });
  }
}

/**
 * Track error
 * 
 * @param {string} type - Error type
 * @param {Object} details - Error details
 */
function trackError(type, details) {
  const error = {
    type,
    details,
    timestamp: new Date().toISOString(),
  };
  
  metrics.errors.push(error);
  if (metrics.errors.length > MAX_METRICS_HISTORY) {
    metrics.errors.shift();
  }
}

/**
 * Track database query
 * 
 * @param {number} queryTime - Query execution time in milliseconds
 */
function trackDatabaseQuery(queryTime) {
  metrics.databaseQueries.total++;
  
  if (queryTime > 100) {
    metrics.databaseQueries.slow++;
  }
}

/**
 * Track cache operation
 * 
 * @param {string} operation - Operation type (hit, miss)
 */
function trackCacheOperation(operation) {
  if (operation === 'hit') {
    metrics.cacheOperations.hits++;
  } else if (operation === 'miss') {
    metrics.cacheOperations.misses++;
  }
}

/**
 * Normalize endpoint path (remove IDs and dynamic segments)
 * 
 * @param {string} endpoint - Endpoint path
 * @returns {string} Normalized endpoint
 */
function normalizeEndpoint(endpoint) {
  // Replace UUIDs with :id
  return endpoint
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .split('?')[0]; // Remove query params
}

/**
 * Calculate percentiles from array
 * 
 * @param {number[]} values - Array of values
 * @param {number} percentile - Percentile (0-100)
 * @returns {number} Percentile value
 */
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get all metrics
 * 
 * @returns {Object} Metrics object
 */
function getMetrics() {
  const responseTimes = metrics.responseTimes.length > 0 ? metrics.responseTimes : [0];
  
  return {
    httpRequests: {
      total: metrics.httpRequests.total,
      byMethod: { ...metrics.httpRequests.byMethod },
      byStatus: { ...metrics.httpRequests.byStatus },
      byEndpoint: { ...metrics.httpRequests.byEndpoint },
    },
    responseTimes: {
      count: responseTimes.length,
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p50: calculatePercentile(responseTimes, 50),
      p95: calculatePercentile(responseTimes, 95),
      p99: calculatePercentile(responseTimes, 99),
    },
    databaseQueries: {
      total: metrics.databaseQueries.total,
      slow: metrics.databaseQueries.slow,
      slowPercentage: metrics.databaseQueries.total > 0
        ? ((metrics.databaseQueries.slow / metrics.databaseQueries.total) * 100).toFixed(2)
        : 0,
    },
    cacheOperations: {
      hits: metrics.cacheOperations.hits,
      misses: metrics.cacheOperations.misses,
      hitRate: (metrics.cacheOperations.hits + metrics.cacheOperations.misses) > 0
        ? ((metrics.cacheOperations.hits / (metrics.cacheOperations.hits + metrics.cacheOperations.misses)) * 100).toFixed(2)
        : 0,
    },
    errors: {
      total: metrics.errors.length,
      recent: metrics.errors.slice(-10), // Last 10 errors
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reset all metrics (useful for testing)
 */
function resetMetrics() {
  metrics.httpRequests = {
    total: 0,
    byMethod: {},
    byStatus: {},
    byEndpoint: {},
  };
  metrics.responseTimes = [];
  metrics.errors = [];
  metrics.databaseQueries = {
    total: 0,
    slow: 0,
  };
  metrics.cacheOperations = {
    hits: 0,
    misses: 0,
  };
}

module.exports = {
  trackHttpRequest,
  trackError,
  trackDatabaseQuery,
  trackCacheOperation,
  getMetrics,
  resetMetrics,
  normalizeEndpoint,
};
