/**
 * SyncService Unit Tests
 * 
 * Tests for offline sync functionality
 */

import { SyncService } from '../syncService';
import * as storeModule from '../../store';
import * as authServiceModule from '../authService';

// Mock dependencies
jest.mock('../../store', () => ({
  store: {
    getState: jest.fn(),
    dispatch: jest.fn(),
  },
}));

jest.mock('../authService', () => ({
  getAuthToken: jest.fn(),
}));

global.fetch = jest.fn();

describe('SyncService', () => {
  let syncService: SyncService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    syncService = new SyncService();
    
    // Default mocks
    (authServiceModule.getAuthToken as jest.Mock).mockResolvedValue('mock-token');
    (storeModule.store.getState as jest.Mock).mockReturnValue({
      offlineQueue: {
        queue: [],
      },
    });
  });

  describe('startSync', () => {
    it('should start sync when online', async () => {
      const mockQueue = [
        {
          id: '1',
          type: 'CREATE_ORDER',
          payload: { items: [] },
          timestamp: Date.now(),
          priority: 'high',
          retryCount: 0,
          maxRetries: 3,
        },
      ];

      (storeModule.store.getState as jest.Mock).mockReturnValue({
        offlineQueue: {
          queue: mockQueue,
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await syncService.startSync();

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should not sync if already syncing', async () => {
      // Start first sync
      syncService.startSync();
      
      // Try to start second sync
      const result = await syncService.startSync();
      
      expect(result).toBeUndefined();
    });
  });

  describe('processAction', () => {
    it('should process CREATE_ORDER action successfully', async () => {
      const action = {
        id: '1',
        type: 'CREATE_ORDER' as const,
        payload: {
          items: [
            {
              menuItemId: 'menu-1',
              quantity: 2,
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high' as const,
        retryCount: 0,
        maxRetries: 3,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'order-1' },
        }),
      });

      const result = await (syncService as any).processAction(action);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    it('should retry on network error', async () => {
      const action = {
        id: '1',
        type: 'CREATE_ORDER' as const,
        payload: {},
        timestamp: Date.now(),
        priority: 'high' as const,
        retryCount: 0,
        maxRetries: 3,
      };

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const result = await (syncService as any).processAction(action);

      // Should have retried
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopSync', () => {
    it('should stop ongoing sync', () => {
      syncService.startSync();
      syncService.stopSync();

      expect((syncService as any).isSyncing).toBe(false);
    });
  });
});
