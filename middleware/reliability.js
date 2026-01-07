/**
 * Reliability Middleware Module
 * 
 * Implements fault tolerance, circuit breakers, health checks, and graceful degradation.
 * Target: 99.999% uptime, fault-tolerant with redundancy.
 * 
 * @module middleware/reliability
 * @author Food Truck Engineering Team
 * @version 2.0.0
 * @since 1.0.0
 * 
 * @example
 * ```javascript
 * const { healthCheck, circuitBreakers, retryWithBackoff } = require('./middleware/reliability');
 * const health = await healthCheck();
 * ```
 * 
 * Features:
 * - Circuit breakers for fault isolation
 * - Automatic retry with exponential backoff
 * - Health check endpoints
 * - Graceful shutdown handling
 * - Request timeout management
 */

const { getRedisClient } = require('../utils/redis');
const prisma = require('../utils/prisma').default;

/**
 * Circuit Breaker Implementation
 * 
 * Implements the circuit breaker pattern for fault tolerance.
 * States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 * 
 * @class CircuitBreaker
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 60 seconds
    this.successThreshold = options.successThreshold || 2;
    this.lastFailureTime = null;
  }

  /**
   * Execute function with circuit breaker protection
   * 
   * @param {Function} fn - Function to execute
   * @param {Function} fallback - Fallback function if circuit is open
   * @returns {Promise<any>} Result of function or fallback
   */
  async execute(fn, fallback = null) {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        // Circuit is still open, use fallback
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      
      // Success - reset failures
      if (this.state === 'HALF_OPEN') {
        this.successes++;
        if (this.successes >= this.successThreshold) {
          this.state = 'CLOSED';
          this.failures = 0;
          this.successes = 0;
        }
      } else {
        // CLOSED state - reset failures on success
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      // Failure - increment failure count
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.state === 'HALF_OPEN') {
        // Failed in half-open, go back to open
        this.state = 'OPEN';
        this.successes = 0;
      } else if (this.failures >= this.failureThreshold) {
        // Too many failures, open circuit
        this.state = 'OPEN';
      }
      
      // Use fallback if available
      if (fallback) {
        return fallback();
      }
      
      throw error;
    }
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Circuit breaker instances for different services
 */
const circuitBreakers = {
  database: new CircuitBreaker('database', {
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
  }),
  redis: new CircuitBreaker('redis', {
    failureThreshold: 5,
    resetTimeout: 30000,
  }),
  external: new CircuitBreaker('external', {
    failureThreshold: 3,
    resetTimeout: 60000,
  }),
};

/**
 * Retry with exponential backoff
 * 
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.multiplier - Backoff multiplier (default: 2)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @returns {Promise<any>} Result of function
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    multiplier = 2,
    maxDelay = 30000,
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(multiplier, attempt),
        maxDelay
      );
      
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Health check function
 * 
 * Checks the health of all critical services:
 * - Database connectivity
 * - Redis connectivity
 * 
 * @returns {Promise<Object>} Health status object
 */
async function healthCheck() {
  const checks = {
    database: { status: 'unknown', responseTime: null, error: null },
    redis: { status: 'unknown', responseTime: null, error: null },
  };
  
  const startTime = Date.now();
  
  // Check database
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database.responseTime = Date.now() - dbStart;
    checks.database.status = 'healthy';
  } catch (error) {
    checks.database.status = 'unhealthy';
    checks.database.error = error.message;
  }
  
  // Check Redis
  try {
    const redisStart = Date.now();
    const client = getRedisClient();
    await client.ping();
    checks.redis.responseTime = Date.now() - redisStart;
    checks.redis.status = 'healthy';
  } catch (error) {
    checks.redis.status = 'unhealthy';
    checks.redis.error = error.message;
  }
  
  // Determine overall status
  const allHealthy = Object.values(checks).every(
    (check) => check.status === 'healthy'
  );
  const anyUnhealthy = Object.values(checks).some(
    (check) => check.status === 'unhealthy'
  );
  
  const status = allHealthy ? 'healthy' : anyUnhealthy ? 'degraded' : 'unknown';
  
  return {
    status,
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
  };
}

/**
 * Request timeout middleware
 * 
 * Sets a timeout for requests to prevent hanging requests.
 * 
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Express middleware
 */
function requestTimeout(timeoutMs) {
  return (req, res, next) => {
    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout',
        });
      }
    });
    next();
  };
}

/**
 * Setup graceful shutdown
 * 
 * Handles graceful shutdown of the server and connections.
 * 
 * @param {http.Server} server - HTTP server instance
 */
function setupGracefulShutdown(server) {
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
      console.log('HTTP server closed');
    });
    
    // Close database connections
    try {
      await prisma.$disconnect();
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
    
    // Close Redis connections
    try {
      const { closeRedis } = require('../utils/redis');
      await closeRedis();
      console.log('Redis connections closed');
    } catch (error) {
      console.error('Error closing Redis connections:', error);
    }
    
    // Exit process
    process.exit(0);
  };
  
  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

module.exports = {
  CircuitBreaker,
  circuitBreakers,
  retryWithBackoff,
  healthCheck,
  requestTimeout,
  setupGracefulShutdown,
};
