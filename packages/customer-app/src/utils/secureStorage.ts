import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@food-truck/shared';
import type { AuthUser, AuthTokens } from '@food-truck/shared';

// Secure storage for sensitive tokens using expo-secure-store
export const secureTokenStorage = {
  // Token management
  async setTokens(tokens: AuthTokens): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
      SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    } catch {
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      return null;
    }
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN).catch(() => {}),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN).catch(() => {}),
    ]);
  },
};

// User data can use MMKV (less sensitive)
export const userStorage = {
  async setUser(user: AuthUser): Promise<void> {
    const { mmkvStorage } = await import('./mmkvStorage');
    mmkvStorage.mmkvStorage.set(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  async getUser(): Promise<AuthUser | null> {
    const { mmkvStorage } = await import('./mmkvStorage');
    const userStr = mmkvStorage.mmkvStorage.getString(STORAGE_KEYS.USER);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as AuthUser;
    } catch {
      return null;
    }
  },

  async clearUser(): Promise<void> {
    const { mmkvStorage } = await import('./mmkvStorage');
    mmkvStorage.mmkvStorage.delete(STORAGE_KEYS.USER);
  },
};