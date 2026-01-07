/**
 * Jest setup file for backend tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// Mock Sentry in tests
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  Handlers: {
    requestHandler: () => (req, res, next) => next(),
    tracingHandler: () => (req, res, next) => next(),
    errorHandler: () => (err, req, res, next) => next(err),
  },
  captureException: jest.fn(),
  setUser: jest.fn(),
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  
  // Close Redis connections
  const { getRedisClient } = require('./utils/redis');
  const redis = getRedisClient();
  await redis.quit();
});
