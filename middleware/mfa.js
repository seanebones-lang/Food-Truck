/**
 * Multi-Factor Authentication Middleware
 * 
 * Middleware for MFA verification and enforcement.
 * 
 * @module middleware/mfa
 * @version 1.0.0
 */

const prisma = require('../utils/prisma').default;
const { verifyTOTP, verifyBackupCode } = require('../utils/totp');
const { logSecurityEvent, AuditEventType, Severity } = require('../utils/auditLogger');

/**
 * Check if user has MFA enabled
 * 
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if MFA is enabled
 */
async function isMFAEnabled(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  });
  
  return user?.mfaEnabled || false;
}

/**
 * Require MFA verification for protected routes
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 * @returns {Promise<void>}
 */
async function requireMFA(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const mfaEnabled = await isMFAEnabled(req.user.id);
    
    if (!mfaEnabled) {
      // MFA not enabled, allow access
      return next();
    }

    // Check if MFA has been verified in this session
    if (req.session?.mfaVerified) {
      return next();
    }

    // MFA required but not verified
    return res.status(403).json({
      success: false,
      message: 'MFA verification required',
      requiresMFA: true,
    });
  } catch (error) {
    console.error('MFA middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * Verify MFA code (TOTP or backup code)
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 * @returns {Promise<void>}
 */
async function verifyMFACode(req, res, next) {
  try {
    const { code, isBackupCode = false } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'MFA code is required',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user || !user.mfaEnabled) {
      return res.status(400).json({
        success: false,
        message: 'MFA is not enabled for this account',
      });
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      isValid = verifyBackupCode(code, user.mfaBackupCodes || []);
      
      if (isValid) {
        // Remove used backup code
        const hashedCode = require('../utils/totp').hashBackupCode(code);
        await prisma.user.update({
          where: { id: req.user.id },
          data: {
            mfaBackupCodes: {
              set: (user.mfaBackupCodes || []).filter(c => c !== hashedCode),
            },
          },
        });

        // Log backup code usage
        await logSecurityEvent({
          eventType: AuditEventType.TOKEN_REFRESH, // Using similar event type
          req,
          res,
          userId: req.user.id,
          userEmail: req.user.email,
          severity: Severity.INFO,
          metadata: {
            mfaMethod: 'backup_code',
          },
        });
      }
    } else {
      // Verify TOTP code
      if (!user.mfaSecret) {
        return res.status(400).json({
          success: false,
          message: 'MFA secret not found',
        });
      }

      isValid = verifyTOTP(user.mfaSecret, code);

      if (isValid) {
        // Log TOTP verification
        await logSecurityEvent({
          eventType: AuditEventType.TOKEN_REFRESH,
          req,
          res,
          userId: req.user.id,
          userEmail: req.user.email,
          severity: Severity.INFO,
          metadata: {
            mfaMethod: 'totp',
          },
        });
      }
    }

    if (!isValid) {
      // Log failed MFA attempt
      await logSecurityEvent({
        eventType: AuditEventType.LOGIN_FAILURE,
        req,
        res,
        userId: req.user.id,
        userEmail: req.user.email,
        severity: Severity.WARNING,
        errorMessage: 'Invalid MFA code',
        metadata: {
          mfaMethod: isBackupCode ? 'backup_code' : 'totp',
        },
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid MFA code',
      });
    }

    // Mark MFA as verified in session
    if (req.session) {
      req.session.mfaVerified = true;
    }

    // Attach to request for other middleware
    req.mfaVerified = true;

    next();
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

module.exports = {
  isMFAEnabled,
  requireMFA,
  verifyMFACode,
};
