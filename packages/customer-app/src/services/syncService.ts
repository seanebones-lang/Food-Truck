import { store } from '../store';
import { RootState } from '../store';
import {
  dequeueAction,
  incrementRetry,
  setSyncState,
  addConflict,
  resolveConflict,
  enqueueAction,
  QueuedAction,
} from '../store/slices/offlineQueueSlice';
import { addOrder, markOrderSynced, updateOrder } from '../store/slices/ordersSlice';
import { updateUser } from '../store/slices/userSlice';
import { storage } from '../utils/storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface SyncResult {
  success: boolean;
  actionId: string;
  data?: any;
  error?: string;
  conflict?: {
    localData: any;
    serverData: any;
  };
}

class SyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  async syncQueue(): Promise<void> {
    const state = store.getState() as RootState;
    const { queue, syncState } = state.offlineQueue;
    const { isConnected } = state.connectivity;

    // Don't sync if already syncing, offline, or no items in queue
    if (this.isSyncing || syncState === 'syncing' || !isConnected || queue.length === 0) {
      return;
    }

    this.isSyncing = true;
    store.dispatch(setSyncState('syncing'));

    try {
      // Process queue in priority order
      const sortedQueue = [...queue].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      for (const queuedAction of sortedQueue) {
        await this.processAction(queuedAction);
      }
    } catch (error) {
      console.error('Sync error:', error);
      store.dispatch(setSyncState('error'));
    } finally {
      this.isSyncing = false;
      store.dispatch(setSyncState('idle'));
    }
  }

  /**
   * Calculate exponential backoff delay in milliseconds
   * Formula: baseDelay * (2 ^ retryCount) + jitter
   */
  private calculateBackoffDelay(retryCount: number, baseDelay: number = 1000): number {
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    // Add random jitter (0-500ms) to prevent thundering herd
    const jitter = Math.random() * 500;
    // Cap at 30 seconds max
    return Math.min(exponentialDelay + jitter, 30000);
  }

  private async processAction(action: QueuedAction): Promise<SyncResult> {
    try {
      const accessToken = await storage.getAccessToken();
      if (!accessToken) {
        // Skip actions that require auth if not authenticated
        store.dispatch(dequeueAction(action.id));
        return { success: false, actionId: action.id, error: 'Not authenticated' };
      }

      // Apply exponential backoff if this is a retry
      if (action.retryCount > 0) {
        const delay = this.calculateBackoffDelay(action.retryCount);
        console.log(`Waiting ${delay}ms before retry ${action.retryCount} for action ${action.id}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      let result: SyncResult;

      // Route action to appropriate handler
      if (action.type.includes('order')) {
        result = await this.syncOrderAction(action, accessToken);
      } else if (action.type.includes('user')) {
        result = await this.syncUserAction(action, accessToken);
      } else {
        // Generic sync
        result = await this.syncGenericAction(action, accessToken);
      }

      if (result.success) {
        store.dispatch(dequeueAction(action.id));
      } else if (result.conflict) {
        // Handle conflict
        store.dispatch(
          addConflict({
            actionId: action.id,
            localData: result.conflict.localData,
            serverData: result.conflict.serverData,
          })
        );
        // Don't dequeue - let user resolve conflict
      } else {
        // Retry logic with exponential backoff
        if (action.retryCount < action.maxRetries) {
          store.dispatch(incrementRetry(action.id));
          // The next sync attempt will apply the backoff delay
        } else {
          // Max retries reached, remove from queue
          store.dispatch(dequeueAction(action.id));
          console.warn(`Action ${action.id} failed after ${action.maxRetries} retries`);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error processing action ${action.id}:`, error);
      
      // Retry on network errors with exponential backoff
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (action.retryCount < action.maxRetries) {
          store.dispatch(incrementRetry(action.id));
        } else {
          store.dispatch(dequeueAction(action.id));
        }
      }
      
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async syncOrderAction(action: QueuedAction, token: string): Promise<SyncResult> {
    try {
      if (action.type.includes('createOrder')) {
        // Create order
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(action.payload),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Request failed' }));
          throw new Error(error.message || 'Failed to create order');
        }

        const data = await response.json();
        if (data.success) {
          // Update Redux store with server response
          store.dispatch(addOrder(data.data));
          if (action.metadata?.orderId) {
            store.dispatch(markOrderSynced(action.metadata.orderId));
          }
          return { success: true, actionId: action.id, data: data.data };
        }

        throw new Error(data.message || 'Failed to create order');
      } else if (action.type.includes('updateOrder')) {
        // Update order - check for conflicts
        const state = store.getState() as RootState;
        const localOrder = state.orders.orders.find(
          (o) => o.id === action.payload.id || o.localId === action.payload.id
        );

        // Fetch current server state
        const getResponse = await fetch(`${API_BASE_URL}/api/orders/${action.payload.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (getResponse.ok) {
          const serverData = await getResponse.json();
          const serverOrder = serverData.data;

          // Conflict detection: compare updatedAt timestamps
          if (
            localOrder &&
            serverOrder.updatedAt &&
            new Date(serverOrder.updatedAt) > new Date(localOrder.updatedAt)
          ) {
            // Server has newer version - conflict detected
            return {
              success: false,
              actionId: action.id,
              conflict: {
                localData: localOrder,
                serverData: serverOrder,
              },
            };
          }
        }

        // No conflict, proceed with update
        const response = await fetch(`${API_BASE_URL}/api/orders/${action.payload.id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: action.payload.status }),
        });

        if (response.ok) {
          const data = await response.json();
          store.dispatch(updateOrder(data.data));
          return { success: true, actionId: action.id, data: data.data };
        }

        throw new Error('Failed to update order');
      }

      return { success: false, actionId: action.id, error: 'Unknown order action' };
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async syncUserAction(action: QueuedAction, token: string): Promise<SyncResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(action.payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const data = await response.json();
      if (data.success) {
        store.dispatch(updateUser(data.data));
        return { success: true, actionId: action.id, data: data.data };
      }

      throw new Error(data.message || 'Failed to update user');
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async syncGenericAction(action: QueuedAction, token: string): Promise<SyncResult> {
    // Generic handler for other action types
    // This can be extended for other sync operations
    return {
      success: false,
      actionId: action.id,
      error: 'No handler for action type',
    };
  }

  resolveConflict(actionId: string, useServerData: boolean): void {
    const state = store.getState() as RootState;
    const conflict = state.offlineQueue.conflicts.find((c) => c.actionId === actionId);

    if (!conflict) {
      return;
    }

    if (useServerData) {
      // Use server data, update local state
      if (conflict.serverData.id) {
        store.dispatch(updateOrder(conflict.serverData));
      }
    } else {
      // Retry with local data
      const action = state.offlineQueue.queue.find((a) => a.id === actionId);
      if (action) {
        // Re-queue with higher priority
        store.dispatch(
          enqueueAction({
            type: action.type,
            payload: action.payload,
            priority: 'high',
            maxRetries: action.maxRetries,
            metadata: action.metadata,
          })
        );
      }
    }

    store.dispatch(resolveConflict(actionId));
  }

  startAutoSync(intervalMs: number = 30000): void {
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      const state = store.getState() as RootState;
      if (state.connectivity.isConnected) {
        this.syncQueue();
      }
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const syncService = new SyncService();
