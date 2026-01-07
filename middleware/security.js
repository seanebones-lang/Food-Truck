/**
 * Security Middleware Module
 * 
 * Implements OWASP Top 10 2025 and NIST SP 800-53 Rev. 5 compliance.
 * Provides comprehensive security middleware for the Food Truck Management System.
 * 
 * @module middleware/security
 * @author Food Truck Engineering Team
 * @version 2.0.0
 * @since 1.0.0
 * 
 * @example
 * ```javascript
 * const { securityHeaders, globalRateLimiter } = require('./middleware/security');
 * app.use(securityHeaders());
 * app.use(globalRateLimiter);
 * ```
 * 
 * @see {@link https://owasp.org/www-project-top-ten/|OWASP Top 10 2025}
 * @see {@link https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final|NIST SP 800-53 Rev. 5}
 * 
 * Features:
 * - Global rate limiting (AC-7)
 * - Input sanitization (A03: Injection)
 * - Security headers (A04: Insecure Design)
 * - XSS prevention (A03: Injection)
 * - SSRF protection (A10: SSRF)
 * - Request validation
 */

const { checkRateLimit } = require('../utils/redis');
const helmet = require('helmet');
const expressRateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const validator = require('validator');

/**
 * Security headers middleware
 * 
 * Implements NIST SC-7 (Boundary Protection) and OWASP A04 (Insecure Design).
 * Sets comprehensive security headers including CSP, HSTS, and frame protection.
 * 
 * @returns {Function} Express middleware function
 * 
 * @example
 * ```javascript
 * app.use(securityHeaders());
 * ```
 * 
 * @see {@link https://helmetjs.github.io/|Helmet.js Documentation}
 * 
 * Headers set:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 */
const securityHeaders = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          process.env.SOCKET_URL || 'ws://localhost:3001',
          process.env.API_URL || 'http://localhost:3001',
          // Allow WebSocket connections
          'ws://localhost:3001',
          'wss://*',
        ],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
      features: {
        geolocation: ["'self'"],
        camera: ["'none'"],
        microphone: ["'none'"],
      },
    },
  });
};

/**
 * Global rate limiting middleware
 * 
 * Implements NIST AC-7 (Unsuccessful Logon Attempts) and OWASP A04 (Insecure Design).
 * Limits requests per IP to prevent abuse and DoS attacks.
 * 
 * @type {expressRateLimit.RateLimitRequestHandler}
 * 
 * @example
 * ```javascript
 * app.use(globalRateLimiter);
 * ```
 * 
 * Configuration:
 * - Window: 15 minutes
 * - Max requests: 100 per IP
 * - Skips: Health check endpoints
 * 
 * @see {@link https://github.com/express-rate-limit/express-rate-limit|express-rate-limit}
 */
const globalRateLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Authentication rate limiter (stricter)
 * 
 * Prevents brute force attacks on authentication endpoints.
 * More restrictive than global rate limiter.
 * 
 * @type {expressRateLimit.RateLimitRequestHandler}
 * 
 * @example
 * ```javascript
 * app.post('/api/auth/login', authRateLimiter, loginHandler);
 * ```
 * 
 * Configuration:
 * - Window: 15 minutes
 * - Max requests: 5 per IP
 * - Skips successful requests
 * 
 * @see {@link https://github.com/express-rate-limit/express-rate-limit|express-rate-limit}
 */
const authRateLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Redis-based distributed rate limiter
 * 
 * For use across multiple server instances. Uses Redis for distributed rate limiting.
 * Different limits for different endpoint types.
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * ```javascript
 * app.use(redisRateLimiter);
 * ```
 * 
 * Rate limits:
 * - Auth endpoints: 5 requests per 15 minutes
 * - Order endpoints: 20 requests per minute
 * - Analytics endpoints: 10 requests per minute
 * - Default: 100 requests per minute
 * 
 * @throws {Error} Returns 429 if rate limit exceeded
 */
const redisRateLimiter = async (req, res, next) => {
  try {
    const identifier = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const endpoint = req.path;
    const key = `ratelimit:${identifier}:${endpoint}`;
    
    // Different limits for different endpoints
    let limit = 100;
    let windowSeconds = 60;
    
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/signup')) {
      limit = 5;
      windowSeconds = 900; // 15 minutes
    } else if (endpoint.includes('/api/orders')) {
      limit = 20;
      windowSeconds = 60;
    } else if (endpoint.includes('/api/analytics')) {
      limit = 10;
      windowSeconds = 60;
    }
    
    const rateLimit = await checkRateLimit(key, limit, windowSeconds);
    
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      });
    }
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetAt).toISOString());
    
    next();
  } catch (error) {
    // Fail open - allow request if rate limiting fails
    console.error('Rate limiting error:', error);
    next();
  }
};

