import { MMKV } from 'react-native-mmkv';

// Create MMKV instance for general storage
export const mmkvStorage = new MMKV({
  id: 'food-truck-storage',
  encryptionKey: 'food-truck-encryption-key', // In production, use a secure key from env
});

// Create MMKV instance for secure tokens (separate instance)
export const secureStorage = new MMKV({
  id: 'food-truck-secure',
  encryptionKey: 'food-truck-secure-key', // In production, use a secure key from env
});

// MMKV adapter for Redux Persist
export const mmkvStorageAdapter = {
  setItem: (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      mmkvStorage.set(key, value);
      resolve();
    });
  },
  getItem: (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const value = mmkvStorage.getString(key);
      resolve(value ?? null);
    });
  },
  removeItem: (key: string): Promise<void> => {
    return new Promise((resolve) => {
      mmkvStorage.delete(key);
      resolve();
    });
  },
};

// MMKV adapter for Zustand
export const mmkvZustandStorage = {
  setItem: (name: string, value: string): void => {
    mmkvStorage.set(name, value);
  },
  getItem: (name: string): string | null => {
    return mmkvStorage.getString(name) ?? null;
  },
  removeItem: (name: string): void => {
    mmkvStorage.delete(name);
  },
};