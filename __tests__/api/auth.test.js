/**
 * Authentication API Tests
 * Tests all authentication endpoints
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma').default;

// Mock Prisma
jest.mock('../../utils/prisma', () => ({
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Create test app
let app;
beforeAll(() => {
  // Import app after mocks are set up
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  app = require('../../server');
});

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new user successfully', async () => {
    const userData = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'customer',
      createdAt: new Date(),
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(userData);

    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('test@example.com');
    expect(response.body.tokens).toHaveProperty('accessToken');
    expect(response.body.tokens).toHaveProperty('refreshToken');
  });

  it('should reject duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@example.com' });

    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('already exists');
  });

  it('should validate email format', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123',
        confirmPassword: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should validate password length', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: '12345',
        confirmPassword: '12345',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should validate password match', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password456',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should login successfully with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash,
      role: 'customer',
      createdAt: new Date(),
    };

    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('test@example.com');
    expect(response.body.tokens).toHaveProperty('accessToken');
    expect(response.body.tokens).toHaveProperty('refreshToken');
  });

  it('should reject invalid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = {
      id: '1',
      email: 'test@example.com',
      passwordHash,
    };

    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('should reject non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/auth/refresh', () => {
  it('should refresh token successfully', async () => {
    const user = {
      id: '1',
      email: 'test@example.com',
    };

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tokens).toHaveProperty('accessToken');
    expect(response.body.tokens).toHaveProperty('refreshToken');
  });

  it('should reject invalid refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /api/auth/profile', () => {
  it('should return user profile with valid token', async () => {
    const user = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'customer',
      createdAt: new Date(),
    };

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('test@example.com');
  });

  it('should reject request without token', async () => {
    const response = await request(app)
      .get('/api/auth/profile');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('should reject invalid token', async () => {
    const response = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