/**
 * Input sanitization middleware
 * 
 * Prevents XSS and injection attacks. Implements OWASP A03 (Injection) and A01 (Broken Access Control).
 * 
 * @returns {Array<Function>} Array of Express middleware functions
 * 
 * @example
 * ```javascript
 * app.use(...inputSanitization());
 * ```
 * 
 * Middleware included:
 * - express-mongo-sanitize: Prevents MongoDB injection
 * - xss-clean: Prevents XSS attacks
 * - hpp: Prevents HTTP Parameter Pollution
 * 
 * @see {@link https://github.com/fiznool/express-mongo-sanitize|express-mongo-sanitize}
 * @see {@link https://github.com/jsonmaur/xss-clean|xss-clean}
 * @see {@link https://github.com/analog-nico/hpp|hpp}
 */
const inputSanitization = () => {
  return [
    // Remove data with $ and . (MongoDB injection)
    mongoSanitize(),
    // XSS protection
    xss(),
    // HTTP Parameter Pollution protection
    hpp(),
  ];
};

/**
 * Custom input validator
 * 
 * Validates and sanitizes request body, query, and params.
 * Removes HTML tags and dangerous characters from string inputs.
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 * 
 * @returns {void}
 * 
 * @example
 * ```javascript
 * app.use(validateInput);
 * ```
 * 
 * Sanitization:
 * - Removes HTML tags
 * - Escapes special characters
 * - Handles nested objects and arrays
 * 
 * @see {@link https://github.com/validatorjs/validator.js|validator.js}
 */
const validateInput = (req, res, next) => {
  // Sanitize all string inputs
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        
        if (typeof value === 'string') {
          // Remove HTML tags and dangerous characters
          sanitized[key] = validator.escape(validator.stripLow(value));
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  };
  
  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

/**
 * Email validation middleware
 * 
 * Validates email format in request body.
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 * 
 * @returns {void}
 * 
 * @example
 * ```javascript
 * app.post('/api/auth/signup', validateEmail, signupHandler);
 * ```
 * 
 * @throws {Error} Returns 400 if email is invalid
 */
const validateEmail = (req, res, next) => {
  if (req.body.email && !validator.isEmail(req.body.email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address',
    });
  }
  next();
};

/**
 * URL validation middleware
 * 
 * Prevents SSRF (Server-Side Request Forgery) attacks. Implements OWASP A10.
 * Blocks internal IP addresses and private network ranges.
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 * 
 * @returns {void}
 * 
 * @example
 * ```javascript
 * app.post('/api/menus', validateUrl, createMenuHandler);
 * ```
 * 
 * Blocked URLs:
 * - localhost
 * - 127.0.0.1
 * - 192.168.x.x (private network)
 * - 10.x.x.x (private network)
 * - 172.16-31.x.x (private network)
 * 
 * @throws {Error} Returns 400 if URL is invalid or blocked
 * 
 * @see {@link https://owasp.org/www-community/attacks/Server_Side_Request_Forgery|OWASP SSRF}
 */
