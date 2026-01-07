/**
 * Error Handler Utility
 * 
 * Provides standardized error response formatting with error codes
 * for consistent client-side error handling and translation.
 * 
 * @module utils/errorHandler
 * @version 2.0.0
 */

const { ErrorCode } = require('../packages/shared/src/errors');

/**
 * Standardized error response format
 * 
 * @param {Error|string} error - Error object or error message
 * @param {string} errorCode - Error code from ErrorCode enum
 * @param {number} statusCode - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error response
 */
function createErrorResponse(error, errorCode, statusCode = 500, details = {}) {
  const message = error instanceof Error ? error.message : error;
  
  return {
    success: false,
    errorCode,
    message,
    statusCode,
    ...details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Map common errors to error codes and status codes
 */
const ERROR_MAP = {
  // Authentication errors
  'Invalid email': { code: ErrorCode.INVALID_EMAIL, status: 400 },
  'Invalid credentials': { code: ErrorCode.INVALID_CREDENTIALS, status: 401 },
  'Account locked': { code: ErrorCode.ACCOUNT_LOCKED, status: 423 },
  'Invalid or expired token': { code: ErrorCode.UNAUTHORIZED, status: 401 },
  'Token has been revoked': { code: ErrorCode.UNAUTHORIZED, status: 403 },
  
  // Validation errors
  'Name must be at least 2 characters': { code: ErrorCode.INVALID_NAME, status: 400 },
  'Invalid URL': { code: ErrorCode.INVALID_URL, status: 400 },
  'Invalid coordinates': { code: ErrorCode.INVALID_COORDINATES, status: 400 },
  
  // Order errors
  'Insufficient stock': { code: ErrorCode.INSUFFICIENT_STOCK, status: 400 },
  'Menu item not found': { code: ErrorCode.MENU_ITEM_NOT_FOUND, status: 404 },
  'Order not found': { code: ErrorCode.ORDER_NOT_FOUND, status: 404 },
  'Stock changed': { code: ErrorCode.STOCK_CHANGED, status: 409 },
  
  // Authorization errors
  'Admin access required': { code: ErrorCode.ADMIN_REQUIRED, status: 403 },
  'Access denied': { code: ErrorCode.FORBIDDEN, status: 403 },
  
  // Rate limiting
  'Too many requests': { code: ErrorCode.RATE_LIMIT_EXCEEDED, status: 429 },
  'Rate limit exceeded': { code: ErrorCode.RATE_LIMIT_EXCEEDED, status: 429 },
  
  // Server errors
  'Database error': { code: ErrorCode.DATABASE_ERROR, status: 500 },
  'Redis error': { code: ErrorCode.REDIS_ERROR, status: 500 },
};

/**
 * Create error response from error message
 * Attempts to match error message to known error codes
 * 
 * @param {Error|string} error - Error object or message
 * @param {number} defaultStatusCode - Default HTTP status code
 * @returns {Object} Standardized error response
 */
function handleError(error, defaultStatusCode = 500) {
  const message = error instanceof Error ? error.message : error;
  
  // Try to match error message to known errors
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return createErrorResponse(
        message,
        value.code,
        value.status,
        { originalError: error instanceof Error ? error.message : undefined }
      );
    }
  }
  
  // Default error response
  return createErrorResponse(
    message,
    ErrorCode.INTERNAL_SERVER_ERROR,
    defaultStatusCode
  );
}

/**
 * Express error handler middleware
 * 
 * @param {Error} err - Error object
 * @param {express.Request} req - Express request
 * @param {express.Response} res - Express response
 * @param {express.NextFunction} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Log error (don't expose sensitive details in production)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  } else {
    console.error('Error:', err.message);
  }
  
  // Create standardized error response
  const errorResponse = handleError(err, res.statusCode || 500);
  
  // Send error response
  res.status(errorResponse.statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * Wraps async route handlers to automatically catch errors
 * 
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped route handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  createErrorResponse,
  handleError,
  errorHandler,
  asyncHandler,
  ERROR_MAP,
};
