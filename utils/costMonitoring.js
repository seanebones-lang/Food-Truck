/**
 * Cost Monitoring Service
 * 
 * Tracks and monitors system costs across infrastructure and services.
 * 
 * @module utils/costMonitoring
 * @version 1.0.0
 */

const prisma = require('./prisma').default;

/**
 * Cost categories
 */
const CostCategory = {
  INFRASTRUCTURE: 'infrastructure',
  DATABASE: 'database',
  STORAGE: 'storage',
  NETWORK: 'network',
  COMPUTE: 'compute',
  MONITORING: 'monitoring',
  SECURITY: 'security',
  THIRD_PARTY: 'third_party',
};

/**
 * Record cost entry
 * 
 * @param {Object} costData - Cost data
 * @param {string} costData.category - Cost category
 * @param {string} costData.service - Service name
 * @param {number} costData.amount - Cost amount
 * @param {string} costData.currency - Currency (default: 'USD')
 * @param {Date} costData.date - Cost date (default: today)
 * @param {Object} costData.metadata - Additional metadata
 * 
 * @returns {Promise<Object>} Created cost entry
 */
async function recordCost(costData) {
  const {
    category,
    service,
    amount,
    currency = 'USD',
    date = new Date(),
    metadata = {},
  } = costData;

  if (!category || !service || amount === undefined) {
    throw new Error('Category, service, and amount are required');
  }

  if (!Object.values(CostCategory).includes(category)) {
    throw new Error(`Invalid category. Must be one of: ${Object.values(CostCategory).join(', ')}`);
  }

  if (amount < 0) {
    throw new Error('Amount must be non-negative');
  }

  const cost = await prisma.costEntry.create({
    data: {
      category,
      service,
      amount,
      currency,
      date: new Date(date),
      metadata,
    },
  });

  return cost;
}

/**
 * Get costs with filters
 * 
 * @param {Object} filters - Query filters
 * @param {string} filters.category - Filter by category
 * @param {string} filters.service - Filter by service
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {number} filters.limit - Result limit (default: 100)
 * @param {number} filters.offset - Result offset
 * 
 * @returns {Promise<Object>} Query results
 */
async function getCosts(filters = {}) {
  const {
    category,
    service,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters;

  const where = {};

  if (category) {
    where.category = category;
  }

  if (service) {
    where.service = service;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate);
    }
  }

  const [costs, total] = await Promise.all([
    prisma.costEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      take: Math.min(limit, 1000),
      skip: offset,
    }),
    prisma.costEntry.count({ where }),
  ]);

  return {
    costs,
    total,
    limit,
    offset,
    hasMore: offset + costs.length < total,
  };
}

/**
 * Get cost statistics
 * 
 * @param {Object} filters - Query filters (same as getCosts)
 * @returns {Promise<Object>} Statistics
 */
async function getCostStatistics(filters = {}) {
  const { startDate, endDate } = filters;

  const where = {};

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate);
    }
  }

  const [
    totalCost,
    costsByCategory,
    costsByService,
    dailyCosts,
    monthlyCosts,
  ] = await Promise.all([
    prisma.costEntry.aggregate({
      where,
      _sum: { amount: true },
    }),
    prisma.costEntry.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
    }),
    prisma.costEntry.groupBy({
      by: ['service'],
      where,
      _sum: { amount: true },
    }),
    prisma.costEntry.groupBy({
      by: ['date'],
      where,
      _sum: { amount: true },
      orderBy: { date: 'desc' },
      take: 30, // Last 30 days
    }),
    prisma.costEntry.groupBy({
      by: ['date'],
      where,
      _sum: { amount: true },
      orderBy: { date: 'desc' },
      take: 12, // Last 12 months
    }),
  ]);

  return {
    totalCost: totalCost._sum.amount || 0,
    costsByCategory: costsByCategory.reduce((acc, item) => {
      acc[item.category] = item._sum.amount || 0;
      return acc;
    }, {}),
    costsByService: costsByService.reduce((acc, item) => {
      acc[item.service] = item._sum.amount || 0;
      return acc;
    }, {}),
    dailyCosts: dailyCosts.map(item => ({
      date: item.date,
      amount: item._sum.amount || 0,
    })),
    monthlyCosts: monthlyCosts.map(item => ({
      date: item.date,
      amount: item._sum.amount || 0,
    })),
  };
}

/**
 * Get cost trends
 * 
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} Cost trends
 */
async function getCostTrends(filters = {}) {
  const { startDate, endDate } = filters;

  const where = {};

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate);
    }
  }

  // Get costs grouped by day
  const dailyCosts = await prisma.costEntry.groupBy({
    by: ['date'],
    where,
    _sum: { amount: true },
    orderBy: { date: 'asc' },
  });

  // Calculate trends
  const costs = dailyCosts.map(item => item._sum.amount || 0);
  const average = costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : 0;
  
  // Calculate trend (increasing, decreasing, stable)
  let trend = 'stable';
  if (costs.length >= 2) {
    const recent = costs.slice(-7); // Last 7 days
    const previous = costs.slice(-14, -7); // Previous 7 days
    
    const recentAvg = recent.reduce((sum, cost) => sum + cost, 0) / recent.length;
    const previousAvg = previous.reduce((sum, cost) => sum + cost, 0) / previous.length;
    
    const change = ((recentAvg - previousAvg) / previousAvg) * 100;
    
    if (change > 5) {
      trend = 'increasing';
    } else if (change < -5) {
      trend = 'decreasing';
    }
  }

  return {
    average,
    trend,
    dailyCosts: dailyCosts.map(item => ({
      date: item.date,
      amount: item._sum.amount || 0,
    })),
  };
}

/**
 * Estimate monthly cost
 * 
 * @param {Object} filters - Query filters
 * @returns {Promise<number>} Estimated monthly cost
 */
async function estimateMonthlyCost(filters = {}) {
  const { startDate, endDate } = filters;

  const where = {};

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate);
    }
  } else {
    // Default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.date = { gte: thirtyDaysAgo };
  }

  const result = await prisma.costEntry.aggregate({
    where,
    _sum: { amount: true },
  });

  const totalCost = result._sum.amount || 0;
  
  // Estimate monthly cost based on daily average
  const dailyAverage = totalCost / 30;
  const monthlyEstimate = dailyAverage * 30;

  return monthlyEstimate;
}

module.exports = {
  recordCost,
  getCosts,
  getCostStatistics,
  getCostTrends,
  estimateMonthlyCost,
  CostCategory,
};
