/**
 * Orders API Tests
 * Tests all order management endpoints
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma').default;

jest.mock('../../utils/prisma', () => ({
  default: {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    menuItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pushToken: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../utils/redis', () => ({
  getRedisClient: jest.fn(() => ({
    del: jest.fn().mockResolvedValue(1),
  })),
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));

let app;
let userToken;
let adminToken;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = require('../../server');
  
  userToken = jwt.sign(
    { id: 'user-1', email: 'user@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  adminToken = jwt.sign(
    { id: 'admin-1', email: 'admin@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
});

describe('POST /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create order successfully', async () => {
    const menuItem = {
      id: '1',
      name: 'Burger',
      price: 10.99,
      stock: 50,
      isAvailable: true,
    };

    const order = {
      id: 'order-1',
      userId: 'user-1',
      subtotal: 10.99,
      tax: 0.88,
      total: 11.87,
      status: 'pending',
      paymentStatus: 'pending',
      orderItems: [
        {
          id: 'item-1',
          menuItemId: '1',
          quantity: 1,
          price: 10.99,
          menuItem: menuItem,
        },
      ],
    };

    prisma.menuItem.findUnique.mockResolvedValue(menuItem);
    prisma.menuItem.update.mockResolvedValue({ ...menuItem, stock: 49 });
    prisma.order.create.mockResolvedValue(order);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [
          {
            menuItemId: '1',
            quantity: 1,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('order-1');
  });

  it('should reject order with no items', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should reject order with unavailable item', async () => {
    const menuItem = {
      id: '1',
      name: 'Burger',
      isAvailable: false,
    };

    prisma.menuItem.findUnique.mockResolvedValue(menuItem);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [
          {
            menuItemId: '1',
            quantity: 1,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should reject order with insufficient stock', async () => {
    const menuItem = {
      id: '1',
      name: 'Burger',
      stock: 5,
      isAvailable: true,
    };

    prisma.menuItem.findUnique.mockResolvedValue(menuItem);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [
          {
            menuItemId: '1',
            quantity: 10,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /api/orders', () => {
  it('should return user orders', async () => {
    const orders = [
      {
        id: 'order-1',
        userId: 'user-1',
        status: 'pending',
        orderItems: [],
      },
    ];

    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(false);
    prisma.order.findMany.mockResolvedValue(orders);

    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
  });

  it('should return all orders for admin', async () => {
    const orders = [
      { id: 'order-1', userId: 'user-1', status: 'pending' },
      { id: 'order-2', userId: 'user-2', status: 'completed' },
    ];

    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
    prisma.order.findMany.mockResolvedValue(orders);

    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });
});

describe('PUT /api/orders/:id/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should update order status as admin', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'pending',
      orderItems: [],
    };

    const updatedOrder = {
      ...order,
      status: 'ready',
    };

    prisma.order.findUnique.mockResolvedValue(order);
    prisma.order.update.mockResolvedValue(updatedOrder);
    prisma.pushToken.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/orders/order-1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'ready',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ready');
  });

  it('should reject invalid status', async () => {
    const response = await request(app)
      .put('/api/orders/order-1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'invalid-status',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 for non-existent order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/orders/999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'ready',
      });

    expect(response.status).toBe(404);
  });
});
