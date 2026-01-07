/**
 * Swagger/OpenAPI Documentation Configuration
 * Auto-generates API documentation from route definitions
 * 
 * @module swagger
 * @version 1.0.0
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Food Truck Management System API',
      version: '2.0.0',
      description: `
        Comprehensive API documentation for the Food Truck Management System.
        
        ## Features
        - Authentication & Authorization
        - Menu Management
        - Order Processing
        - Truck Location Tracking
        - Analytics & Reporting
        - Real-time Updates via WebSocket
        
        ## Security
        - JWT-based authentication
        - Rate limiting
        - Input sanitization
        - OWASP Top 10 2025 compliant
        - NIST SP 800-53 Rev. 5 compliant
        
        ## Rate Limits
        - Global: 100 requests per 15 minutes
        - Authentication: 5 requests per 15 minutes
        - Orders: 20 requests per minute
        - Analytics: 10 requests per minute
      `,
      contact: {
        name: 'Food Truck Engineering Team',
        email: 'support@foodtruck.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://nexteleven.com/legal',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.foodtruck.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login or /api/auth/signup',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['customer', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        MenuItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number', format: 'decimal' },
            category: { type: 'string' },
            imageUrl: { type: 'string', format: 'uri' },
            stock: { type: 'integer' },
            isAvailable: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
            },
            paymentStatus: {
              type: 'string',
              enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded'],
            },
            subtotal: { type: 'number', format: 'decimal' },
            tax: { type: 'number', format: 'decimal' },
            total: { type: 'number', format: 'decimal' },
            orderItems: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            menuItemId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer' },
            price: { type: 'number', format: 'decimal' },
            customizations: { type: 'array' },
            specialInstructions: { type: 'string' },
          },
        },
        Truck: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            driverName: { type: 'string' },
            location: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
              },
            },
            isActive: { type: 'boolean' },
            estimatedWaitTime: { type: 'integer' },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            errorCode: { 
              type: 'string',
              description: 'Error code for client-side translation',
              example: 'INVALID_EMAIL'
            },
            message: { 
              type: 'string',
              example: 'Invalid email address'
            },
            statusCode: {
              type: 'integer',
              example: 400
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-03T12:00:00.000Z'
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './server.js',
    './__tests__/api/*.test.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Swagger UI setup
 * @param {express.App} app - Express application
 */
function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Food Truck API Documentation',
  }));

  // JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

module.exports = {
  swaggerSpec,
  setupSwagger,
};
