/**
 * Error Codes and Messages
 * 
 * Centralized error code definitions for client-side translation.
 * Server returns error codes, client translates using i18n.
 */

export enum ErrorCode {
  // Authentication Errors
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  MISSING_FIELDS = 'MISSING_FIELDS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  PASSWORDS_DONT_MATCH = 'PASSWORDS_DONT_MATCH',
  MISSING_PASSWORD = 'MISSING_PASSWORD',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  
  // Order Errors
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  MENU_ITEM_NOT_FOUND = 'MENU_ITEM_NOT_FOUND',
  MENU_ITEM_UNAVAILABLE = 'MENU_ITEM_UNAVAILABLE',
  INVALID_ORDER_ITEM = 'INVALID_ORDER_ITEM',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  STOCK_CHANGED = 'STOCK_CHANGED',
  
  // Validation Errors
  INVALID_NAME = 'INVALID_NAME',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_URL = 'INVALID_URL',
  
  // Authorization Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  ADMIN_REQUIRED = 'ADMIN_REQUIRED',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  WEBSOCKET_RATE_LIMIT_EXCEEDED = 'WEBSOCKET_RATE_LIMIT_EXCEEDED',
  
  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
}

export interface ErrorResponse {
  success: false;
  errorCode?: ErrorCode | string;
  message: string;
  errors?: string[];
  errorParams?: Record<string, any>;
}

/**
 * Error message translation keys (for reference)
 * These should be added to i18n locale files
 */
export const ERROR_TRANSLATION_KEYS = {
  [ErrorCode.INVALID_EMAIL]: 'errors.invalidEmail',
  [ErrorCode.INVALID_CREDENTIALS]: 'errors.invalidCredentials',
  [ErrorCode.MISSING_FIELDS]: 'errors.missingFields',
  [ErrorCode.WEAK_PASSWORD]: 'errors.weakPassword',
  [ErrorCode.PASSWORDS_DONT_MATCH]: 'errors.passwordsDontMatch',
  [ErrorCode.MISSING_PASSWORD]: 'errors.missingPassword',
  [ErrorCode.ACCOUNT_LOCKED]: 'errors.accountLocked',
  [ErrorCode.INSUFFICIENT_STOCK]: 'errors.insufficientStock',
  [ErrorCode.MENU_ITEM_NOT_FOUND]: 'errors.menuItemNotFound',
  [ErrorCode.MENU_ITEM_UNAVAILABLE]: 'errors.menuItemUnavailable',
  [ErrorCode.INVALID_ORDER_ITEM]: 'errors.invalidOrderItem',
  [ErrorCode.INVALID_QUANTITY]: 'errors.invalidQuantity',
  [ErrorCode.ORDER_NOT_FOUND]: 'errors.orderNotFound',
  [ErrorCode.STOCK_CHANGED]: 'errors.stockChanged',
  [ErrorCode.INVALID_NAME]: 'errors.invalidName',
  [ErrorCode.INVALID_COORDINATES]: 'errors.invalidCoordinates',
  [ErrorCode.INVALID_URL]: 'errors.invalidUrl',
  [ErrorCode.UNAUTHORIZED]: 'errors.unauthorized',
  [ErrorCode.FORBIDDEN]: 'errors.forbidden',
  [ErrorCode.ADMIN_REQUIRED]: 'errors.adminRequired',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'errors.rateLimitExceeded',
  [ErrorCode.WEBSOCKET_RATE_LIMIT_EXCEEDED]: 'errors.websocketRateLimitExceeded',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'errors.internalServerError',
  [ErrorCode.DATABASE_ERROR]: 'errors.databaseError',
  [ErrorCode.REDIS_ERROR]: 'errors.redisError',
};
