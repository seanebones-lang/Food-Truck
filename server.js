const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Initialize Sentry for error tracking (must be before app creation in production)
let Sentry;
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry = require('@sentry/node');
  const { nodeProfilingIntegration } = require('@sentry/profiling-node');

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 0.2, // 20% of transactions for performance monitoring
    profilesSampleRate: 0.1, // 10% of transactions for profiling
    beforeSend(event, hint) {
      // Filter sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['Authorization'];
        }
      }
      return event;
    },
  });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

// Sentry request handler (must be first middleware)
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory stores (replace with database in production)
const users = [];
const menus = [];
const trucks = [];
const orders = [];
const pushTokens = new Map(); // userId -> { pushToken, platform }
const notificationRateLimits = new Map(); // token -> lastNotificationTime

// Analytics cache
const analyticsCache = {
  data: null,
  timestamp: null,
  TTL: 5 * 60 * 1000, // 5 minutes
};

// Helper function to check if user is admin (in production, check user role)
const isAdmin = (req) => {
  // For now, all authenticated users are admins
  // In production, check req.user.role === 'admin'
  return !!req.user;
};

// Notification rate limit constant
const NOTIFICATION_RATE_LIMIT_MS = 5000; // 5 seconds

// Helper function to check rate limits
function checkRateLimit(token) {
  const lastTime = notificationRateLimits.get(token);
  const now = Date.now();
  
  if (lastTime && now - lastTime < NOTIFICATION_RATE_LIMIT_MS) {
    return false;
  }
  
  notificationRateLimits.set(token, now);
  return true;
}

// Helper functions
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

// Validation middleware
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters',
    });
  }

  next();
};

const validateSignup = (req, res, next) => {
  const { name, email, password, confirmPassword } = req.body;
  
  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
    });
  }

  if (name.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Name must be at least 2 characters',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters',
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match',
    });
  }

  next();
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/auth/signup', validateSignup, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      }

      const user = users.find((u) => u.id === decoded.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const newAccessToken = generateAccessToken(user);

      res.json({
        success: true,
        accessToken: newAccessToken,
      });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  try {
    const user = users.find((u) => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = users.find((u) => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Validate input
    if (name && name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters',
      });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email address',
        });
      }

      // Check if email is already taken by another user
      const existingUser = users.find((u) => u.email === email && u.id !== user.id);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use',
        });
      }
    }

    // Update user
    if (name) user.name = name;
    if (email) user.email = email;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Menu routes
