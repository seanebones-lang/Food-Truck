/**
 * Redis Utility Module
 * 
 * Provides Redis client and caching utilities.
 * Compatible with both CommonJS (server.js) and TypeScript.
 * 
 * @module utils/redis
 * @version 2.0.0
 */

const Redis = require('ioredis');

// Redis client singleton
let redisClient = null;

/**
 * Get or create Redis client
 * 
 * @returns {Redis} Redis client instance
 */
function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
    });
  }

  return redisClient;
}

/**
 * Close Redis connection
 * 
 * @returns {Promise<void>}
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Cache analytics data with TTL
 * 
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttl - Time to live in seconds (default: 300)
 * @returns {Promise<void>}
 */
async function cacheAnalytics(key, data, ttl = 300) {
  const client = getRedisClient();
  try {
    await client.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Error caching analytics:', error);
  }
}

/**
 * Get cached analytics data
 * 
 * @param {string} key - Cache key
 * @returns {Promise<Object|null>} Cached data or null
 */
async function getCachedAnalytics(key) {
  const client = getRedisClient();
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting cached analytics:', error);
    return null;
  }
}

/**
 * Add JWT token to blocklist
 * 
 * @param {string} token - JWT token to blocklist
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<void>}
 */
async function blocklistToken(token, expiresIn) {
  const client = getRedisClient();
  try {
    // Store token in blocklist with expiry matching token expiration
    await client.setex(`jwt:blocklist:${token}`, expiresIn, '1');
  } catch (error) {
    console.error('Error blocklisting token:', error);
  }
}

/**
 * Check if token is blocklisted
 * 
 * @param {string} token - JWT token to check
 * @returns {Promise<boolean>} True if token is blocklisted
 */
async function isTokenBlocklisted(token) {
  const client = getRedisClient();
  try {
    const result = await client.get(`jwt:blocklist:${token}`);
    return result === '1';
  } catch (error) {
    console.error('Error checking token blocklist:', error);
    return false;
  }
}

/**
 * Rate limiting helper
 * 
 * @param {string} key - Rate limit key
 * @param {number} limit - Maximum number of requests
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<Object>} Rate limit status
 */
async function checkRateLimit(key, limit, windowSeconds) {
  const client = getRedisClient();
  try {
    const redisKey = `ratelimit:${key}`;
    const current = await client.incr(redisKey);
    
    if (current === 1) {
      await client.expire(redisKey, windowSeconds);
    }
    
    const ttl = await client.ttl(redisKey);
    const resetAt = Date.now() + (ttl * 1000);
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetAt,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // On error, allow the request (fail open)
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
  }
}

/**
 * Delete cache key
 * 
 * @param {string} key - Cache key to delete
 * @returns {Promise<void>}
 */
async function deleteCache(key) {
  const client = getRedisClient();
  try {
    await client.del(key);
    // Track cache deletion
    trackCacheOperation('delete', key, true);
  } catch (error) {
    console.error('Error deleting cache:', error);
    trackCacheOperation('delete', key, false);
  }
}

/**
 * Cache metrics tracking
 */
const cacheMetrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

/**
 * Track cache operation for metrics
 * 
 * @param {string} operation - Operation type (hit, miss, set, delete)
 * @param {string} key - Cache key
 * @param {boolean} success - Whether operation succeeded
 */
function trackCacheOperation(operation, key, success) {
  if (operation === 'hit') {
    cacheMetrics.hits++;
  } else if (operation === 'miss') {
    cacheMetrics.misses++;
  } else if (operation === 'set') {
    cacheMetrics.sets++;
  } else if (operation === 'delete') {
    cacheMetrics.deletes++;
  }
  
  if (!success) {
    cacheMetrics.errors++;
  }
}

/**
 * Get cache metrics
 * 
 * @returns {Object} Cache metrics object
 */
function getCacheMetrics() {
  const total = cacheMetrics.hits + cacheMetrics.misses;
  const hitRate = total > 0 ? (cacheMetrics.hits / total * 100).toFixed(2) : 0;
  
  return {
    ...cacheMetrics,
    hitRate: parseFloat(hitRate),
    totalOperations: total,
  };
}

/**
 * Reset cache metrics (useful for testing)
 */
function resetCacheMetrics() {
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  cacheMetrics.sets = 0;
  cacheMetrics.deletes = 0;
  cacheMetrics.errors = 0;
}

// Wrapper functions with metrics tracking
const originalCacheAnalytics = cacheAnalytics;
const cacheAnalyticsWithMetrics = async function(key, data, ttl = 300) {
  const client = getRedisClient();
  try {
    await client.setex(key, ttl, JSON.stringify(data));
    trackCacheOperation('set', key, true);
  } catch (error) {
    console.error('Error caching analytics:', error);
    trackCacheOperation('set', key, false);
  }
};

const originalGetCachedAnalytics = getCachedAnalytics;
const getCachedAnalyticsWithMetrics = async function(key) {
  const client = getRedisClient();
  try {
    const data = await client.get(key);
    if (data) {
      trackCacheOperation('hit', key, true);
      return JSON.parse(data);
    } else {
      trackCacheOperation('miss', key, true);
      return null;
    }
  } catch (error) {
    console.error('Error getting cached analytics:', error);
    trackCacheOperation('miss', key, false);
    return null;
  }
};

// Export both original and metrics versions
// Use metrics versions by default
const cacheAnalyticsExported = cacheAnalyticsWithMetrics;
const getCachedAnalyticsExported = getCachedAnalyticsWithMetrics;

module.exports = {
  getRedisClient,
  closeRedis,
  cacheAnalytics: cacheAnalyticsWithMetrics,
  getCachedAnalytics: getCachedAnalyticsWithMetrics,
  blocklistToken,
  isTokenBlocklisted,
  checkRateLimit,
  deleteCache,
  getCacheMetrics,
  resetCacheMetrics,
  trackCacheOperation,
};
