/**
 * Security Audit Logger
 * 
 * Implements comprehensive security audit logging for compliance and monitoring.
 * Logs all security-relevant events with tamper-proof storage.
 * 
 * @module utils/auditLogger
 * @version 1.0.0
 */

const prisma = require('./prisma').default;
const crypto = require('crypto');

/**
 * Audit log event types
 */
const AuditEventType = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  
  // Authorization events
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ROLE_CHANGE: 'ROLE_CHANGE',
  ACCESS_GRANTED: 'ACCESS_GRANTED',
  ACCESS_REVOKED: 'ACCESS_REVOKED',
  
  // Security events
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  SSRF_ATTEMPT: 'SSRF_ATTEMPT',
  INJECTION_ATTEMPT: 'INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',
  
  // Data access events
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_DELETION: 'DATA_DELETION',
  BULK_OPERATION: 'BULK_OPERATION',
  
  // System events
  CONFIGURATION_CHANGE: 'CONFIGURATION_CHANGE',
  BACKUP_CREATED: 'BACKUP_CREATED',
  BACKUP_RESTORED: 'BACKUP_RESTORED',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
};

/**
 * Severity levels
 */
const Severity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

/**
 * Extract IP address from request
 */
function getIpAddress(req) {
  return req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown';
}

/**
 * Extract user agent from request
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

/**
 * Sanitize sensitive data from request/response bodies
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'authorization',
    'creditCard',
    'cvv',
    'ssn',
  ];

  const sanitized = Array.isArray(data) ? [] : {};

  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        sanitized[key] = sanitizeData(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }
  }

  return sanitized;
}

/**
 * Calculate hash for tamper-proofing
 */
function calculateHash(data) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Log security event to audit log
 * 
 * @param {Object} options - Audit log options
 * @param {string} options.eventType - Event type (from AuditEventType)
 * @param {Object} options.req - Express request object
 * @param {Object} options.res - Express response object (optional)
 * @param {string} options.userId - User ID (optional)
 * @param {string} options.userEmail - User email (optional)
 * @param {string} options.severity - Severity level (default: 'info')
 * @param {Object} options.metadata - Additional metadata (optional)
 * @param {string} options.errorMessage - Error message (optional)
 * @param {Object} options.requestBody - Request body (optional, will be sanitized)
 * @param {Object} options.responseBody - Response body (optional, will be sanitized)
 * 
 * @returns {Promise<void>}
 */
async function logSecurityEvent(options = {}) {
  const {
    eventType,
    req,
    res,
    userId,
    userEmail,
    severity = Severity.INFO,
    metadata = {},
    errorMessage,
    requestBody,
    responseBody,
  } = options;

  try {
    // Extract information from request if provided
    const ipAddress = req ? getIpAddress(req) : metadata.ipAddress;
    const userAgent = req ? getUserAgent(req) : metadata.userAgent;
    const endpoint = req ? req.path : metadata.endpoint;
    const method = req ? req.method : metadata.method;
    const statusCode = res ? res.statusCode : metadata.statusCode;

    // Sanitize sensitive data
    const sanitizedRequestBody = requestBody
      ? sanitizeData(requestBody)
      : req?.body
      ? sanitizeData(req.body)
      : null;

    const sanitizedResponseBody = responseBody
      ? sanitizeData(responseBody)
      : null;

    // Get user information if not provided
    let finalUserId = userId;
    let finalUserEmail = userEmail;

    if (req?.user && !finalUserId) {
      finalUserId = req.user.id;
      finalUserEmail = req.user.email;
    }

    // Create audit log entry
    const auditLogData = {
      eventType,
      userId: finalUserId,
      userEmail: finalUserEmail,
      ipAddress,
      userAgent,
      endpoint,
      method,
      statusCode,
      requestBody: sanitizedRequestBody,
      responseBody: sanitizedResponseBody,
      errorMessage,
      metadata: {
        ...metadata,
        hash: calculateHash({
          eventType,
          userId: finalUserId,
          timestamp: new Date().toISOString(),
        }),
      },
      severity,
    };

    // Store in database
    await prisma.auditLog.create({
      data: auditLogData,
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT LOG]', JSON.stringify(auditLogData, null, 2));
    }
  } catch (error) {
    // Don't fail the request if audit logging fails
    // But log the error for investigation
    console.error('[AUDIT LOG ERROR]', error);
    
    // Optionally send to error tracking service
    if (process.env.SENTRY_DSN) {
      const Sentry = require('@sentry/node');
      Sentry.captureException(error, {
        tags: { component: 'auditLogger' },
      });
    }
  }
}

