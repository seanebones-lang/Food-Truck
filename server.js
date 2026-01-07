const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
// Socket.io Redis adapter setup (will be initialized after Redis connection)
let createAdapter;
try {
  const { createAdapter: adapter } = require('@socket.io/redis-adapter');
  createAdapter = adapter;
} catch (e) {
  console.warn('Redis adapter not available, using default adapter');
}
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getRedisClient, cacheAnalytics, getCachedAnalytics, blocklistToken, isTokenBlocklisted, checkRateLimit } = require('./utils/redis');
const prisma = require('./utils/prisma').default;
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

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Setup Redis adapter for Socket.io multi-instance support (if available)
if (createAdapter) {
  try {
    const pubClient = getRedisClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.io Redis adapter enabled');
  } catch (error) {
    console.warn('⚠️  Failed to setup Redis adapter for Socket.io:', error.message);
  }
}

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

// RS256 support (optional - falls back to HS256 if keys not provided)
const fs = require('fs');
let JWT_PRIVATE_KEY = null;
let JWT_PUBLIC_KEY = null;
let JWT_ALGORITHM = 'HS256';

if (process.env.JWT_PRIVATE_KEY_PATH && process.env.JWT_PUBLIC_KEY_PATH) {
  try {
    JWT_PRIVATE_KEY = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH, 'utf8');
    JWT_PUBLIC_KEY = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH, 'utf8');
    JWT_ALGORITHM = 'RS256';
    console.log('✅ RS256 JWT signing enabled');
  } catch (error) {
    console.warn('⚠️  Failed to load RS256 keys, falling back to HS256:', error.message);
  }
}

// Sentry request handler (must be first middleware)
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Helper function to check if user is admin
const isAdmin = async (req) => {
  if (!req.user) return false;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true },
  });
  return user?.role === 'admin';
};

// Helper functions
const generateAccessToken = (user) => {
  const payload = { id: user.id, email: user.email };
  const options = { expiresIn: '15m' };
  
  if (JWT_ALGORITHM === 'RS256' && JWT_PRIVATE_KEY) {
    return jwt.sign(payload, JWT_PRIVATE_KEY, { ...options, algorithm: 'RS256' });
  }
  
  return jwt.sign(payload, JWT_SECRET, options);
};

