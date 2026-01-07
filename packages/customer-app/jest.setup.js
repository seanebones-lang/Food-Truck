import '@testing-library/jest-native/extend-expect';

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  const storage = new Map();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key, value) => storage.set(key, value)),
      getString: jest.fn((key) => storage.get(key) ?? null),
      getNumber: jest.fn((key) => {
        const val = storage.get(key);
        return val ? Number(val) : undefined;
      }),
      getBoolean: jest.fn((key) => {
        const val = storage.get(key);
        return val === 'true' || val === true;
      }),
      delete: jest.fn((key) => storage.delete(key)),
      clearAll: jest.fn(() => storage.clear()),
      getAllKeys: jest.fn(() => Array.from(storage.keys())),
    })),
  };
});

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock AsyncStorage for backward compatibility (if still used anywhere)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock storage utilities
jest.mock('./src/utils/storage', () => ({
  storage: {
    getAccessToken: jest.fn(() => Promise.resolve(null)),
    getRefreshToken: jest.fn(() => Promise.resolve(null)),
    setTokens: jest.fn(() => Promise.resolve()),
    clearTokens: jest.fn(() => Promise.resolve()),
    clearAll: jest.fn(() => Promise.resolve()),
    getUser: jest.fn(() => Promise.resolve(null)),
    setUser: jest.fn(() => Promise.resolve()),
    clearUser: jest.fn(() => Promise.resolve()),
  },
  userStorage: {
    getUser: jest.fn(() => Promise.resolve(null)),
    setUser: jest.fn(() => Promise.resolve()),
    clearUser: jest.fn(() => Promise.resolve()),
  },
}));

// Mock Expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  requestBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    })
  ),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() =>
    Promise.resolve({ data: 'mock-push-token' })
  ),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-notification-id')),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock Socket.io
jest.mock('socket.io-client', () => {
  return jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    off: jest.fn(),
    close: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    id: 'mock-socket-id',
    connected: true,
  }));
});

// Mock react-native-fast-image
jest.mock('react-native-fast-image', () => ({
  __esModule: true,
  default: require('react-native').Image,
  resizeMode: {
    contain: 'contain',
    cover: 'cover',
    stretch: 'stretch',
    center: 'center',
  },
  priority: {
    low: 'low',
    normal: 'normal',
    high: 'high',
  },
}));

// Mock i18n
jest.mock('./src/i18n/config', () => ({
  __esModule: true,
  default: {
    language: 'en',
    changeLanguage: jest.fn(),
    t: (key, options) => {
      if (options) {
        return `${key} ${JSON.stringify(options)}`;
      }
      return key;
    },
  },
  isRTL: jest.fn(() => false),
  getTextDirection: jest.fn(() => 'ltr'),
}));

// Global test utilities
global.__DEV__ = true;
