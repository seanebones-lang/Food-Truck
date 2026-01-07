/**
 * Reliability Middleware Tests
 * Tests circuit breakers, health checks, and fault tolerance
 */

const {
  CircuitBreaker,
  circuitBreakers,
  retryWithBackoff,
  healthCheck,
  requestTimeout,
} = require('../../middleware/reliability');
const { getRedisClient } = require('../../utils/redis');
const prisma = require('../../utils/prisma').default;

jest.mock('../../utils/redis');
jest.mock('../../utils/prisma', () => ({
  default: {
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

describe('Reliability Middleware', () => {
  describe('CircuitBreaker', () => {
    let circuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        resetTimeout: 1000,
      });
    });

    it('should start in CLOSED state', () => {
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failures).toBe(0);
    });

    it('should execute function successfully', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(fn);
      expect(result).toBe('success');
      expect(circuitBreaker.failures).toBe(0);
    });

    it('should track failures', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('failure'));
      const fallback = jest.fn().mockReturnValue('fallback');

      try {
        await circuitBreaker.execute(fn, fallback);
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.failures).toBe(1);
      expect(fallback).toHaveBeenCalled();
    });

    it('should open circuit after threshold failures', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('failure'));
      const fallback = jest.fn().mockReturnValue('fallback');

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn, fallback);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.failures).toBeGreaterThanOrEqual(3);
    });

    it('should use fallback when circuit is OPEN', async () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.lastFailureTime = Date.now();
      const fn = jest.fn();
      const fallback = jest.fn().mockReturnValue('fallback');

      const result = await circuitBreaker.execute(fn, fallback);

      expect(result).toBe('fallback');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.lastFailureTime = Date.now() - 2000; // 2 seconds ago

      const fn = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(fn);

      expect(circuitBreaker.state).toBe('HALF_OPEN');
    });

    it('should close circuit after successful half-open attempts', async () => {
      circuitBreaker.state = 'HALF_OPEN';
      const fn = jest.fn().mockResolvedValue('success');

      // Success threshold is 2
      await circuitBreaker.execute(fn);
      await circuitBreaker.execute(fn);

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failures).toBe(0);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('failure'));

      await expect(retryWithBackoff(fn, { maxRetries: 2 })).rejects.toThrow('failure');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0);
      });

      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');

      await retryWithBackoff(fn, { initialDelay: 100, multiplier: 2 });

      expect(delays.length).toBeGreaterThan(0);
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      getRedisClient.mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      });

      const health = await healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.checks.database.status).toBe('healthy');
      expect(health.checks.redis.status).toBe('healthy');
    });

    it('should return degraded status when database fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Database error'));
      getRedisClient.mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      });

      const health = await healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.checks.database.status).toBe('unhealthy');
      expect(health.checks.redis.status).toBe('healthy');
    });

    it('should return degraded status when redis fails', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      getRedisClient.mockReturnValue({
        ping: jest.fn().mockRejectedValue(new Error('Redis error')),
      });

      const health = await healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.checks.database.status).toBe('healthy');
      expect(health.checks.redis.status).toBe('unhealthy');
    });

    it('should include uptime and timestamp', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      getRedisClient.mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      });

      const health = await healthCheck();

      expect(health.uptime).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('requestTimeout', () => {
    it('should set request timeout', () => {
      const middleware = requestTimeout(5000);
      middleware(req, res, next);
      expect(req.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
    });
  });
});
