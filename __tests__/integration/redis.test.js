/**
 * Redis Integration Tests
 * Tests Redis connectivity and operations
 */

const { getRedisClient, cacheAnalytics, getCachedAnalytics, checkRateLimit, blocklistToken, isTokenBlocklisted } = require('../../utils/redis');

describe('Redis Integration', () => {
  let redisClient;

  beforeAll(() => {
    redisClient = getRedisClient();
  });

  afterAll(async () => {
    if (redisClient) {
      await redisClient.quit();
    }
  });

  describe('Connection', () => {
    it('should connect to Redis', async () => {
      const result = await redisClient.ping();
      expect(result).toBe('PONG');
    });

    it('should handle connection errors gracefully', async () => {
      // Test that getRedisClient returns a client even if connection fails
      const client = getRedisClient();
      expect(client).toBeDefined();
    });
  });

  describe('Cache Operations', () => {
    const testKey = 'test:cache:key';
    const testData = { test: 'data', number: 123 };

    afterEach(async () => {
      await redisClient.del(testKey);
    });

    it('should cache analytics data', async () => {
      await cacheAnalytics(testKey, testData, 60);

      const cached = await redisClient.get(testKey);
      expect(cached).toBeDefined();
      const parsed = JSON.parse(cached);
      expect(parsed).toEqual(testData);
    });

    it('should retrieve cached analytics data', async () => {
      await cacheAnalytics(testKey, testData, 60);

      const retrieved = await getCachedAnalytics(testKey);
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent cache', async () => {
      const retrieved = await getCachedAnalytics('non-existent-key');
      expect(retrieved).toBeNull();
    });

    it('should expire cache after TTL', async () => {
      await cacheAnalytics(testKey, testData, 1); // 1 second TTL

      const retrieved = await getCachedAnalytics(testKey);
      expect(retrieved).toEqual(testData);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const expired = await getCachedAnalytics(testKey);
      expect(expired).toBeNull();
    }, 5000);
  });

  describe('Rate Limiting', () => {
    const testKey = 'test:ratelimit:key';

    afterEach(async () => {
      await redisClient.del(`ratelimit:${testKey}`);
    });

    it('should allow requests within limit', async () => {
      const result1 = await checkRateLimit(testKey, 5, 60);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBeGreaterThan(0);

      const result2 = await checkRateLimit(testKey, 5, 60);
      expect(result2.allowed).toBe(true);
    });

    it('should block requests exceeding limit', async () => {
      const limit = 3;
      const window = 60;

      // Make requests up to limit
      for (let i = 0; i < limit; i++) {
        await checkRateLimit(testKey, limit, window);
      }

      // Next request should be blocked
      const result = await checkRateLimit(testKey, limit, window);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const limit = 2;
      const window = 1; // 1 second

      // Exceed limit
      await checkRateLimit(testKey, limit, window);
      await checkRateLimit(testKey, limit, window);
      const blocked = await checkRateLimit(testKey, limit, window);
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      const allowed = await checkRateLimit(testKey, limit, window);
      expect(allowed.allowed).toBe(true);
    }, 5000);
  });

  describe('Token Blocklist', () => {
    const testToken = 'test-token-123';

    afterEach(async () => {
      await redisClient.del(`jwt:blocklist:${testToken}`);
    });

    it('should blocklist token', async () => {
      await blocklistToken(testToken, 60);

      const isBlocked = await isTokenBlocklisted(testToken);
      expect(isBlocked).toBe(true);
    });

    it('should check if token is blocklisted', async () => {
      const notBlocked = await isTokenBlocklisted('non-blocklisted-token');
      expect(notBlocked).toBe(false);

      await blocklistToken(testToken, 60);
      const blocked = await isTokenBlocklisted(testToken);
      expect(blocked).toBe(true);
    });

    it('should expire blocklisted token after TTL', async () => {
      await blocklistToken(testToken, 1); // 1 second TTL

      let isBlocked = await isTokenBlocklisted(testToken);
      expect(isBlocked).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      isBlocked = await isTokenBlocklisted(testToken);
      expect(isBlocked).toBe(false);
    }, 5000);
  });
});
