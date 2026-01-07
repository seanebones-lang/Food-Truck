import type {
  LoginInput,
  SignupInput,
  LoginResponse,
  SignupResponse,
  RefreshTokenResponse,
  AuthUser,
} from '@food-truck/shared';
import { storage } from '../utils/storage';
import { measureAsync, trackApiRequest } from '../utils/performance';
import { captureException } from '../utils/sentry';

// For development, update this URL to match your server
// For Android emulator: use 'http://10.0.2.2:3001'
// For iOS simulator: use 'http://localhost:3001'
// For physical device: use your computer's local IP (e.g., 'http://192.168.1.100:3001')
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

class AuthService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const accessToken = await storage.getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const startTime = performance.now();
    let response;
    let duration = 0;
    
    try {
      const fetchStartTime = performance.now();
      response = await fetch(url, {
        ...options,
        headers,
      });
      duration = performance.now() - fetchStartTime;
      
      // Track API performance
      trackApiRequest(endpoint, duration, response.ok);
    } catch (fetchError) {
      duration = performance.now() - startTime;
      trackApiRequest(endpoint, duration, false);
      throw fetchError;
    }

    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry request with new token
        const newToken = await storage.getAccessToken();
        if (newToken) {
          headers.Authorization = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          if (!retryResponse.ok) {
            throw new Error('Request failed after token refresh');
          }
          return retryResponse.json();
        }
      }
      // If refresh failed, clear storage and throw
      await storage.clearAll();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      const errorMessage = error.message || 'Request failed';
      
      // Track API errors in Sentry
      if (response.status >= 500) {
        captureException(new Error(errorMessage), {
          context: 'api',
          endpoint,
          status: response.status,
        });
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.tokens) {
      await storage.setTokens(response.tokens);
      await storage.setUser(response.user);
    }

    return response;
  }

  async signup(data: SignupInput): Promise<SignupResponse> {
    const response = await this.request<SignupResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.tokens) {
      await storage.setTokens(response.tokens);
      await storage.setUser(response.user);
    }

    return response;
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await this.request<RefreshTokenResponse>(
        '/api/auth/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }
      );

      if (response.success && response.accessToken) {
        const tokens = {
          accessToken: response.accessToken,
          refreshToken, // Keep the same refresh token
        };
        await storage.setTokens(tokens);
        return true;
      }

      return false;
    } catch {
      await storage.clearAll();
      return false;
    }
  }

  async getProfile(): Promise<AuthUser> {
    return this.request<{ success: boolean; user: AuthUser }>('/api/auth/profile').then(
      (data) => data.user
    );
  }

  async updateProfile(data: Partial<AuthUser>): Promise<AuthUser> {
    const response = await this.request<{ success: boolean; user: AuthUser }>(
      '/api/auth/profile',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (response.success && response.user) {
      await storage.setUser(response.user);
    }

    return response.user;
  }

  async logout(): Promise<void> {
    await storage.clearAll();
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await storage.getAccessToken();
    return !!token;
  }
}

export const authService = new AuthService();
