/**
 * Central Configuration System
 * Supports client-specific tweaks, themes, and feature flags
 */

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    error: string;
    success: string;
    warning: string;
    border: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
}

export interface FeatureFlags {
  enableOfflineMode: boolean;
  enablePushNotifications: boolean;
  enableLocationTracking: boolean;
  enableAnalytics: boolean;
  enableSocialLogin: boolean;
  enableGuestCheckout: boolean;
  enablePromotions: boolean;
  enableReviews: boolean;
}

export interface ClientConfig {
  clientId: string;
  clientName: string;
  version: string;
  apiBaseUrl: string;
  socketUrl: string;
  theme: ThemeConfig;
  features: FeatureFlags;
  appName: string;
  supportEmail: string;
  termsUrl?: string;
  privacyUrl?: string;
}

// Default theme
const defaultTheme: ThemeConfig = {
  colors: {
    primary: '#f4511e',
    secondary: '#666',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#333333',
    textSecondary: '#666666',
    error: '#e74c3c',
    success: '#4caf50',
    warning: '#ff9800',
    border: '#e0e0e0',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    fontFamily: 'System',
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
    },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
};

// Default feature flags
const defaultFeatures: FeatureFlags = {
  enableOfflineMode: true,
  enablePushNotifications: true,
  enableLocationTracking: true,
  enableAnalytics: true,
  enableSocialLogin: false,
  enableGuestCheckout: true,
  enablePromotions: true,
  enableReviews: false,
};

// Client-specific configurations
const clientConfigs: Record<string, Partial<ClientConfig>> = {
  default: {
    clientId: 'default',
    clientName: 'Food Truck',
    version: '1.0.0',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001',
    appName: 'Food Truck App',
    supportEmail: 'support@foodtruck.com',
    theme: defaultTheme,
    features: defaultFeatures,
  },
  premium: {
    clientId: 'premium',
    clientName: 'Food Truck Premium',
    version: '2.0.0',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001',
    appName: 'Food Truck Premium',
    supportEmail: 'premium@foodtruck.com',
    theme: {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        primary: '#9c27b0',
        secondary: '#673ab7',
      },
    },
    features: {
      ...defaultFeatures,
      enableSocialLogin: true,
      enableReviews: true,
      enableAnalytics: true,
    },
  },
  enterprise: {
    clientId: 'enterprise',
    clientName: 'Food Truck Enterprise',
    version: '3.0.0',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001',
    appName: 'Food Truck Enterprise',
    supportEmail: 'enterprise@foodtruck.com',
    theme: {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        primary: '#1976d2',
        secondary: '#424242',
      },
    },
    features: {
      ...defaultFeatures,
      enableSocialLogin: true,
      enableReviews: true,
      enableAnalytics: true,
      enablePromotions: false, // Enterprise might disable promotions
    },
  },
};

// Get current client ID from environment or default
const getClientId = (): string => {
  return process.env.EXPO_PUBLIC_CLIENT_ID || 'default';
};

// Merge config with defaults
const mergeConfig = (clientId: string): ClientConfig => {
  const clientConfig = clientConfigs[clientId] || clientConfigs.default;
  const defaultConfig = clientConfigs.default as ClientConfig;

  return {
    ...defaultConfig,
    ...clientConfig,
    theme: {
      ...defaultConfig.theme,
      ...clientConfig.theme,
      colors: {
        ...defaultConfig.theme.colors,
        ...clientConfig.theme?.colors,
      },
      spacing: {
        ...defaultConfig.theme.spacing,
        ...clientConfig.theme?.spacing,
      },
      typography: {
        ...defaultConfig.theme.typography,
        ...clientConfig.theme?.typography,
        fontSize: {
          ...defaultConfig.theme.typography.fontSize,
          ...clientConfig.theme?.typography?.fontSize,
        },
      },
      borderRadius: {
        ...defaultConfig.theme.borderRadius,
        ...clientConfig.theme?.borderRadius,
      },
    },
    features: {
      ...defaultConfig.features,
      ...clientConfig.features,
    },
  };
};

// Export current config
export const config: ClientConfig = mergeConfig(getClientId());

// Helper to check if feature is enabled
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return config.features[feature] ?? false;
};

// Helper to get theme color
export const getThemeColor = (color: keyof ThemeConfig['colors']): string => {
  return config.theme.colors[color];
};

// Helper to get spacing
export const getSpacing = (size: keyof ThemeConfig['spacing']): number => {
  return config.theme.spacing[size];
};

// Type-safe config access
export const getConfig = (): ClientConfig => config;

// Runtime config update (for testing or dynamic config)
export const updateConfig = (updates: Partial<ClientConfig>): void => {
  Object.assign(config, updates);
};
