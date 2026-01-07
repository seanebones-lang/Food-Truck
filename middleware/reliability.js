/**
 * Reliability Middleware Module
 * Implements fault tolerance, circuit breakers, and health checks
 * Target: 99.999% uptime
 */

const { getRedisClient } = require('../utils/redis');
const prisma = require('../utils/prisma').default;

/**
 * Circuit Breaker implementation
 * Prevents cascading failures
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringWindow = options.monitoringWindow || 60000; // 1 minute
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.successCount = 0;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 2;
  }

  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      // Check if we should attempt to close
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        // Circuit is open, use fallback
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      
      // Success - reset failure count
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.halfOpenSuccessThreshold) {
          this.state = 'CLOSED';
          this.failures = 0;
        }
      } else {
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      // Use fallback if available
      if (fallback) {
        return fallback();
      }
      
      throw error;
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Circuit breakers for different services
const circuitBreakers = {
  database: new CircuitBreaker('database', {
    failureThreshold: 5,
    resetTimeout: 30000,
  }),
  redis: new CircuitBreaker('redis', {
    failureThreshold: 3,
    resetTimeout: 30000,
  }),
  externalApi: new CircuitBreaker('externalApi', {
    failureThreshold: 5,
    resetTimeout: 60000,
  }),
};

/**
 * Retry logic with exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const initialDelay = options.initialDelay || 1000;
  const maxDelay = options.maxDelay || 10000;
  const multiplier = options.multiplier || 2;

  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(multiplier, attempt),
          maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Health check middleware
 * Implements comprehensive health monitoring
 */
async function healthCheck() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    uptime: process.uptime(),
  };

  // Database health check
  try {
    await circuitBreakers.database.execute(async () => {
      await prisma.$queryRaw`SELECT 1`;
    });
    health.checks.database = { status: 'healthy' };
  } catch (error) {
    health.checks.database = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  // Redis health check
  try {
    await circuitBreakers.redis.execute(async () => {
      const client = getRedisClient();
      await client.ping();
    });
    health.checks.redis = { status: 'healthy' };
  } catch (error) {
    health.checks.redis = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memThreshold = 1024 * 1024 * 1024; // 1GB
  if (memUsage.heapUsed > memThreshold) {
    health.checks.memory = {
      status: 'warning',
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    };
  } else {
    health.checks.memory = { status: 'healthy' };
  }

  // CPU check (simplified)
  health.checks.cpu = { status: 'healthy' };

  return health;
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
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
      console.error('Error closing database:', error);
    }

    // Close Redis connections
    try {
      const redisClient = getRedisClient();
      await redisClient.quit();
      console.log('Redis connections closed');
    } catch (error) {
      console.error('Error closing Redis:', error);
    }

    // Exit process
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

/**
 * Request timeout middleware
 */
function requestTimeout(timeout = 30000) {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
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
 * Error handler with circuit breaker integration
 */
function errorHandler(err, req, res, next) {
  // Log error
  console.error('Error:', err);

  // Update circuit breaker if it's a service error
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    circuitBreakers.database.failures++;
  }

  // Send error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = {
  CircuitBreaker,
  circuitBreakers,
  retryWithBackoff,
  healthCheck,
  setupGracefulShutdown,
  requestTimeout,
  errorHandler,
};
