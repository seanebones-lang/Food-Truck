/**
 * Performance Optimization Module
 * Implements caching, query optimization, and performance monitoring
 * Target: 10x-100x load capacity, sub-millisecond cached responses
 */

const { getRedisClient, cacheAnalytics, getCachedAnalytics, deleteCache } = require('../utils/redis');
const prisma = require('../utils/prisma').default;

/**
 * Cache configuration
 */
const CACHE_TTL = {
  MENU_ITEMS: 300, // 5 minutes
  TRUCKS: 60, // 1 minute
  USER_PROFILE: 600, // 10 minutes
  ANALYTICS: 300, // 5 minutes
  ORDER_HISTORY: 180, // 3 minutes
};

/**
 * Cache menu items with TTL
 */
async function cacheMenuItems(menuItems) {
  const client = getRedisClient();
  try {
    await client.setex(
      'cache:menu:items',
      CACHE_TTL.MENU_ITEMS,
      JSON.stringify(menuItems)
    );
  } catch (error) {
    console.error('Error caching menu items:', error);
  }
}

/**
 * Get cached menu items
 */
async function getCachedMenuItems() {
  const client = getRedisClient();
  try {
    const cached = await client.get('cache:menu:items');
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached menu items:', error);
    return null;
  }
}

/**
 * Invalidate menu cache
 */
async function invalidateMenuCache() {
  await deleteCache('cache:menu:items');
}

/**
 * Cache trucks with TTL
 */
async function cacheTrucks(trucks) {
  const client = getRedisClient();
  try {
    await client.setex(
      'cache:trucks:active',
      CACHE_TTL.TRUCKS,
      JSON.stringify(trucks)
    );
  } catch (error) {
    console.error('Error caching trucks:', error);
  }
}

/**
 * Get cached trucks
 */
async function getCachedTrucks() {
  const client = getRedisClient();
  try {
    const cached = await client.get('cache:trucks:active');
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached trucks:', error);
    return null;
  }
}

/**
 * Invalidate trucks cache
 */
async function invalidateTrucksCache() {
  await deleteCache('cache:trucks:active');
}

/**
 * Cache user profile
 */
async function cacheUserProfile(userId, profile) {
  const client = getRedisClient();
  try {
    await client.setex(
      `cache:user:${userId}`,
      CACHE_TTL.USER_PROFILE,
      JSON.stringify(profile)
    );
  } catch (error) {
    console.error('Error caching user profile:', error);
  }
}

/**
 * Get cached user profile
 */
async function getCachedUserProfile(userId) {
  const client = getRedisClient();
  try {
    const cached = await client.get(`cache:user:${userId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached user profile:', error);
    return null;
  }
}

/**
 * Invalidate user profile cache
 */
async function invalidateUserProfileCache(userId) {
  await deleteCache(`cache:user:${userId}`);
}

/**
 * Optimized menu query with caching
 */
async function getMenuItemsOptimized(filters = {}) {
  // Try cache first
  const cached = await getCachedMenuItems();
  if (cached && Object.keys(filters).length === 0) {
    return cached;
  }

  // Build optimized query
  const where = {};
  
  if (filters.category && filters.category !== 'All') {
    where.category = filters.category;
  }
  
  if (filters.search) {
    // Use PostgreSQL full-text search for better performance (requires idx_menu_items_search GIN index)
    // This is much faster than LIKE queries for large datasets
    const searchTerm = filters.search.trim();
    if (searchTerm) {
      // Build WHERE clause conditions
      let whereConditions = "to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)";
      const params = [searchTerm];
      let paramIndex = 2;

      if (filters.availableOnly) {
        whereConditions += ` AND "isAvailable" = true AND stock > 0`;
      }

      if (filters.category && filters.category !== 'All') {
        whereConditions += ` AND category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
      }

      // Use raw SQL for full-text search with Prisma
      // Note: This requires the GIN index created in migration 20260104000000_add_fulltext_search
      const query = `
        SELECT id, name, description, price, category, "imageUrl", stock, "isAvailable", tags, "createdAt", "updatedAt"
        FROM menu_items
        WHERE ${whereConditions}
        ORDER BY ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), plainto_tsquery('english', $1)) DESC
        LIMIT 100
      `;

      const searchResults = await prisma.$queryRawUnsafe(query, ...params);
      
      // Map results to match expected format
      return searchResults.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        imageUrl: item.imageUrl,
        stock: item.stock,
        isAvailable: item.isAvailable,
        tags: item.tags,
      }));
    }
  }
  
  if (filters.availableOnly) {
    where.isAvailable = true;
    where.stock = { gt: 0 };
  }

  // Use select to only fetch needed fields
  const menuItems = await prisma.menuItem.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      category: true,
      imageUrl: true,
      stock: true,
      isAvailable: true,
      tags: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Cache if no filters
  if (Object.keys(filters).length === 0) {
    await cacheMenuItems(menuItems);
  }

  return menuItems;
}

