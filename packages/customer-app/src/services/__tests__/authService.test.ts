import { AuthService } from '../authService';
import { storage } from '../../utils/storage';

// Mock storage
jest.mock('../../utils/storage', () => ({
  storage: {
    getAccessToken: jest.fn(),
    setAccessToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clearAll: jest.fn(),
    getUser: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('AuthService', () => {
  let authService: AuthService;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await authService.login('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.data?.user.email).toBe('test@example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should fail with invalid credentials', async () => {
      const mockResponse = {
        success: false,
        message: 'Invalid email or password',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockResponse,
      } as Response);

      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow();
    });
  });

  describe('signup', () => {
    it('should signup successfully with valid data', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'new@example.com', name: 'New User' },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await authService.signup({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(result.success).toBe(true);
      expect(result.data?.user.email).toBe('new@example.com');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token',
        },
      };

      // Mock storage methods that might be used
      (storage as any).getRefreshToken = jest.fn().mockResolvedValueOnce('refresh-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await authService.refreshToken();

      expect(result).toBe(true);
      expect(storage.setAccessToken).toHaveBeenCalledWith('new-access-token');
    });

    it('should fail when refresh token is missing', async () => {
      (storage as any).getRefreshToken = jest.fn().mockResolvedValueOnce(null);

      const result = await authService.refreshToken();

      expect(result).toBe(false);
    });
  });
});