const validateUrl = (req, res, next) => {
  if (req.body.url || req.body.imageUrl || req.query.url) {
    const url = req.body.url || req.body.imageUrl || req.query.url;
    
    if (url && !validator.isURL(url, { 
      protocols: ['http', 'https'],
      require_protocol: true,
      disallow_auth: false,
    })) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL',
      });
    }
    
    // Prevent SSRF - block internal IPs
    if (url) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        // Block private IP ranges
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname.startsWith('172.17.') ||
          hostname.startsWith('172.18.') ||
          hostname.startsWith('172.19.') ||
          hostname.startsWith('172.20.') ||
          hostname.startsWith('172.21.') ||
          hostname.startsWith('172.22.') ||
          hostname.startsWith('172.23.') ||
          hostname.startsWith('172.24.') ||
          hostname.startsWith('172.25.') ||
          hostname.startsWith('172.26.') ||
          hostname.startsWith('172.27.') ||
          hostname.startsWith('172.28.') ||
          hostname.startsWith('172.29.') ||
          hostname.startsWith('172.30.') ||
          hostname.startsWith('172.31.')
        ) {
          return res.status(400).json({
            success: false,
            message: 'URL not allowed',
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid URL format',
        });
      }
    }
  }
  next();
};

/**
 * Request size limiter
 * Prevents DoS attacks
 */
const requestSizeLimiter = (maxSize = '10mb') => {
  return express.json({ 
    limit: maxSize,
    verify: (req, res, buf) => {
      // Check content type
      if (buf && buf.length) {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Invalid content type');
        }
      }
    },
  });
};

/**
 * CORS configuration
 * Secure CORS for production
 */
const secureCors = () => {
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',')
    : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:5173']);
  
  return require('cors')({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  });
};

/**
 * Check if account is locked due to failed login attempts
 * 
 * Implements NIST AC-7 (Unsuccessful Logon Attempts).
 * Uses exponential backoff: 1min, 5min, 15min, 1hr
 * 
 * @param {string} email - User email address
 * @returns {Promise<Object>} Lockout status { locked: boolean, unlockAt?: Date, attempts?: number }
 * 
 * @example
 * ```javascript
 * const lockout = await checkAccountLockout('user@example.com');
 * if (lockout.locked) {
 *   throw new Error('Account locked');
 * }
 * ```
 */
async function checkAccountLockout(email) {
  const { getRedisClient } = require('../utils/redis');
  const client = getRedisClient();
  
  try {
    const key = `account:lockout:${email}`;
    const attempts = await client.get(key);
    
    if (attempts && parseInt(attempts) >= 5) {
      // Get lockout metadata
      const metaKey = `account:lockout:meta:${email}`;
      const meta = await client.get(metaKey);
      const metadata = meta ? JSON.parse(meta) : null;
      
      return {
        locked: true,
        attempts: parseInt(attempts),
        unlockAt: metadata?.unlockAt ? new Date(metadata.unlockAt) : null,
      };
    }
    
    return {
      locked: false,
      attempts: attempts ? parseInt(attempts) : 0,
    };
  } catch (error) {
    console.error('Error checking account lockout:', error);
    // Fail open - allow login if lockout check fails
    return { locked: false, attempts: 0 };
  }
}

/**
 * Record failed login attempt and lock account if threshold reached
 * 
 * @param {string} email - User email address
 * @returns {Promise<Object>} Lockout status { attempts: number, locked: boolean, duration?: number }
 */
