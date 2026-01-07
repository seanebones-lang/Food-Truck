/**
 * Expo app configuration with environment-specific settings
 */

module.exports = ({ config }) => {
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  const isProduction = env === 'production';

  return {
    ...config,
    name: isProduction ? 'Food Truck App' : `Food Truck App (${env})`,
    slug: 'food-truck-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: isProduction
        ? 'com.foodtruck.app'
        : `com.foodtruck.app.${env}`,
      buildNumber: process.env.EAS_BUILD_NUMBER || '1',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: isProduction
        ? 'com.foodtruck.app'
        : `com.foodtruck.app.${env}`,
      versionCode: parseInt(process.env.EAS_BUILD_NUMBER || '1', 10),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#ffffff',
        },
      ],
      [
        'sentry-expo',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        },
      ],
    ],
    extra: {
      env,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      eas: {
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
  };
};
