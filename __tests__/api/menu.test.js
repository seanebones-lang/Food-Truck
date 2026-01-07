/**
 * Menu API Tests
 * Tests all menu management endpoints
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma').default;

jest.mock('../../utils/prisma', () => ({
  default: {
    menuItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../utils/redis', () => ({
  getRedisClient: jest.fn(() => ({
    del: jest.fn().mockResolvedValue(1),
  })),
}));

jest.mock('../../middleware/performance', () => ({
  getMenuItemsOptimized: jest.fn(),
  invalidateMenuCache: jest.fn(),
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

describe('GET /api/menus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all menu items', async () => {
    const { getMenuItemsOptimized } = require('../../middleware/performance');
    const mockMenus = [
      { id: '1', name: 'Burger', price: 10.99, category: 'Burgers' },
      { id: '2', name: 'Fries', price: 4.99, category: 'Sides' },
    ];

    getMenuItemsOptimized.mockResolvedValue(mockMenus);

    const response = await request(app)
      .get('/api/menus');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
  });

  it('should filter by category', async () => {
    const { getMenuItemsOptimized } = require('../../middleware/performance');
    const mockMenus = [
      { id: '1', name: 'Burger', price: 10.99, category: 'Burgers' },
    ];

    getMenuItemsOptimized.mockResolvedValue(mockMenus);

    const response = await request(app)
      .get('/api/menus?category=Burgers');

    expect(response.status).toBe(200);
    expect(getMenuItemsOptimized).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Burgers' })
    );
  });

  it('should filter by search term', async () => {
    const { getMenuItemsOptimized } = require('../../middleware/performance');
    getMenuItemsOptimized.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/menus?search=burger');

    expect(response.status).toBe(200);
    expect(getMenuItemsOptimized).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'burger' })
    );
  });
});

describe('GET /api/menus/:id', () => {
  it('should return single menu item', async () => {
    const menuItem = {
      id: '1',
      name: 'Burger',
      description: 'Delicious burger',
      price: 10.99,
      category: 'Burgers',
      stock: 50,
      isAvailable: true,
    };

    prisma.menuItem.findUnique.mockResolvedValue(menuItem);

    const response = await request(app)
      .get('/api/menus/1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('1');
  });

  it('should return 404 for non-existent menu item', async () => {
    prisma.menuItem.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/menus/999');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/menus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock admin check
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should create menu item as admin', async () => {
    const newMenuItem = {
      id: '1',
      name: 'New Burger',
      description: 'New delicious burger',
      price: 12.99,
      category: 'Burgers',
      stock: 100,
      isAvailable: true,
      tags: [],
      createdAt: new Date(),
    };

    prisma.menuItem.create.mockResolvedValue(newMenuItem);

    const response = await request(app)
      .post('/api/menus')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Burger',
        description: 'New delicious burger',
        price: 12.99,
        category: 'Burgers',
        stock: 100,
        isAvailable: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('New Burger');
  });

  it('should reject non-admin users', async () => {
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(false);

    const response = await request(app)
      .post('/api/menus')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'New Burger',
        price: 12.99,
        category: 'Burgers',
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('should validate required fields', async () => {
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/menus')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Burger',
        // Missing required fields
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should validate price is positive', async () => {
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/menus')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Burger',
        description: 'Test',
        price: -10,
        category: 'Burgers',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('PUT /api/menus/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should update menu item as admin', async () => {
    const updatedItem = {
      id: '1',
      name: 'Updated Burger',
      price: 15.99,
      stock: 75,
      isAvailable: true,
    };

    prisma.menuItem.update.mockResolvedValue(updatedItem);

    const response = await request(app)
      .put('/api/menus/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Burger',
        price: 15.99,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Updated Burger');
  });

  it('should return 404 for non-existent menu item', async () => {
    prisma.menuItem.update.mockRejectedValue({
      code: 'P2025',
    });

    const response = await request(app)
      .put('/api/menus/999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Burger',
      });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/menus/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should delete menu item as admin', async () => {
    const deletedItem = {
      id: '1',
      name: 'Burger',
    };

    prisma.menuItem.delete.mockResolvedValue(deletedItem);

    const response = await request(app)
      .delete('/api/menus/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should return 404 for non-existent menu item', async () => {
    prisma.menuItem.delete.mockRejectedValue({
      code: 'P2025',
    });

    const response = await request(app)
      .delete('/api/menus/999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
  });
});
