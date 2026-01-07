const Redis = require('ioredis');

// Redis client singleton
let redisClient = null;

/**
 * Get or create Redis client
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
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Cache analytics data with TTL
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
 */
async function deleteCache(key) {
  const client = getRedisClient();
  try {
    await client.del(key);
  } catch (error) {
    console.error('Error deleting cache:', error);
  }
}

module.exports = {
  getRedisClient,
  closeRedis,
  cacheAnalytics,
  getCachedAnalytics,
  blocklistToken,
  isTokenBlocklisted,
  checkRateLimit,
  deleteCache,
};