const generateRefreshToken = (user) => {
  const payload = { id: user.id, email: user.email };
  const options = { expiresIn: '7d' };
  
  if (JWT_ALGORITHM === 'RS256' && JWT_PRIVATE_KEY) {
    return jwt.sign(payload, JWT_PRIVATE_KEY, { ...options, algorithm: 'RS256' });
  }
  
  return jwt.sign(payload, JWT_REFRESH_SECRET, options);
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

// Auth middleware with blocklist check
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  // Check if token is blocklisted
  const isBlocked = await isTokenBlocklisted(token);
  if (isBlocked) {
    return res.status(403).json({
      success: false,
      message: 'Token has been revoked',
    });
  }

  // Determine verification key based on algorithm
  const verifyKey = JWT_ALGORITHM === 'RS256' && JWT_PUBLIC_KEY 
    ? JWT_PUBLIC_KEY 
    : JWT_SECRET;
  const verifyOptions = JWT_ALGORITHM === 'RS256' && JWT_PUBLIC_KEY
    ? { algorithms: ['RS256'] }
    : {};

  jwt.verify(token, verifyKey, verifyOptions, async (err, user) => {
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
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
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
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
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

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    // Check if refresh token is blocklisted
    const isBlocked = await isTokenBlocklisted(refreshToken);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Refresh token has been revoked',
      });
    }

    const verifyKey = JWT_ALGORITHM === 'RS256' && JWT_PUBLIC_KEY 
      ? JWT_PUBLIC_KEY 
      : JWT_REFRESH_SECRET;
    const verifyOptions = JWT_ALGORITHM === 'RS256' && JWT_PUBLIC_KEY
      ? { algorithms: ['RS256'] }
      : {};

    jwt.verify(refreshToken, verifyKey, verifyOptions, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Generate new access token
      const newAccessToken = generateAccessToken(user);

      // Optionally rotate refresh token (security best practice)
      // For now, we'll just return the new access token
      const newRefreshToken = generateRefreshToken(user);

      // Blocklist old refresh token
      const decodedOld = jwt.decode(refreshToken);
      if (decodedOld && decodedOld.exp) {
        const expiresIn = decodedOld.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await blocklistToken(refreshToken, expiresIn);
        }
      }

      res.json({
        success: true,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken, // Rotated refresh token
        },
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

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/auth/logout - Logout and blocklist tokens
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const refreshToken = req.body.refreshToken;

    // Blocklist access token
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await blocklistToken(token, expiresIn);
          }
        }
      } catch (error) {
        console.error('Error blocklisting access token:', error);
      }
    }

    // Blocklist refresh token
    if (refreshToken) {
      try {
        const decoded = jwt.decode(refreshToken);
        if (decoded && decoded.exp) {
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await blocklistToken(refreshToken, expiresIn);
          }
        }
      } catch (error) {
        console.error('Error blocklisting refresh token:', error);
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    
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
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use',
        });
      }
    }

    // Update user
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
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
app.get('/api/menus', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, availableOnly } = req.query;
    
    const where = {};

    // Filter by category
    if (category && category !== 'All') {
      where.category = category;
    }

    // Filter by search term
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Filter by availability
    if (availableOnly === 'true') {
      where.isAvailable = true;
      where.stock = { gt: 0 };
    }

    const menus = await prisma.menuItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: menus,
      count: menus.length,
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
app.get('/api/menus/:id', async (req, res) => {
  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
    });
    
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
app.post('/api/menus', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

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

    const newMenuItem = await prisma.menuItem.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category,
        imageUrl: imageUrl || '',
        stock: stock ? parseInt(stock) : 0,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        tags: tags || [],
      },
    });

    // Broadcast update via Socket.io
    io.emit('menu:created', newMenuItem);
    
    // Invalidate analytics cache
    await getRedisClient().del('analytics:dashboard');

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
app.put('/api/menus/:id', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { name, description, price, category, imageUrl, stock, isAvailable, tags } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (category) updateData.category = category;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (tags) updateData.tags = tags;

    const updatedMenuItem = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: updateData,
    }).catch((error) => {
      if (error.code === 'P2025') {
        return null; // Not found
      }
      throw error;
    });

    if (!updatedMenuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    // Broadcast update via Socket.io
    io.emit('menu:updated', { menuItem: updatedMenuItem });
    io.emit('stock:update', {
      menuId: updatedMenuItem.id,
      stock: updatedMenuItem.stock,
      isAvailable: updatedMenuItem.isAvailable,
    });

    // Invalidate analytics cache
    const redisClient = getRedisClient();
    await redisClient.del('analytics:dashboard');

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: updatedMenuItem,
    });
  } catch (error) {
    console.error('Update menu error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// DELETE /api/menus/:id - Delete menu item (admin only)
app.delete('/api/menus/:id', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const deletedItem = await prisma.menuItem.delete({
      where: { id: req.params.id },
    }).catch((error) => {
      if (error.code === 'P2025') {
        return null; // Not found
      }
      throw error;
    });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    // Broadcast update via Socket.io
    io.emit('menu:deleted', { id: req.params.id });
    
    // Invalidate analytics cache
    const redisClient = getRedisClient();
    await redisClient.del('analytics:dashboard');

    res.json({
      success: true,
      message: 'Menu item deleted successfully',
      data: deletedItem,
    });
  } catch (error) {
    console.error('Delete menu error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
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
app.get('/api/trucks/nearby', async (req, res) => {
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

    // Get all active trucks from database
    const activeTrucks = await prisma.truck.findMany({
      where: { isActive: true },
    });

    // Filter and calculate distances
    const nearbyTrucks = activeTrucks
      .map((truck) => {
        const distance = calculateDistance(
          userLat,
          userLon,
          Number(truck.latitude),
          Number(truck.longitude)
        );
        return {
          ...truck,
          location: {
            latitude: Number(truck.latitude),
            longitude: Number(truck.longitude),
          },
          distance,
        };
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
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/trucks - Get all trucks
app.get('/api/trucks', async (req, res) => {
  try {
    const allTrucks = await prisma.truck.findMany({
      orderBy: { lastUpdated: 'desc' },
    });

    // Transform to include location object for compatibility
    const trucksWithLocation = allTrucks.map((truck) => ({
      ...truck,
      location: {
        latitude: Number(truck.latitude),
        longitude: Number(truck.longitude),
      },
    }));

    res.json({
      success: true,
      data: trucksWithLocation,
      count: trucksWithLocation.length,
    });
  } catch (error) {
    console.error('Get trucks error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/trucks/:id - Get single truck
app.get('/api/trucks/:id', async (req, res) => {
  try {
    const truck = await prisma.truck.findUnique({
      where: { id: req.params.id },
    });

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found',
      });
    }

    // Transform to include location object
    const truckWithLocation = {
      ...truck,
      location: {
        latitude: Number(truck.latitude),
        longitude: Number(truck.longitude),
      },
    };

    res.json({
      success: true,
      data: truckWithLocation,
    });
  } catch (error) {
    console.error('Get truck error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/trucks/location - Update truck location (admin)
app.post('/api/trucks/location', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

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

    // Update or create truck
    const truck = await prisma.truck.upsert({
      where: { id: truckId },
      update: {
        latitude: location.latitude,
        longitude: location.longitude,
        heading: heading !== undefined ? heading : undefined,
        speed: speed !== undefined ? speed : undefined,
      },
      create: {
        id: truckId,
        name: `Truck ${truckId}`,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: heading || 0,
        speed: speed || 0,
        isActive: true,
      },
    });

    // Transform for response
    const truckWithLocation = {
      ...truck,
      location: {
        latitude: Number(truck.latitude),
        longitude: Number(truck.longitude),
      },
    };

    // Broadcast update via Socket.io
    io.emit('truck:location:updated', truckWithLocation);

    res.json({
      success: true,
      message: 'Truck location updated successfully',
      data: truckWithLocation,
    });
  } catch (error) {
    console.error('Update truck location error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT /api/trucks/:id - Update truck details (admin)
app.put('/api/trucks/:id', authenticateToken, async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { name, driverName, isActive, schedule, estimatedWaitTime } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (driverName !== undefined) updateData.driverName = driverName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (schedule) updateData.schedule = schedule;
    if (estimatedWaitTime !== undefined) updateData.estimatedWaitTime = estimatedWaitTime;

    const updatedTruck = await prisma.truck.update({
      where: { id: req.params.id },
      data: updateData,
    }).catch((error) => {
      if (error.code === 'P2025') {
        return null; // Not found
      }
      throw error;
    });

    if (!updatedTruck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found',
      });
    }

    // Transform for response
    const truckWithLocation = {
      ...updatedTruck,
      location: {
        latitude: Number(updatedTruck.latitude),
        longitude: Number(updatedTruck.longitude),
      },
    };

    // Broadcast update via Socket.io
    io.emit('truck:updated', truckWithLocation);

    res.json({
      success: true,
      message: 'Truck updated successfully',
      data: truckWithLocation,
    });
  } catch (error) {
    console.error('Update truck error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Send current data to newly connected client
  try {
    const [menus, trucks] = await Promise.all([
      prisma.menuItem.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.truck.findMany({ where: { isActive: true } }),
    ]);

    // Transform trucks to include location object
    const trucksWithLocation = trucks.map((truck) => ({
      ...truck,
      location: {
        latitude: Number(truck.latitude),
        longitude: Number(truck.longitude),
      },
    }));

    socket.emit('menu:updated', { menus });
    socket.emit('trucks:updated', { trucks: trucksWithLocation });
  } catch (error) {
    console.error('Error sending initial data to socket:', error);
  }
});

// Admin middleware
const requireAdmin = async (req, res, next) => {
  if (!(await isAdmin(req))) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};

// Analytics routes (admin only)
// GET /api/analytics/dashboard - Get dashboard metrics
app.get('/api/analytics/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cacheKey = 'analytics:dashboard';
    
    // Check Redis cache
    const cachedData = await getCachedAnalytics(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }

    // Calculate metrics using Prisma
    const totalOrders = await prisma.order.count();
    const completedOrders = await prisma.order.findMany({
      where: { status: 'completed' },
      select: { total: true },
    });
    const totalRevenue = completedOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Orders by status
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const ordersByStatus = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
    };
    statusCounts.forEach(({ status, _count }) => {
      ordersByStatus[status] = _count.status;
    });

    // Revenue by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    const revenueByDay = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      revenueByDay[dateStr] = 0;
    }

    const ordersInRange = await prisma.order.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: 'completed',
      },
      select: { total: true, createdAt: true },
    });

    ordersInRange.forEach((order) => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      if (revenueByDay[orderDate] !== undefined) {
        revenueByDay[orderDate] += Number(order.total);
      }
    });

    // Top selling items
    const orderItems = await prisma.orderItem.findMany({
      include: {
        menuItem: {
          select: { name: true },
        },
      },
    });

    const itemCounts = {};
    orderItems.forEach((item) => {
      const itemName = item.menuItem.name;
      itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
    });

    const topSellingItems = Object.entries(itemCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Payment status breakdown
    const paymentStatusCounts = await prisma.order.groupBy({
      by: ['paymentStatus'],
      _count: { paymentStatus: true },
    });
    const paymentStatusBreakdown = {
      pending: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      refunded: 0,
    };
    paymentStatusCounts.forEach(({ paymentStatus, _count }) => {
      paymentStatusBreakdown[paymentStatus] = _count.paymentStatus;
    });

    // Today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await prisma.order.findMany({
      where: { createdAt: { gte: today } },
      select: { total: true },
    });
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Menu availability
    const totalMenuItems = await prisma.menuItem.count();
    const availableItems = await prisma.menuItem.count({
      where: { isAvailable: true, stock: { gt: 0 } },
    });
    const lowStockItems = await prisma.menuItem.count({
      where: { stock: { gt: 0, lt: 10 } },
    });

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

    // Cache in Redis with 5 minute TTL
    await cacheAnalytics(cacheKey, analytics, 300);

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
app.get('/api/analytics/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const filteredOrders = await prisma.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

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
        const itemsCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        csvRows.push([
          order.id,
          order.userId || '',
          order.status,
          order.paymentStatus,
          order.subtotal.toString(),
          order.tax.toString(),
          order.total.toString(),
          itemsCount.toString(),
          order.createdAt.toISOString(),
          order.updatedAt.toISOString(),
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
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/analytics/orders - Get orders with filters for analytics
app.get('/api/analytics/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, paymentStatus, startDate, endDate, limit = 100 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [filteredOrders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: { name: true, price: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: filteredOrders,
      count: filteredOrders.length,
      total,
    });
  } catch (error) {
    console.error('Get analytics orders error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
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

    // Validate items and check stock using Prisma transaction
    const validatedItems = [];
    let subtotal = 0;

    for (const orderItem of items) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: orderItem.menuItemId },
      });
      
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
      let itemPrice = Number(menuItem.price);
      if (orderItem.customizations) {
        const customizationTotal = orderItem.customizations.reduce(
          (sum, custom) => sum + (custom.priceModifier || 0),
          0
        );
        itemPrice += customizationTotal;
      }

      validatedItems.push({
        menuItemId: menuItem.id,
        quantity: orderItem.quantity,
        price: itemPrice,
        customizations: orderItem.customizations || [],
        specialInstructions: orderItem.specialInstructions,
      });

      subtotal += itemPrice * orderItem.quantity;

      // Update stock (will be committed in transaction)
      await prisma.menuItem.update({
        where: { id: menuItem.id },
        data: { stock: { decrement: orderItem.quantity } },
      });
    }

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    // Create order with items in a transaction
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
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
        orderItems: {
          create: validatedItems,
        },
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
    });

    // Broadcast order creation via Socket.io
    io.emit('order:created', order);
    
    // Invalidate analytics cache
    const redisClient = getRedisClient();
    await redisClient.del('analytics:dashboard');

    // Send notification to user if token is registered
    const pushToken = await prisma.pushToken.findFirst({
      where: { userId: order.userId },
    });
    
    if (pushToken) {
      const rateLimitKey = `notification:${pushToken.pushToken}`;
      const rateLimit = await checkRateLimit(rateLimitKey, 1, 5); // 1 per 5 seconds
      
      if (rateLimit.allowed) {
        io.emit('notification:user', {
          userId: order.userId,
          title: 'Order Confirmed!',
          body: `Your order ${order.id} has been confirmed`,
          data: { type: 'order_created', orderId: order.id },
        });
      }
    }

    res.json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
});

// GET /api/orders - Get orders (user's orders or all for admin)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const isAdminUser = await isAdmin(req);
    const where = isAdminUser ? {} : { userId: req.user.id };

    const userOrders = await prisma.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: userOrders,
      count: userOrders.length,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/orders/all - Get all orders (admin only)
app.get('/api/orders/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allOrders = await prisma.order.findMany({
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: allOrders,
      count: allOrders.length,
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/orders/:id - Get single order
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Users can only see their own orders (unless admin)
    const isAdminUser = await isAdmin(req);
    if (!isAdminUser && order.userId !== req.user.id) {
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
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT /api/orders/:id/status - Update order status (admin only)
app.put('/api/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
    });

    // Broadcast update via Socket.io
    io.emit('order:status:updated', updatedOrder);

    // Invalidate analytics cache
    const redisClient = getRedisClient();
    await redisClient.del('analytics:dashboard');

    // Send notification to user
    const pushToken = await prisma.pushToken.findFirst({
      where: { userId: order.userId },
    });

    if (pushToken) {
      const rateLimitKey = `notification:${pushToken.pushToken}`;
      const rateLimit = await checkRateLimit(rateLimitKey, 1, 5);
      
      if (rateLimit.allowed) {
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
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Update order status error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
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
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // In production, verify Stripe signature
    const event = req.body;
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const order = await prisma.order.findFirst({
        where: { paymentIntentId: paymentIntent.id },
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true },
              },
            },
          },
        },
      });
      
      if (order) {
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'succeeded',
            status: 'confirmed',
          },
          include: {
            orderItems: {
              include: {
                menuItem: {
                  select: { id: true, name: true, price: true },
                },
              },
            },
          },
        });

        // Broadcast update
        io.emit('order:payment:succeeded', updatedOrder);
        
        // Invalidate analytics cache
        const redisClient = getRedisClient();
        await redisClient.del('analytics:dashboard');
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(400).json({
      success: false,
      message: 'Webhook error',
    });
  }
});