async function recordFailedLogin(email) {
  const { getRedisClient } = require('../utils/redis');
  const client = getRedisClient();
  
  try {
    const key = `account:lockout:${email}`;
    const attempts = await client.incr(key);
    
    // Exponential backoff: 1min, 5min, 15min, 1hr
    const lockoutDurations = [60, 300, 900, 3600]; // seconds
    const durationIndex = Math.min(attempts - 1, lockoutDurations.length - 1);
    const duration = lockoutDurations[durationIndex];
    
    if (attempts === 1) {
      await client.expire(key, duration);
    }
    
    // Store lockout metadata
    const unlockAt = new Date(Date.now() + duration * 1000);
    await client.setex(
      `account:lockout:meta:${email}`,
      duration,
      JSON.stringify({
        attempts,
        lockedAt: new Date().toISOString(),
        unlockAt: unlockAt.toISOString(),
      })
    );
    
    const locked = attempts >= 5;
    
    if (locked) {
      logSecurityEvent('ACCOUNT_LOCKED', { email, attempts, duration });
    }
    
    return { attempts, locked, duration: locked ? duration : null };
  } catch (error) {
    console.error('Error recording failed login:', error);
    return { attempts: 0, locked: false };
  }
}

/**
 * Reset failed login attempts (on successful login or admin action)
 * 
 * @param {string} email - User email address
 * @returns {Promise<void>}
 */
async function resetFailedLoginAttempts(email) {
  const { getRedisClient } = require('../utils/redis');
  const client = getRedisClient();
  
  try {
    await client.del(`account:lockout:${email}`);
    await client.del(`account:lockout:meta:${email}`);
  } catch (error) {
    console.error('Error resetting failed login attempts:', error);
  }
}

/**
 * Validate password strength
 * 
 * Implements NIST SP 800-63B password guidelines:
 * - Minimum 8 characters (recommended: 12+)
 * - Maximum 128 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 * - Not in common passwords list
 * 
 * @param {string} password - Password to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 * 
 * @example
 * ```javascript
 * const result = validatePassword('MyP@ssw0rd');
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
function validatePassword(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  
  // Length validation
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  // Character requirements
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }
  
  // Check against common passwords (simplified list)
  const commonPasswords = [
    'password', '12345678', '123456789', '1234567890',
    'qwerty', 'abc123', 'password123', 'admin123',
    'letmein', 'welcome', 'monkey', '1234567',
    'sunshine', 'princess', 'dragon', 'passw0rd',
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password');
  }
  
  // Check for repeated characters (e.g., "aaaaaa")
  if (/(.)\1{3,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }
  
  // Check for sequential characters (e.g., "1234", "abcd")
  const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const lowerPassword = password.toLowerCase();
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 4; i++) {
      const subseq = seq.substring(i, i + 4);
      if (lowerPassword.includes(subseq) || lowerPassword.includes(subseq.split('').reverse().join(''))) {
        errors.push('Password contains common sequences');
        break;
      }
    }
    if (errors.some(e => e.includes('sequences'))) break;
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Security event logger
 * 
 * Implements NIST CA-7 (Continuous Monitoring).
 * Logs security events for monitoring and auditing.
 * 
 * @param {string} eventType - Type of security event (e.g., 'RATE_LIMIT_EXCEEDED', 'INVALID_TOKEN')
 * @param {Object} details - Additional event details
 * 
 * @returns {void}
 * 
 * @example
 * ```javascript
 * logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip: '127.0.0.1', endpoint: '/api/auth/login' });
 * ```
 * 
 * In production, events should be sent to:
 * - SIEM (Security Information and Event Management)
 * - Security monitoring service
 * - Audit log system
 * 
 * @see {@link https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final/control/ca-7|NIST CA-7}
 */
const logSecurityEvent = (eventType, details) => {
  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    details,
  };
  
  // Log to console (in production, send to security monitoring system)
  console.warn('[SECURITY EVENT]', JSON.stringify(event));
  
  // In production, send to SIEM or security monitoring service
  // Example: sendToSIEM(event);
};

module.exports = {
  securityHeaders,
  globalRateLimiter,
  authRateLimiter,
  redisRateLimiter,
  inputSanitization,
  validateInput,
  validateEmail,
  validateUrl,
  requestSizeLimiter,
  secureCors,
  logSecurityEvent,
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLoginAttempts,
  validatePassword,
};
