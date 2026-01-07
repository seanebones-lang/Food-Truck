/**
 * TOTP (Time-based One-Time Password) Utilities
 * 
 * Implements RFC 6238 TOTP for Multi-Factor Authentication.
 * 
 * @module utils/totp
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * Generate a random secret for TOTP
 * 
 * @param {number} length - Secret length in bytes (default: 20)
 * @returns {string} Base32-encoded secret
 */
function generateSecret(length = 20) {
  const randomBytes = crypto.randomBytes(length);
  return base32Encode(randomBytes);
}

/**
 * Generate TOTP code from secret
 * 
 * @param {string} secret - Base32-encoded secret
 * @param {number} timeStep - Time step in seconds (default: 30)
 * @param {number} digits - Number of digits in code (default: 6)
 * @returns {string} TOTP code
 */
function generateTOTP(secret, timeStep = 30, digits = 6) {
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuffer = Buffer.allocUnsafe(8);
  timeBuffer.writeUInt32BE(time, 4);
  
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(timeBuffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % Math.pow(10, digits);
  
  return code.toString().padStart(digits, '0');
}

/**
 * Verify TOTP code
 * 
 * @param {string} secret - Base32-encoded secret
 * @param {string} code - TOTP code to verify
 * @param {number} window - Time window for verification (default: 1)
 * @param {number} timeStep - Time step in seconds (default: 30)
 * @param {number} digits - Number of digits in code (default: 6)
 * @returns {boolean} True if code is valid
 */
function verifyTOTP(secret, code, window = 1, timeStep = 30, digits = 6) {
  const currentTime = Math.floor(Date.now() / 1000 / timeStep);
  
  // Check current time step and adjacent windows
  for (let i = -window; i <= window; i++) {
    const time = currentTime + i;
    const timeBuffer = Buffer.allocUnsafe(8);
    timeBuffer.writeUInt32BE(time, 4);
    
    const key = base32Decode(secret);
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0x0f;
    const expectedCode = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % Math.pow(10, digits);
    
    if (expectedCode.toString().padStart(digits, '0') === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate QR code URL for authenticator apps
 * 
 * @param {string} secret - Base32-encoded secret
 * @param {string} email - User email
 * @param {string} issuer - Service name (default: 'Food Truck')
 * @returns {string} QR code URL
 */
function generateQRCodeURL(secret, email, issuer = 'Food Truck') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate backup codes
 * 
 * @param {number} count - Number of backup codes to generate (default: 10)
 * @returns {string[]} Array of backup codes
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash backup code for storage
 * 
 * @param {string} code - Backup code
 * @returns {string} Hashed code
 */
function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify backup code
 * 
 * @param {string} code - Backup code to verify
 * @param {string[]} hashedCodes - Array of hashed backup codes
 * @returns {boolean} True if code is valid
 */
function verifyBackupCode(code, hashedCodes) {
  const hashed = hashBackupCode(code);
  return hashedCodes.includes(hashed);
}

/**
 * Base32 encoding
 * 
 * @param {Buffer} buffer - Buffer to encode
 * @returns {string} Base32-encoded string
 */
function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  
  return output;
}

/**
 * Base32 decoding
 * 
 * @param {string} str - Base32-encoded string
 * @returns {Buffer} Decoded buffer
 */
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const lookup = {};
  for (let i = 0; i < alphabet.length; i++) {
    lookup[alphabet[i]] = i;
  }
  
  let bits = 0;
  let value = 0;
  const output = [];
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i].toUpperCase();
    if (!(char in lookup)) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    
    value = (value << 5) | lookup[char];
    bits += 5;
    
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  
  return Buffer.from(output);
}

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateQRCodeURL,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
};