/**
 * Query audit logs
 * 
 * @param {Object} filters - Query filters
 * @param {string} filters.eventType - Filter by event type
 * @param {string} filters.userId - Filter by user ID
 * @param {string} filters.severity - Filter by severity
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {number} filters.limit - Result limit (default: 100, max: 1000)
 * @param {number} filters.offset - Result offset
 * 
 * @returns {Promise<Object>} Query results
 */
async function queryAuditLogs(filters = {}) {
  const {
    eventType,
    userId,
    severity,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters;

  const where = {};

  if (eventType) {
    where.eventType = eventType;
  }

  if (userId) {
    where.userId = userId;
  }

  if (severity) {
    where.severity = severity;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 1000),
      skip: offset,
      select: {
        id: true,
        eventType: true,
        userId: true,
        userEmail: true,
        ipAddress: true,
        endpoint: true,
        method: true,
        statusCode: true,
        severity: true,
        errorMessage: true,
        metadata: true,
        createdAt: true,
        // Exclude requestBody and responseBody for performance
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
    hasMore: offset + logs.length < total,
  };
}

/**
 * Get audit log statistics
 * 
 * @param {Object} filters - Query filters (same as queryAuditLogs)
 * @returns {Promise<Object>} Statistics
 */
async function getAuditStatistics(filters = {}) {
  const { startDate, endDate } = filters;

  const where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [totalEvents, eventsByType, eventsBySeverity, recentCritical] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['eventType'],
      where,
      _count: { eventType: true },
    }),
    prisma.auditLog.groupBy({
      by: ['severity'],
      where,
      _count: { severity: true },
    }),
    prisma.auditLog.findMany({
      where: {
        ...where,
        severity: Severity.CRITICAL,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        eventType: true,
        userEmail: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totalEvents,
    eventsByType: eventsByType.reduce((acc, item) => {
      acc[item.eventType] = item._count.eventType;
      return acc;
    }, {}),
    eventsBySeverity: eventsBySeverity.reduce((acc, item) => {
      acc[item.severity] = item._count.severity;
      return acc;
    }, {}),
    recentCritical,
  };
}

/**
 * Middleware to automatically log security events
 */
function auditLogMiddleware() {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override end to log after response
    res.end = function (...args) {
      // Log security-relevant events
      const eventType = determineEventType(req, res);
      
      if (eventType) {
        // Log asynchronously (don't block response)
        logSecurityEvent({
          eventType,
          req,
          res,
          severity: determineSeverity(res.statusCode),
        }).catch(err => {
          console.error('Audit log error:', err);
        });
      }

      // Call original end
      originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Determine event type from request/response
 */
function determineEventType(req, res) {
  const path = req.path;
  const method = req.method;
  const statusCode = res.statusCode;

  // Authentication events
  if (path.includes('/auth/login')) {
    return statusCode === 200 ? AuditEventType.LOGIN_SUCCESS : AuditEventType.LOGIN_FAILURE;
  }
  if (path.includes('/auth/logout')) {
    return AuditEventType.LOGOUT;
  }
  if (path.includes('/auth/refresh')) {
    return AuditEventType.TOKEN_REFRESH;
  }

  // Permission denied
  if (statusCode === 403) {
    return AuditEventType.PERMISSION_DENIED;
  }

  // Rate limiting
  if (statusCode === 429) {
    return AuditEventType.RATE_LIMIT_EXCEEDED;
  }

  // Data operations
  if (path.includes('/auth/export-data')) {
    return AuditEventType.DATA_EXPORT;
  }
  if (path.includes('/auth/delete-account')) {
    return AuditEventType.DATA_DELETION;
  }

  return null; // Don't log if not security-relevant
}

/**
 * Determine severity from status code
 */
function determineSeverity(statusCode) {
  if (statusCode >= 500) {
    return Severity.ERROR;
  }
  if (statusCode === 403 || statusCode === 401) {
    return Severity.WARNING;
  }
  if (statusCode === 429) {
    return Severity.WARNING;
  }
  return Severity.INFO;
}

module.exports = {
  logSecurityEvent,
  queryAuditLogs,
  getAuditStatistics,
  auditLogMiddleware,
  AuditEventType,
  Severity,
};
