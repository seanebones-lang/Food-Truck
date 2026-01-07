const { PrismaClient } = require('@prisma/client');

/**
 * PrismaClient singleton to prevent multiple instances
 * 
 * Connection pooling is configured via DATABASE_URL query parameters:
 * - connection_limit: Maximum number of connections (default: 10, recommended: 10-20)
 * - pool_timeout: Timeout for getting connection from pool in seconds (default: 10)
 * - connect_timeout: Timeout for establishing connection in seconds (default: 5)
 * 
 * Example DATABASE_URL:
 * postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20&connect_timeout=10
 * 
 * For production, recommended settings:
 * - connection_limit: 10-20 (adjust based on load)
 * - pool_timeout: 20 seconds
 * - connect_timeout: 10 seconds
 * 
 * @see {@link https://www.prisma.io/docs/concepts/components/prisma-client/connection-management|Prisma Connection Management}
 */
const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
    // Connection pooling is handled automatically by Prisma via DATABASE_URL
    // No additional configuration needed here
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
module.exports.default = prisma;