// GET /api/menus - Get all menu items (with optional filters)
app.get('/api/menus', (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, availableOnly } = req.query;
    
    let filteredMenus = [...menus];

    // Filter by category
    if (category && category !== 'All') {
      filteredMenus = filteredMenus.filter((item) => item.category === category);
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMenus = filteredMenus.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by price range
    if (minPrice) {
      filteredMenus = filteredMenus.filter((item) => item.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filteredMenus = filteredMenus.filter((item) => item.price <= parseFloat(maxPrice));
    }

    // Filter by availability
    if (availableOnly === 'true') {
      filteredMenus = filteredMenus.filter((item) => item.isAvailable && item.stock > 0);
    }

    res.json({
      success: true,
      data: filteredMenus,
      count: filteredMenus.length,
    });
  } catch (error) {
    console.error('Get menus error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/menus/:id - Get single menu item
app.get('/api/menus/:id', (req, res) => {
  try {
    const menuItem = menus.find((item) => item.id === req.params.id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    res.json({
      success: true,
      data: menuItem,
    });
  } catch (error) {
    console.error('Get menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/menus - Create menu item (admin only)
app.post('/api/menus', authenticateToken, (req, res) => {
  try {
    const { name, description, price, category, imageUrl, stock, isAvailable, tags } = req.body;

    // Validation
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, price, and category are required',
      });
    }

    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be positive',
      });
    }

    const newMenuItem = {
      id: Date.now().toString(),
      name,
      description,
      price: parseFloat(price),
      category,
      imageUrl: imageUrl || '',
      stock: stock ? parseInt(stock) : 0,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      tags: tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    menus.push(newMenuItem);

    // Broadcast update via Socket.io
    io.emit('menu:created', newMenuItem);
    io.emit('menu:updated', { menus });

    res.json({
      success: true,
      message: 'Menu item created successfully',
      data: newMenuItem,
    });
  } catch (error) {
    console.error('Create menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT /api/menus/:id - Update menu item (admin only)
app.put('/api/menus/:id', authenticateToken, (req, res) => {
  try {
    const menuIndex = menus.findIndex((item) => item.id === req.params.id);
    if (menuIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    const { name, description, price, category, imageUrl, stock, isAvailable, tags } = req.body;

    // Update fields
    if (name) menus[menuIndex].name = name;
    if (description) menus[menuIndex].description = description;
    if (price !== undefined) menus[menuIndex].price = parseFloat(price);
    if (category) menus[menuIndex].category = category;
    if (imageUrl !== undefined) menus[menuIndex].imageUrl = imageUrl;
    if (stock !== undefined) menus[menuIndex].stock = parseInt(stock);
    if (isAvailable !== undefined) menus[menuIndex].isAvailable = isAvailable;
    if (tags) menus[menuIndex].tags = tags;

    menus[menuIndex].updatedAt = new Date().toISOString();

    // Broadcast update via Socket.io
    io.emit('menu:updated', { menuItem: menus[menuIndex], menus });
    io.emit('stock:update', {
      menuId: menus[menuIndex].id,
      stock: menus[menuIndex].stock,
      isAvailable: menus[menuIndex].isAvailable,
    });

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: menus[menuIndex],
    });
  } catch (error) {
    console.error('Update menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// DELETE /api/menus/:id - Delete menu item (admin only)
app.delete('/api/menus/:id', authenticateToken, (req, res) => {
  try {
    const menuIndex = menus.findIndex((item) => item.id === req.params.id);
    if (menuIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    const deletedItem = menus.splice(menuIndex, 1)[0];

    // Broadcast update via Socket.io
    io.emit('menu:deleted', { id: req.params.id });
    io.emit('menu:updated', { menus });

    res.json({
      success: true,
      message: 'Menu item deleted successfully',
      data: deletedItem,
    });
  } catch (error) {
    console.error('Delete menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Truck routes
// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// GET /api/trucks/nearby - Get nearby trucks
app.get('/api/trucks/nearby', (req, res) => {
  try {
    const { latitude, longitude, radius = 5, limit = 20 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const searchRadius = parseFloat(radius);
    const resultLimit = parseInt(limit);

    // Filter active trucks and calculate distances
    const nearbyTrucks = trucks
      .filter((truck) => truck.isActive)
      .map((truck) => {
        const distance = calculateDistance(
          userLat,
          userLon,
          truck.location.latitude,
          truck.location.longitude
        );
        return { ...truck, distance };
      })
      .filter((truck) => truck.distance <= searchRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, resultLimit);

    res.json({
      success: true,
      data: nearbyTrucks,
      count: nearbyTrucks.length,
    });
  } catch (error) {
    console.error('Get nearby trucks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/trucks - Get all trucks
app.get('/api/trucks', (req, res) => {
  try {
    res.json({
      success: true,
      data: trucks,
      count: trucks.length,
    });
  } catch (error) {
    console.error('Get trucks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/trucks/:id - Get single truck
app.get('/api/trucks/:id', (req, res) => {
  try {
    const truck = trucks.find((t) => t.id === req.params.id);
    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found',
      });
    }

    res.json({
      success: true,
      data: truck,
    });
  } catch (error) {
    console.error('Get truck error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/trucks/location - Update truck location (admin)
app.post('/api/trucks/location', authenticateToken, (req, res) => {
  try {
    const { truckId, location, heading, speed } = req.body;

    if (!truckId || !location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Truck ID and location (latitude, longitude) are required',
      });
    }

    // Validate coordinates
    if (
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates',
      });
    }

    let truck = trucks.find((t) => t.id === truckId);

    if (!truck) {
      // Create new truck if it doesn't exist
      truck = {
        id: truckId,
        name: `Truck ${truckId}`,
        location,
        heading: heading || 0,
        speed: speed || 0,
        isActive: true,
        lastUpdated: new Date().toISOString(),
      };
      trucks.push(truck);
    } else {
      // Update existing truck
      truck.location = location;
      if (heading !== undefined) truck.heading = heading;
      if (speed !== undefined) truck.speed = speed;
      truck.lastUpdated = new Date().toISOString();
    }

    // Broadcast update via Socket.io
    io.emit('truck:location:updated', truck);
    io.emit('trucks:updated', { trucks });

    res.json({
      success: true,
      message: 'Truck location updated successfully',
      data: truck,
    });
  } catch (error) {
    console.error('Update truck location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT /api/trucks/:id - Update truck details (admin)
app.put('/api/trucks/:id', authenticateToken, (req, res) => {
  try {
    const truckIndex = trucks.findIndex((t) => t.id === req.params.id);
    if (truckIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found',
      });
    }

    const { name, driverName, isActive, schedule, estimatedWaitTime } = req.body;

    if (name) trucks[truckIndex].name = name;
    if (driverName !== undefined) trucks[truckIndex].driverName = driverName;
    if (isActive !== undefined) trucks[truckIndex].isActive = isActive;
    if (schedule) trucks[truckIndex].schedule = schedule;
    if (estimatedWaitTime !== undefined)
      trucks[truckIndex].estimatedWaitTime = estimatedWaitTime;

    trucks[truckIndex].lastUpdated = new Date().toISOString();

    // Broadcast update via Socket.io
    io.emit('truck:updated', trucks[truckIndex]);
    io.emit('trucks:updated', { trucks });

    res.json({
      success: true,
      message: 'Truck updated successfully',
      data: trucks[truckIndex],
    });
  } catch (error) {
    console.error('Update truck error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Send current menus to newly connected client
  socket.emit('menu:updated', { menus });
  // Send current trucks to newly connected client
  socket.emit('trucks:updated', { trucks });
  // Send current orders to newly connected client (for admin)
  socket.emit('orders:updated', { orders });
});

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};

// Analytics routes (admin only)
// GET /api/analytics/dashboard - Get dashboard metrics
app.get('/api/analytics/dashboard', authenticateToken, requireAdmin, (req, res) => {
  try {
    const now = Date.now();
    
    // Check cache
    if (
      analyticsCache.data &&
      analyticsCache.timestamp &&
      now - analyticsCache.timestamp < analyticsCache.TTL
    ) {
      return res.json({
        success: true,
        data: analyticsCache.data,
        cached: true,
      });
    }

    // Calculate metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Orders by status
    const ordersByStatus = {
      pending: orders.filter((o) => o.status === 'pending').length,
      confirmed: orders.filter((o) => o.status === 'confirmed').length,
      preparing: orders.filter((o) => o.status === 'preparing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };

    // Revenue by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const revenueByDay = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      revenueByDay[dateStr] = 0;
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      if (revenueByDay[orderDate] !== undefined) {
        revenueByDay[orderDate] += order.total;
      }
    });

    // Top selling items
    const itemCounts = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const itemName = item.menuItem.name;
        itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
      });
    });

    const topSellingItems = Object.entries(itemCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Payment status breakdown
    const paymentStatusBreakdown = {
      pending: orders.filter((o) => o.paymentStatus === 'pending').length,
      processing: orders.filter((o) => o.paymentStatus === 'processing').length,
      succeeded: orders.filter((o) => o.paymentStatus === 'succeeded').length,
      failed: orders.filter((o) => o.paymentStatus === 'failed').length,
      refunded: orders.filter((o) => o.paymentStatus === 'refunded').length,
    };

    // Today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(
      (o) => new Date(o.createdAt) >= today
    );
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);

    // Menu availability
    const totalMenuItems = menus.length;
    const availableItems = menus.filter((m) => (m.isActive || m.isAvailable) && m.stock > 0).length;
    const lowStockItems = menus.filter((m) => m.stock > 0 && m.stock < 10).length;

    const analytics = {
      overview: {
        totalOrders,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        todayOrders: todayOrders.length,
        todayRevenue: parseFloat(todayRevenue.toFixed(2)),
      },
      ordersByStatus,
      revenueByDay,
      topSellingItems,
      paymentStatusBreakdown,
      inventory: {
        totalMenuItems,
        availableItems,
        lowStockItems,
      },
    };

    // Update cache
    analyticsCache.data = analytics;
    analyticsCache.timestamp = now;

    res.json({
      success: true,
      data: analytics,
      cached: false,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/analytics/export - Export orders to CSV
app.get('/api/analytics/export', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;

    let filteredOrders = [...orders];

    // Filter by date range if provided
    if (startDate || endDate) {
      filteredOrders = filteredOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        if (startDate && orderDate < new Date(startDate)) return false;
        if (endDate && orderDate > new Date(endDate)) return false;
        return true;
      });
    }

    if (format === 'csv') {
      // Format for CSV export
      const csvRows = [];
      
      // Header
      csvRows.push([
        'Order ID',
        'User ID',
        'Status',
        'Payment Status',
        'Subtotal',
        'Tax',
        'Total',
        'Items Count',
        'Created At',
        'Updated At',
      ].join(','));

      // Data rows
      filteredOrders.forEach((order) => {
        csvRows.push([
          order.id,
          order.userId || '',
          order.status,
          order.paymentStatus,
          order.subtotal,
          order.tax,
          order.total,
          order.items.reduce((sum, item) => sum + item.quantity, 0),
          order.createdAt,
          order.updatedAt,
        ].join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=orders_${Date.now()}.csv`);
      res.send(csvRows.join('\n'));
    } else {
      res.json({
        success: true,
        data: filteredOrders,
        count: filteredOrders.length,
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/analytics/orders - Get orders with filters for analytics
app.get('/api/analytics/orders', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { status, paymentStatus, startDate, endDate, limit = 100 } = req.query;

    let filteredOrders = [...orders];

    // Apply filters
    if (status) {
      filteredOrders = filteredOrders.filter((o) => o.status === status);
    }

    if (paymentStatus) {
      filteredOrders = filteredOrders.filter((o) => o.paymentStatus === paymentStatus);
    }

    if (startDate || endDate) {
      filteredOrders = filteredOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        if (startDate && orderDate < new Date(startDate)) return false;
        if (endDate && orderDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply limit
    const limitedOrders = filteredOrders.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: limitedOrders,
      count: limitedOrders.length,
      total: filteredOrders.length,
    });
  } catch (error) {
    console.error('Get analytics orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Order routes
const TAX_RATE = 0.08; // 8% tax

// POST /api/orders - Create new order
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { items, deliveryAddress, pickupLocation, contactPhone, specialInstructions, paymentIntentId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item',
      });
    }

    // Validate items and check stock
    const validatedItems = [];
    let subtotal = 0;

    for (const orderItem of items) {
      const menuItem = menus.find((item) => item.id === orderItem.menuItemId);
      
      if (!menuItem) {
        return res.status(400).json({
          success: false,
          message: `Menu item ${orderItem.menuItemId} not found`,
        });
      }

      if (!menuItem.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `${menuItem.name} is not available`,
        });
      }

      if (menuItem.stock < orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${menuItem.name}. Available: ${menuItem.stock}, Requested: ${orderItem.quantity}`,
        });
      }

      // Calculate item price with customizations
      let itemPrice = menuItem.price;
      if (orderItem.customizations) {
        const customizationTotal = orderItem.customizations.reduce(
          (sum, custom) => sum + (custom.priceModifier || 0),
          0
        );
        itemPrice += customizationTotal;
      }

      validatedItems.push({
        menuItemId: menuItem.id,
        menuItem: {
          id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
        },
        quantity: orderItem.quantity,
        price: itemPrice,
        customizations: orderItem.customizations || [],
        specialInstructions: orderItem.specialInstructions,
      });

      subtotal += itemPrice * orderItem.quantity;

      // Update stock
      menuItem.stock -= orderItem.quantity;
    }

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const order = {
      id: `ORD-${Date.now()}`,
      userId: req.user.id,
      items: validatedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      status: 'pending',
      deliveryAddress,
      pickupLocation,
      contactPhone,
      specialInstructions,
      paymentIntentId,
      paymentStatus: paymentIntentId ? 'processing' : 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orders.push(order);

    // Broadcast order creation via Socket.io
    io.emit('order:created', order);
    io.emit('orders:updated', { orders });
    io.emit('menu:updated', { menus }); // Stock updated

    // Send notification to user if token is registered
    const userToken = pushTokens.get(order.userId);
    if (userToken && checkRateLimit(userToken.pushToken)) {
      // In production, send via Expo Push API
      io.emit('notification:user', {
        userId: order.userId,
        title: 'Order Confirmed!',
        body: `Your order ${order.id} has been confirmed`,
        data: { type: 'order_created', orderId: order.id },
      });
    }

    res.json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/orders - Get orders (user's orders or all for admin)
app.get('/api/orders', authenticateToken, (req, res) => {
  try {
    const userOrders = orders.filter((order) => order.userId === req.user.id);
    res.json({
      success: true,
      data: userOrders,
      count: userOrders.length,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/orders/all - Get all orders (admin only)
app.get('/api/orders/all', authenticateToken, (req, res) => {
  try {
    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/orders/:id - Get single order
app.get('/api/orders/:id', authenticateToken, (req, res) => {
  try {
    const order = orders.find((o) => o.id === req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Users can only see their own orders
    if (order.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT /api/orders/:id/status - Update order status (admin only)
app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const orderIndex = orders.findIndex((o) => o.id === req.params.id);
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    orders[orderIndex].status = status;
    orders[orderIndex].updatedAt = new Date().toISOString();

    // Broadcast update via Socket.io
    io.emit('order:status:updated', orders[orderIndex]);
    io.emit('orders:updated', { orders });

    // Send notification to user
    const order = orders[orderIndex];
    const userToken = pushTokens.get(order.userId);
    if (userToken && checkRateLimit(userToken.pushToken)) {
      let title = 'Order Update';
      let body = `Your order ${order.id} status: ${status}`;

      if (status === 'ready') {
        title = 'Order Ready! 🎉';
        body = `Your order ${order.id} is ready for pickup!`;
      }

      io.emit('notification:user', {
        userId: order.userId,
        title,
        body,
        data: { type: 'order_status', orderId: order.id, status },
      });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: orders[orderIndex],
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/payments/create-intent - Create Stripe payment intent
app.post('/api/payments/create-intent', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required',
      });
    }

    // In production, integrate with Stripe API
    // For now, return a mock payment intent
    const paymentIntentId = `pi_mock_${Date.now()}`;

    res.json({
      success: true,
      data: {
        clientSecret: `mock_client_secret_${paymentIntentId}`,
        paymentIntentId,
        amount: Math.round(amount * 100), // Convert to cents
        currency,
      },
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/payments/webhook - Stripe webhook handler
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    // In production, verify Stripe signature
    const event = req.body;
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const order = orders.find((o) => o.paymentIntentId === paymentIntent.id);
      
      if (order) {
        order.paymentStatus = 'succeeded';
        order.status = 'confirmed';
        order.updatedAt = new Date().toISOString();

        // Broadcast update
        io.emit('order:payment:succeeded', order);
        io.emit('orders:updated', { orders });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      message: 'Webhook error',
    });
  }
});

// Notification routes
// POST /api/notifications/register - Register push token
app.post('/api/notifications/register', authenticateToken, (req, res) => {
  try {
    const { pushToken, platform } = req.body;
    const userId = req.user.id;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required',
      });
    }

    pushTokens.set(userId, { pushToken, platform, registeredAt: new Date().toISOString() });

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/notifications/send-promo - Send promotional notification (admin)
app.post('/api/notifications/send-promo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, promoId, targetAudience = 'all' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required',
      });
    }

    // Broadcast via Socket.io
    io.emit('promo:alert', {
      title,
      message,
      promoId,
      timestamp: new Date().toISOString(),
    });

    // In production, use Expo Push Notification API or FCM
    // For now, Socket.io handles real-time delivery

    res.json({
      success: true,
      message: 'Promotional notification sent',
      sentTo: pushTokens.size,
    });
  } catch (error) {
    console.error('Send promo notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/notifications/team-coordination - Send team coordination message (admin)
app.post('/api/notifications/team-coordination', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { message, priority = 'normal', targetRole = 'all' } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Broadcast to admin clients via Socket.io
    io.emit('team:coordination', {
      message,
      priority,
      targetRole,
      from: req.user.email,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Team coordination message sent',
    });
  } catch (error) {
    console.error('Team coordination error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Initialize with sample trucks
trucks.push(
  {
    id: '1',
    name: 'Food Truck #1',
    driverName: 'John Doe',
    location: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
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
    lastUpdated: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Food Truck #2',
    driverName: 'Jane Smith',
    location: { latitude: 37.7849, longitude: -122.4094 },
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
    lastUpdated: new Date().toISOString(),
  }
);

// Initialize with sample menu items
menus.push(
  {
    id: '1',
    name: 'Classic Burger',
    description: 'Juicy beef patty with fresh vegetables',
    price: 12.99,
    category: 'Burgers',
    imageUrl: '',
    stock: 20,
    isAvailable: true,
    tags: ['popular', 'beef'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'French Fries',
    description: 'Crispy golden fries',
    price: 4.99,
    category: 'Sides',
    imageUrl: '',
    stock: 50,
    isAvailable: true,
    tags: ['vegetarian'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Cola',
    description: 'Refreshing cola drink',
    price: 2.99,
    category: 'Drinks',
    imageUrl: '',
    stock: 100,
    isAvailable: true,
    tags: ['cold'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
);

// Error handler must be before other error handlers and after all controllers
if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}

// Optional fallthrough error handler
app.use((err, req, res, next) => {
  if (Sentry) {
    Sentry.captureException(err);
  }
  console.error('Unhandled error:', err);
  res.statusCode = 500;
  res.json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message }),
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io server initialized`);
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    console.log(`Sentry error tracking enabled`);
  }
});
