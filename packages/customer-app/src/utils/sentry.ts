import * as Sentry from '@sentry/react-native';
import { config } from '../config';

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export const initSentry = () => {
  if (__DEV__) {
    // Disable Sentry in development
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not found. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_ENV || 'production',
    enableInExpoDevelopment: false,
    debug: false,
    tracesSampleRate: process.env.EXPO_PUBLIC_ENV === 'production' ? 0.2 : 1.0,
    attachScreenshot: true,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['authorization'];
        }
      }

      // Add app context
      if (event.contexts) {
        event.contexts.app = {
          ...event.contexts.app,
          client_id: config.clientId,
          version: config.version,
        };
      }

      return event;
    },
  });

  // Set user context
  Sentry.setTag('client_id', config.clientId);
  Sentry.setTag('app_version', config.version);
};

/**
 * Set user context for Sentry
 */
export const setSentryUser = (user: { id: string; email?: string; name?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
};

/**
 * Clear user context
 */
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

/**
 * Track custom event
 */
export const trackEvent = (eventName: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    category: 'custom',
    message: eventName,
    data,
    level: 'info',
  });
};

/**
 * Track performance transaction
 */
export const startTransaction = (name: string, op: string = 'navigation') => {
  return Sentry.startTransaction({ name, op });
};

/**
 * Capture exception
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureException(error);
  });
};

/**
 * Capture message
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};
