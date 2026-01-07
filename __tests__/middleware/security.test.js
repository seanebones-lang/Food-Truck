/**
 * Security Middleware Tests
 * Tests OWASP Top 10 2025 and NIST SP 800-53 Rev. 5 compliance
 */

const {
  securityHeaders,
  globalRateLimiter,
  authRateLimiter,
  redisRateLimiter,
  inputSanitization,
  validateInput,
  validateEmail,
  validateUrl,
  logSecurityEvent,
} = require('../../middleware/security');
const { checkRateLimit } = require('../../utils/redis');

jest.mock('../../utils/redis');

describe('Security Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      path: '/api/test',
      headers: {},
    };
    res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('securityHeaders', () => {
    it('should set security headers', () => {
      const middleware = securityHeaders();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateInput', () => {
    it('should sanitize string inputs', () => {
      req.body = {
        name: '<script>alert("xss")</script>Test',
        email: 'test@example.com',
      };
      validateInput(req, res, next);
      expect(req.body.name).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize nested objects', () => {
      req.body = {
        user: {
          name: '<script>alert("xss")</script>',
        },
      };
      validateInput(req, res, next);
      expect(req.body.user.name).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize arrays', () => {
      req.body = {
        tags: ['<script>alert("xss")</script>', 'normal'],
      };
      validateInput(req, res, next);
      expect(req.body.tags[0]).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      req.body.email = 'test@example.com';
      validateEmail(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid email', () => {
      req.body.email = 'invalid-email';
      validateEmail(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email address',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URL', () => {
      req.body.url = 'https://example.com/image.jpg';
      validateUrl(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject internal IP addresses (SSRF protection)', () => {
      req.body.url = 'http://127.0.0.1/internal';
      validateUrl(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'URL not allowed',
      });
    });

    it('should reject localhost (SSRF protection)', () => {
      req.body.url = 'http://localhost/admin';
      validateUrl(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject private IP ranges', () => {
      req.body.url = 'http://192.168.1.1/internal';
      validateUrl(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('redisRateLimiter', () => {
    it('should allow request within rate limit', async () => {
      checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetAt: Date.now() + 60000,
      });

      await redisRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 5);
    });

    it('should reject request exceeding rate limit', async () => {
      checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      });

      await redisRateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: expect.any(Number),
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use stricter limits for auth endpoints', async () => {
      req.path = '/api/auth/login';
      checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetAt: Date.now() + 900000,
      });

      await redisRateLimiter(req, res, next);

      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('ratelimit:'),
        5, // Auth limit
        900 // 15 minutes
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security events', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      logSecurityEvent('TEST_EVENT', { details: 'test' });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY EVENT]',
        expect.stringContaining('TEST_EVENT')
      );
      consoleSpy.mockRestore();
    });
  });
});
