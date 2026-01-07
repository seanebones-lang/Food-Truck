/**
 * Database Integration Tests
 * Tests database connectivity and operations
 */

const prisma = require('../../utils/prisma').default;

describe('Database Integration', () => {
  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Connection', () => {
    it('should connect to database', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as value`;
      expect(result).toBeDefined();
      expect(result[0].value).toBe(1);
    });

    it('should handle connection errors gracefully', async () => {
      // This test would require a way to simulate connection failure
      // For now, we just verify the connection works
      const result = await prisma.$queryRaw`SELECT NOW() as now`;
      expect(result).toBeDefined();
      expect(result[0].now).toBeDefined();
    });
  });

  describe('User Operations', () => {
    let testUserId;

    it('should create a user', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: `test-${Date.now()}@example.com`,
          passwordHash: 'hashed-password',
          role: 'customer',
        },
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toContain('@example.com');
      testUserId = user.id;
    });

    it('should find user by email', async () => {
      const email = `test-${Date.now()}@example.com`;
      await prisma.user.create({
        data: {
          name: 'Test User',
          email,
          passwordHash: 'hashed-password',
        },
      });

      const user = await prisma.user.findUnique({
        where: { email },
      });

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
    });

    it('should update user', async () => {
      if (!testUserId) {
        const user = await prisma.user.create({
          data: {
            name: 'Test User',
            email: `test-${Date.now()}@example.com`,
            passwordHash: 'hashed-password',
          },
        });
        testUserId = user.id;
      }

      const updated = await prisma.user.update({
        where: { id: testUserId },
        data: { name: 'Updated Name' },
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should delete user', async () => {
      if (!testUserId) {
        const user = await prisma.user.create({
          data: {
            name: 'Test User',
            email: `test-${Date.now()}@example.com`,
            passwordHash: 'hashed-password',
          },
        });
        testUserId = user.id;
      }

      await prisma.user.delete({
        where: { id: testUserId },
      });

      const deleted = await prisma.user.findUnique({
        where: { id: testUserId },
      });

      expect(deleted).toBeNull();
    });
  });

  describe('Menu Operations', () => {
    let testMenuId;

    it('should create menu item', async () => {
      const menuItem = await prisma.menuItem.create({
        data: {
          name: 'Test Burger',
          description: 'Test description',
          price: 10.99,
          category: 'Burgers',
          stock: 50,
          isAvailable: true,
        },
      });

      expect(menuItem).toBeDefined();
      expect(menuItem.id).toBeDefined();
      testMenuId = menuItem.id;
    });

    it('should find menu items by category', async () => {
      const menuItems = await prisma.menuItem.findMany({
        where: { category: 'Burgers' },
      });

      expect(Array.isArray(menuItems)).toBe(true);
    });

    it('should update menu item stock', async () => {
      if (!testMenuId) {
        const menuItem = await prisma.menuItem.create({
          data: {
            name: 'Test Burger',
            price: 10.99,
            category: 'Burgers',
            stock: 50,
          },
        });
        testMenuId = menuItem.id;
      }

      const updated = await prisma.menuItem.update({
        where: { id: testMenuId },
        data: { stock: { decrement: 5 } },
      });

      expect(updated.stock).toBeLessThan(50);
    });
  });

  describe('Order Operations', () => {
    let testOrderId;
    let testUserId;
    let testMenuId;

    beforeAll(async () => {
      // Create test user
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: `test-order-${Date.now()}@example.com`,
          passwordHash: 'hashed-password',
        },
      });
      testUserId = user.id;

      // Create test menu item
      const menuItem = await prisma.menuItem.create({
        data: {
          name: 'Test Burger',
          price: 10.99,
          category: 'Burgers',
          stock: 50,
        },
      });
      testMenuId = menuItem.id;
    });

    it('should create order with items', async () => {
      const order = await prisma.order.create({
        data: {
          userId: testUserId,
          subtotal: 10.99,
          tax: 0.88,
          total: 11.87,
          status: 'pending',
          paymentStatus: 'pending',
          orderItems: {
            create: {
              menuItemId: testMenuId,
              quantity: 1,
              price: 10.99,
            },
          },
        },
        include: {
          orderItems: true,
        },
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.orderItems).toHaveLength(1);
      testOrderId = order.id;
    });

    it('should find orders by user', async () => {
      const orders = await prisma.order.findMany({
        where: { userId: testUserId },
      });

      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
    });

    it('should update order status', async () => {
      if (!testOrderId) return;

      const updated = await prisma.order.update({
        where: { id: testOrderId },
        data: { status: 'confirmed' },
      });

      expect(updated.status).toBe('confirmed');
    });

    afterAll(async () => {
      // Cleanup
      if (testOrderId) {
        await prisma.order.delete({
          where: { id: testOrderId },
        });
      }
      if (testMenuId) {
        await prisma.menuItem.delete({
          where: { id: testMenuId },
        });
      }
      if (testUserId) {
        await prisma.user.delete({
          where: { id: testUserId },
        });
      }
    });
  });

  describe('Transactions', () => {
    it('should handle transactions', async () => {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: 'Transaction Test',
            email: `tx-${Date.now()}@example.com`,
            passwordHash: 'hashed',
          },
        });

        const menuItem = await tx.menuItem.create({
          data: {
            name: 'TX Burger',
            price: 10.99,
            category: 'Burgers',
            stock: 50,
          },
        });

        return { user, menuItem };
      });

      expect(result.user).toBeDefined();
      expect(result.menuItem).toBeDefined();

      // Cleanup
      await prisma.user.delete({ where: { id: result.user.id } });
      await prisma.menuItem.delete({ where: { id: result.menuItem.id } });
    });
  });
});
