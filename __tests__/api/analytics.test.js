/**
 * Analytics API Tests
 * Tests all analytics endpoints (admin only)
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma').default;

jest.mock('../../utils/prisma', () => ({
  default: {
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
    menuItem: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../../utils/redis', () => ({
  getRedisClient: jest.fn(() => ({
    del: jest.fn().mockResolvedValue(1),
  })),
  getCachedAnalytics: jest.fn(),
  cacheAnalytics: jest.fn(),
}));

let app;
let adminToken;
let userToken;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = require('../../server');
  
  adminToken = jwt.sign(
    { id: 'admin-1', email: 'admin@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  userToken = jwt.sign(
    { id: 'user-1', email: 'user@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
});

describe('GET /api/analytics/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should return dashboard analytics for admin', async () => {
    const { getCachedAnalytics } = require('../../utils/redis');
    getCachedAnalytics.mockResolvedValue(null);

    prisma.order.count.mockResolvedValue(100);
    prisma.order.findMany.mockResolvedValue([
      { total: 10.99 },
      { total: 15.99 },
    ]);
    prisma.order.groupBy.mockResolvedValue([
      { status: 'pending', _count: { status: 10 } },
      { status: 'completed', _count: { status: 50 } },
    ]);
    prisma.orderItem.findMany.mockResolvedValue([
      { quantity: 5, menuItem: { name: 'Burger' } },
    ]);
    prisma.menuItem.count.mockResolvedValue(20);
    prisma.menuItem.count.mockResolvedValueOnce(20).mockResolvedValueOnce(15).mockResolvedValueOnce(3);

    const response = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('overview');
    expect(response.body.data).toHaveProperty('ordersByStatus');
    expect(response.body.data).toHaveProperty('revenueByDay');
    expect(response.body.data).toHaveProperty('topSellingItems');
  });

  it('should return cached data when available', async () => {
    const { getCachedAnalytics } = require('../../utils/redis');
    const cachedData = {
      overview: { totalOrders: 100 },
      ordersByStatus: { pending: 10 },
    };

    getCachedAnalytics.mockResolvedValue(cachedData);

    const response = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(true);
    expect(response.body.data).toEqual(cachedData);
  });

  it('should reject non-admin users', async () => {
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(false);

    const response = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /api/analytics/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should export orders as CSV', async () => {
    const orders = [
      {
        id: '1',
        userId: 'user-1',
        status: 'completed',
        paymentStatus: 'succeeded',
        subtotal: 10.99,
        tax: 0.88,
        total: 11.87,
        orderItems: [{ quantity: 1 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prisma.order.findMany.mockResolvedValue(orders);

    const response = await request(app)
      .get('/api/analytics/export')
      .query({ format: 'csv' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Order ID');
  });

  it('should export orders as JSON', async () => {
    const orders = [
      {
        id: '1',
        userId: 'user-1',
        status: 'completed',
        orderItems: [],
      },
    ];

    prisma.order.findMany.mockResolvedValue(orders);

    const response = await request(app)
      .get('/api/analytics/export')
      .query({ format: 'json' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  it('should filter by date range', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/analytics/export')
      .query({
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.any(Object),
        }),
      })
    );
  });
});

describe('GET /api/analytics/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should return filtered orders', async () => {
    const orders = [
      {
        id: '1',
        status: 'completed',
        orderItems: [],
      },
    ];

    prisma.order.findMany.mockResolvedValue(orders);
    prisma.order.count.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/analytics/orders')
      .query({ status: 'completed' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.count).toBe(1);
  });

  it('should filter by payment status', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);

    const response = await request(app)
      .get('/api/analytics/orders')
      .query({ paymentStatus: 'succeeded' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: 'succeeded',
        }),
      })
    );
  });
});
