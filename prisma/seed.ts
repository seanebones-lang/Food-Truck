import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@foodtruck.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@foodtruck.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      notificationSettings: {
        create: {
          orderUpdates: true,
          orderReady: true,
          promotions: true,
          truckNearby: true,
        },
      },
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create customer user
  const customerPasswordHash = await bcrypt.hash('customer123', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@foodtruck.com' },
    update: {},
    create: {
      name: 'Test Customer',
      email: 'customer@foodtruck.com',
      passwordHash: customerPasswordHash,
      role: 'customer',
      notificationSettings: {
        create: {
          orderUpdates: true,
          orderReady: true,
          promotions: true,
          truckNearby: true,
        },
      },
    },
  });
  console.log('✅ Created customer user:', customer.email);

  // Create menu items
  const menuItems = [
    {
      name: 'Classic Burger',
      description: 'Juicy beef patty with fresh vegetables',
      price: 12.99,
      category: 'Burgers',
      imageUrl: '',
      stock: 20,
      isAvailable: true,
      tags: ['popular', 'beef'],
    },
    {
      name: 'French Fries',
      description: 'Crispy golden fries',
      price: 4.99,
      category: 'Sides',
      imageUrl: '',
      stock: 50,
      isAvailable: true,
      tags: ['vegetarian'],
    },
    {
      name: 'Cola',
      description: 'Refreshing cola drink',
      price: 2.99,
      category: 'Drinks',
      imageUrl: '',
      stock: 100,
      isAvailable: true,
      tags: ['cold'],
    },
    {
      name: 'Chicken Taco',
      description: 'Grilled chicken with fresh salsa',
      price: 8.99,
      category: 'Tacos',
      imageUrl: '',
      stock: 30,
      isAvailable: true,
      tags: ['popular', 'chicken'],
    },
    {
      name: 'Ice Cream',
      description: 'Vanilla ice cream',
      price: 5.99,
      category: 'Desserts',
      imageUrl: '',
      stock: 25,
      isAvailable: true,
      tags: ['cold', 'dessert'],
    },
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name },
    });
    
    if (!existing) {
      const menuItem = await prisma.menuItem.create({
        data: item,
      });
      console.log(`✅ Created menu item: ${menuItem.name}`);
    } else {
      console.log(`⏭️  Menu item already exists: ${item.name}`);
    }
  }

  // Create trucks
  const trucks = [
    {
      name: 'Food Truck #1',
      driverName: 'John Doe',
      latitude: 37.7749,
      longitude: -122.4194,
      heading: 90,
      speed: 0,
      isActive: true,
      estimatedWaitTime: 5,
      schedule: {
        startTime: '09:00',
        endTime: '17:00',
        location: { latitude: 37.7749, longitude: -122.4194 },
        address: '123 Market St, San Francisco, CA',
      },
    },
    {
      name: 'Food Truck #2',
      driverName: 'Jane Smith',
      latitude: 37.7849,
      longitude: -122.4094,
      heading: 180,
      speed: 5,
      isActive: true,
      estimatedWaitTime: 10,
      schedule: {
        startTime: '10:00',
        endTime: '18:00',
        location: { latitude: 37.7849, longitude: -122.4094 },
        address: '456 Mission St, San Francisco, CA',
      },
    },
  ];

  for (const truck of trucks) {
    const existing = await prisma.truck.findFirst({
      where: { name: truck.name },
    });
    
    if (!existing) {
      const createdTruck = await prisma.truck.create({
        data: truck,
      });
      console.log(`✅ Created truck: ${createdTruck.name}`);
    } else {
      console.log(`⏭️  Truck already exists: ${truck.name}`);
    }
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });