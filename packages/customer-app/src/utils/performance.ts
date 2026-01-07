import * as Sentry from '@sentry/react-native';

/**
 * Performance monitoring utilities
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

/**
 * Track performance metric
 */
export const trackPerformance = (metric: PerformanceMetric) => {
  if (__DEV__) {
    console.log('[Performance]', metric.name, metric.value, metric.unit);
    return;
  }

  Sentry.metrics.distribution(metric.name, metric.value, {
    unit: metric.unit,
    tags: metric.tags,
  });
};

/**
 * Track screen load time
 */
export const trackScreenLoad = (screenName: string, loadTime: number) => {
  trackPerformance({
    name: 'screen_load_time',
    value: loadTime,
    unit: 'millisecond',
    tags: { screen: screenName },
  });
};

/**
 * Track API request time
 */
export const trackApiRequest = (endpoint: string, duration: number, success: boolean) => {
  trackPerformance({
    name: 'api_request_duration',
    value: duration,
    unit: 'millisecond',
    tags: {
      endpoint,
      status: success ? 'success' : 'error',
    },
  });
};

/**
 * Track custom operation duration
 */
export const trackOperation = (operationName: string, duration: number) => {
  trackPerformance({
    name: 'operation_duration',
    value: duration,
    unit: 'millisecond',
    tags: { operation: operationName },
  });
};

/**
 * Measure async operation
 */
export const measureAsync = async <T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();

  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    trackOperation(name, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackOperation(`${name}_error`, duration);
    throw error;
  }
};

/**
 * Track app startup time
 */
export const trackAppStartup = () => {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark('app-start');
    
    // Track when app becomes interactive
    setTimeout(() => {
      performance.mark('app-interactive');
      const measure = performance.measure(
        'app-startup',
        'app-start',
        'app-interactive'
      );
      
      if (measure) {
        trackPerformance({
          name: 'app_startup_time',
          value: measure.duration,
          unit: 'millisecond',
        });
      }
    }, 0);
  }
};

/**
 * Track memory usage (if available)
 */
export const trackMemoryUsage = () => {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory;
    trackPerformance({
      name: 'memory_usage',
      value: memory.usedJSHeapSize,
      unit: 'byte',
      tags: {
        total: memory.totalJSHeapSize.toString(),
        limit: memory.jsHeapSizeLimit.toString(),
      },
    });
  }
};
