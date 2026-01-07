import { mmkvStorage } from './mmkvStorage';
import type { Truck } from '@food-truck/shared';

const CACHE_KEY = '@trucks_location_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  trucks: Truck[];
  timestamp: number;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
}

export const locationCache = {
  async save(trucks: Truck[], userLocation?: { latitude: number; longitude: number }) {
    try {
      const data: CachedData = {
        trucks,
        timestamp: Date.now(),
        userLocation,
      };
      mmkvStorage.mmkvStorage.set(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving location cache:', error);
    }
  },

  async get(): Promise<{ trucks: Truck[]; userLocation?: { latitude: number; longitude: number } } | null> {
    try {
      const cached = mmkvStorage.mmkvStorage.getString(CACHE_KEY) ?? null;
      if (!cached) return null;

      const data: CachedData = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      // Return cached data if still fresh
      if (age < CACHE_EXPIRY) {
        return {
          trucks: data.trucks,
          userLocation: data.userLocation,
        };
      }

      // Cache expired
      mmkvStorage.mmkvStorage.delete(CACHE_KEY);
      return null;
    } catch (error) {
      console.error('Error reading location cache:', error);
      return null;
    }
  },

  async clear() {
    try {
      mmkvStorage.mmkvStorage.delete(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing location cache:', error);
    }
  },
};
