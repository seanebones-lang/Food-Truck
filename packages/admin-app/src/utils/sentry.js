import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for admin web app
 */
export const initSentry = () => {
  if (import.meta.env.DEV) {
    // Disable Sentry in development
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not found. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['authorization'];
        }
      }

      return event;
    },
  });
};

/**
 * Set user context
 */
export const setSentryUser = (user) => {
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
 * Capture exception
 */
export const captureException = (error, context = {}) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureException(error);
  });
};