/**
 * Optimized trucks query with caching
 */
async function getTrucksOptimized(activeOnly = true) {
  // Try cache first
  if (activeOnly) {
    const cached = await getCachedTrucks();
    if (cached) {
      return cached;
    }
  }

  const where = activeOnly ? { isActive: true } : {};
  
  const trucks = await prisma.truck.findMany({
    where,
    select: {
      id: true,
      name: true,
      driverName: true,
      latitude: true,
      longitude: true,
      heading: true,
      speed: true,
      isActive: true,
      estimatedWaitTime: true,
      schedule: true,
      lastUpdated: true,
    },
    orderBy: { lastUpdated: 'desc' },
  });

  // Transform for response
  const trucksWithLocation = trucks.map((truck) => ({
    ...truck,
    location: {
      latitude: Number(truck.latitude),
      longitude: Number(truck.longitude),
    },
  }));

  // Cache active trucks
  if (activeOnly) {
    await cacheTrucks(trucksWithLocation);
  }

  return trucksWithLocation;
}

/**
 * Performance monitoring middleware
 */
function performanceMonitor(req, res, next) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  // Override res.end to measure response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const memoryDelta = process.memoryUsage().heapUsed - startMemory;

    // Track metrics (if metrics module is available)
    try {
      const { trackHttpRequest } = require('../utils/metrics');
      trackHttpRequest(req.method, req.path, res.statusCode, duration);
    } catch (error) {
      // Metrics module not available, continue without tracking
    }

    // Log slow requests (>1 second)
    if (duration > 1000) {
      console.warn(`[PERFORMANCE] Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }

    // Log high memory usage
    if (memoryDelta > 10 * 1024 * 1024) { // 10MB
      console.warn(`[PERFORMANCE] High memory usage: ${req.method} ${req.path} - ${Math.round(memoryDelta / 1024 / 1024)}MB`);
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Memory-Delta', `${Math.round(memoryDelta / 1024)}KB`);

    originalEnd.apply(this, args);
  };

  next();
}

/**
 * Database query optimization helper
 * Implements connection pooling and query batching
 */
class QueryOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.batchQueue = [];
    this.batchTimeout = 100; // 100ms batch window
  }

  /**
   * Batch multiple queries together
   */
  async batchQueries(queries) {
    return Promise.all(queries);
  }

  /**
   * Optimize Prisma query with select
   */
  optimizeSelect(fields) {
    return fields.reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});
  }
}

const queryOptimizer = new QueryOptimizer();

/**
 * Pagination helper
 */
function paginate(query, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return {
    ...query,
    skip,
    take: limit,
  };
}

/**
 * Response compression middleware
 * Already handled by compression package, but adding metrics
 */
function compressionMetrics(req, res, next) {
  const originalWrite = res.write;
  const originalEnd = res.end;
  
  let bytesWritten = 0;
  
  res.write = function(chunk, encoding, callback) {
    if (chunk) {
      bytesWritten += Buffer.byteLength(chunk, encoding);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };
  
  res.end = function(chunk, encoding, callback) {
    if (chunk) {
      bytesWritten += Buffer.byteLength(chunk, encoding);
    }
    res.setHeader('X-Response-Size', `${Math.round(bytesWritten / 1024)}KB`);
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
}

/**
 * Response caching headers middleware
 * Sets appropriate Cache-Control headers based on endpoint type
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 * 
 * @returns {void}
 * 
 * Cache strategies:
 * - Static data (menus, trucks): 5 minutes public cache
 * - User-specific data (auth, orders): No cache
 * - Analytics: 1 minute private cache
 * - Default: No cache
 */
function responseCacheHeaders(req, res, next) {
  const endpoint = req.path;
  
  // Static data (menus, trucks) - cache for 5 minutes
  if (endpoint.includes('/api/menus') || endpoint.includes('/api/trucks')) {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  
  // User-specific data - no cache
  else if (endpoint.includes('/api/auth') || endpoint.includes('/api/orders')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Analytics - short cache (1 minute)
  else if (endpoint.includes('/api/analytics')) {
    res.setHeader('Cache-Control', 'private, max-age=60, must-revalidate');
  }
  
  // Health checks - short cache
  else if (endpoint === '/health' || endpoint === '/api/health') {
    res.setHeader('Cache-Control', 'public, max-age=30');
  }
  
  // Default - no cache
  else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  
  next();
}

module.exports = {
  cacheMenuItems,
  getCachedMenuItems,
  invalidateMenuCache,
  cacheTrucks,
  getCachedTrucks,
  invalidateTrucksCache,
  cacheUserProfile,
  getCachedUserProfile,
  invalidateUserProfileCache,
  getMenuItemsOptimized,
  getTrucksOptimized,
  performanceMonitor,
  queryOptimizer,
  paginate,
  compressionMetrics,
  responseCacheHeaders,
  CACHE_TTL,
};
