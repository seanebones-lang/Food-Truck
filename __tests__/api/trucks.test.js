/**
 * Trucks API Tests
 * Tests all truck/location management endpoints
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma').default;

jest.mock('../../utils/prisma', () => ({
  default: {
    truck: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/performance', () => ({
  getTrucksOptimized: jest.fn(),
  invalidateTrucksCache: jest.fn(),
}));

let app;
let adminToken;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = require('../../server');
  
  adminToken = jwt.sign(
    { id: 'admin-1', email: 'admin@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
});

describe('GET /api/trucks/nearby', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return nearby trucks', async () => {
    const { getTrucksOptimized } = require('../../middleware/performance');
    const mockTrucks = [
      {
        id: '1',
        name: 'Truck 1',
        latitude: 37.7749,
        longitude: -122.4194,
        isActive: true,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      },
    ];

    getTrucksOptimized.mockResolvedValue(mockTrucks);

    const response = await request(app)
      .get('/api/trucks/nearby')
      .query({
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 5,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  it('should require latitude and longitude', async () => {
    const response = await request(app)
      .get('/api/trucks/nearby');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /api/trucks', () => {
  it('should return all trucks', async () => {
    const { getTrucksOptimized } = require('../../middleware/performance');
    const mockTrucks = [
      {
        id: '1',
        name: 'Truck 1',
        location: { latitude: 37.7749, longitude: -122.4194 },
      },
    ];

    getTrucksOptimized.mockResolvedValue(mockTrucks);

    const response = await request(app)
      .get('/api/trucks');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });
});

describe('GET /api/trucks/:id', () => {
  it('should return single truck', async () => {
    const truck = {
      id: '1',
      name: 'Truck 1',
      latitude: 37.7749,
      longitude: -122.4194,
      isActive: true,
    };

    prisma.truck.findUnique.mockResolvedValue(truck);

    const response = await request(app)
      .get('/api/trucks/1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('1');
  });

  it('should return 404 for non-existent truck', async () => {
    prisma.truck.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/trucks/999');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/trucks/location', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(true);
  });

  it('should update truck location as admin', async () => {
    const truck = {
      id: '1',
      name: 'Truck 1',
      latitude: 37.7750,
      longitude: -122.4195,
      isActive: true,
    };

    prisma.truck.upsert.mockResolvedValue(truck);

    const response = await request(app)
      .post('/api/trucks/location')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        truckId: '1',
        location: {
          latitude: 37.7750,
          longitude: -122.4195,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.location).toBeDefined();
  });

  it('should validate coordinates', async () => {
    const response = await request(app)
      .post('/api/trucks/location')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        truckId: '1',
        location: {
          latitude: 100, // Invalid (>90)
          longitude: -122.4195,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should reject non-admin users', async () => {
    jest.spyOn(require('../../server'), 'isAdmin').mockResolvedValue(false);

    const response = await request(app)
      .post('/api/trucks/location')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        truckId: '1',
        location: {
          latitude: 37.7750,
          longitude: -122.4195,
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