// Notification routes
// POST /api/notifications/register - Register push token
app.post('/api/notifications/register', authenticateToken, async (req, res) => {
  try {
    const { pushToken, platform } = req.body;
    const userId = req.user.id;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required',
      });
    }

    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Valid platform (ios, android, web) is required',
      });
    }

    // Upsert push token (user can have multiple tokens for different devices)
    await prisma.pushToken.upsert({
      where: {
        userId_pushToken: {
          userId: userId,
          pushToken: pushToken,
        },
      },
      update: {
        lastUsed: new Date(),
        platform,
      },
      create: {
        userId,
        pushToken,
        platform,
      },
    });

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Register push token error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
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

    // Get push tokens based on target audience
    let tokens;
    if (targetAudience === 'subscribed') {
      // Get users who have promotions enabled in their notification settings
      const usersWithPromos = await prisma.user.findMany({
        where: {
          notificationSettings: {
            promotions: true,
          },
        },
        include: {
          pushTokens: true,
        },
      });
      tokens = usersWithPromos.flatMap((user) => user.pushTokens);
    } else {
      // Get all push tokens
      tokens = await prisma.pushToken.findMany();
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
      sentTo: tokens.length,
    });
  } catch (error) {
    console.error('Send promo notification error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/notifications/team-coordination - Send team coordination message (admin)
app.post('/api/notifications/team-coordination', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { message, priority = 'normal', targetRole = 'all' } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Get user info for sender
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, name: true },
    });

    // Broadcast to admin clients via Socket.io
    io.emit('team:coordination', {
      message,
      priority,
      targetRole,
      from: user?.email || req.user.email,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Team coordination message sent',
    });
  } catch (error) {
    console.error('Team coordination error:', error);
    if (Sentry) {
      Sentry.captureException(error);
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Note: Sample data is now initialized via Prisma seed script
// Run: yarn db:seed

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
