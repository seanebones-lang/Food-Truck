import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '@food-truck/shared';
import { authService } from '../services/authService';
import { storage } from '../utils/storage';
import { setSentryUser, clearSentryUser } from '../utils/sentry';
import { captureException } from '../utils/sentry';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  refreshUser: () => Promise<void>;
  setGuestMode: () => Promise<void>;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedUser = await storage.getUser();
      const isAuth = await authService.isAuthenticated();

      if (storedUser && isAuth) {
        setUser(storedUser);
        setIsGuest(false);
        setSentryUser(storedUser);
        // Optionally refresh user data from server
        try {
          const profile = await authService.getProfile();
          setUser(profile);
          setSentryUser(profile);
        } catch {
          // If refresh fails, use stored user
        }
      } else {
        setUser(null);
        setIsGuest(false);
        clearSentryUser();
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
      setIsGuest(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      if (response.success && response.user) {
        setUser(response.user);
        setIsGuest(false);
        setSentryUser(response.user);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      captureException(error instanceof Error ? error : new Error(message), {
        context: 'auth',
        action: 'login',
      });
      throw new Error(message);
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    try {
      const response = await authService.signup({ name, email, password, confirmPassword });
      if (response.success && response.user) {
        setUser(response.user);
        setIsGuest(false);
        setSentryUser(response.user);
      } else {
        throw new Error(response.message || 'Signup failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      captureException(error instanceof Error ? error : new Error(message), {
        context: 'auth',
        action: 'signup',
      });
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsGuest(false);
      clearSentryUser();
    } catch (error) {
      console.error('Logout error:', error);
      captureException(error instanceof Error ? error : new Error('Logout failed'), {
        context: 'auth',
        action: 'logout',
      });
      // Clear local state even if API call fails
      setUser(null);
      setIsGuest(false);
      clearSentryUser();
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<AuthUser>) => {
    try {
      const updatedUser = await authService.updateProfile(data);
      setUser(updatedUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      throw new Error(message);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authService.getProfile();
      setUser(profile);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  }, []);

  const setGuestMode = useCallback(async () => {
    await storage.clearAll();
    setUser(null);
    setIsGuest(true);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user && !isGuest,
    login,
    signup,
    logout,
    updateProfile,
    refreshUser,
    setGuestMode,
    isGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
