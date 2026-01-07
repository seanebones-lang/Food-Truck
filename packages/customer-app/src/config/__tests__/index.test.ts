import { config, isFeatureEnabled, getThemeColor, getSpacing, updateConfig } from '../index';
import type { ClientConfig } from '../index';

describe('Config System', () => {
  beforeEach(() => {
    // Reset config to default before each test
    jest.resetModules();
  });

  describe('config', () => {
    it('should have default configuration', () => {
      expect(config).toBeDefined();
      expect(config.clientId).toBe('default');
      expect(config.appName).toBe('Food Truck App');
      expect(config.theme).toBeDefined();
      expect(config.features).toBeDefined();
    });

    it('should have all required theme colors', () => {
      expect(config.theme.colors.primary).toBe('#f4511e');
      expect(config.theme.colors.secondary).toBe('#666');
      expect(config.theme.colors.background).toBe('#ffffff');
      expect(config.theme.colors.text).toBe('#333333');
    });

    it('should have all required spacing values', () => {
      expect(config.theme.spacing.xs).toBe(4);
      expect(config.theme.spacing.sm).toBe(8);
      expect(config.theme.spacing.md).toBe(16);
      expect(config.theme.spacing.lg).toBe(24);
      expect(config.theme.spacing.xl).toBe(32);
    });

    it('should have all feature flags defined', () => {
      expect(config.features.enableOfflineMode).toBe(true);
      expect(config.features.enablePushNotifications).toBe(true);
      expect(config.features.enableLocationTracking).toBe(true);
      expect(config.features.enableAnalytics).toBe(true);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', () => {
      expect(isFeatureEnabled('enableOfflineMode')).toBe(true);
      expect(isFeatureEnabled('enablePushNotifications')).toBe(true);
    });

    it('should return false for disabled features', () => {
      // Assuming social login is disabled by default
      expect(isFeatureEnabled('enableSocialLogin')).toBe(false);
    });
  });

  describe('getThemeColor', () => {
    it('should return correct color values', () => {
      expect(getThemeColor('primary')).toBe('#f4511e');
      expect(getThemeColor('error')).toBe('#e74c3c');
      expect(getThemeColor('success')).toBe('#4caf50');
    });
  });

  describe('getSpacing', () => {
    it('should return correct spacing values', () => {
      expect(getSpacing('xs')).toBe(4);
      expect(getSpacing('sm')).toBe(8);
      expect(getSpacing('md')).toBe(16);
      expect(getSpacing('lg')).toBe(24);
      expect(getSpacing('xl')).toBe(32);
    });
  });

  describe('updateConfig', () => {
    it('should update config values', () => {
      const originalAppName = config.appName;
      updateConfig({ appName: 'Updated App Name' });
      expect(config.appName).toBe('Updated App Name');
      
      // Restore for other tests
      updateConfig({ appName: originalAppName });
    });

    it('should update theme colors', () => {
      const originalPrimary = config.theme.colors.primary;
      updateConfig({
        theme: {
          ...config.theme,
          colors: {
            ...config.theme.colors,
            primary: '#ff0000',
          },
        },
      });
      expect(config.theme.colors.primary).toBe('#ff0000');
      
      // Restore
      updateConfig({
        theme: {
          ...config.theme,
          colors: {
            ...config.theme.colors,
            primary: originalPrimary,
          },
        },
      });
    });
  });
});
