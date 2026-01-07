/**
 * Shared offline utilities for Redux Persist and sync actions
 */

import { z } from 'zod';

/**
 * Sync action types
 */
export enum SyncActionType {
  CREATE_ORDER = 'CREATE_ORDER',
  UPDATE_ORDER = 'UPDATE_ORDER',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  ADD_TO_CART = 'ADD_TO_CART',
  UPDATE_CART = 'UPDATE_CART',
  CLEAR_CART = 'CLEAR_CART',
}

/**
 * Sync action priority levels
 */
export enum SyncPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Sync action schema
 */
export const syncActionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(SyncActionType),
  payload: z.any(),
  timestamp: z.number(),
  priority: z.nativeEnum(SyncPriority),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
  metadata: z.record(z.any()).optional(),
});

export type SyncAction = z.infer<typeof syncActionSchema>;

/**
 * Offline queue state
 */
export interface OfflineQueueState {
  queue: SyncAction[];
  syncState: 'idle' | 'syncing' | 'error';
  lastSyncTime: number | null;
}

/**
 * Create a sync action
 */
export function createSyncAction(
  type: SyncActionType,
  payload: any,
  priority: SyncPriority = SyncPriority.MEDIUM,
  metadata?: Record<string, any>
): SyncAction {
  return {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    priority,
    retryCount: 0,
    maxRetries: 3,
    metadata,
  };
}

/**
 * Validate sync action
 */
export function validateSyncAction(action: unknown): action is SyncAction {
  try {
    syncActionSchema.parse(action);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get action priority based on type
 */
export function getActionPriority(type: SyncActionType): SyncPriority {
  switch (type) {
    case SyncActionType.CREATE_ORDER:
    case SyncActionType.UPDATE_ORDER:
      return SyncPriority.HIGH;
    case SyncActionType.UPDATE_PROFILE:
      return SyncPriority.MEDIUM;
    case SyncActionType.ADD_TO_CART:
    case SyncActionType.UPDATE_CART:
    case SyncActionType.CLEAR_CART:
      return SyncPriority.LOW;
    default:
      return SyncPriority.MEDIUM;
  }
}

/**
 * Redux Persist configuration helpers
 */
export interface PersistConfig {
  key: string;
  whitelist?: string[];
  blacklist?: string[];
  version?: number;
  migrate?: (state: any, version: number) => any;
}

/**
 * Default persist config for cart
 */
export const cartPersistConfig: PersistConfig = {
  key: 'cart',
  whitelist: ['items'],
  version: 1,
};

/**
 * Default persist config for menus
 */
export const menusPersistConfig: PersistConfig = {
  key: 'menus',
  whitelist: ['items', 'lastFetched'],
  version: 1,
};

/**
 * Default persist config for offline queue
 */
export const offlineQueuePersistConfig: PersistConfig = {
  key: 'offlineQueue',
  whitelist: ['queue', 'syncState'],
  version: 1,
};

/**
 * Merge persist configs
 */
export function mergePersistConfigs(
  ...configs: PersistConfig[]
): PersistConfig {
  return configs.reduce(
    (merged, config) => ({
      ...merged,
      ...config,
      whitelist: [...(merged.whitelist || []), ...(config.whitelist || [])],
      blacklist: [...(merged.blacklist || []), ...(config.blacklist || [])],
    }),
    {} as PersistConfig
  );
}

/**
 * Create persist transformer for specific data
 */
export function createPersistTransformer<T>(
  serialize: (value: T) => string,
  deserialize: (value: string) => T
) {
  return {
    in: (value: T) => serialize(value),
    out: (value: string) => deserialize(value),
  };
}

/**
 * Offline sync utilities
 */
export class OfflineSync {
  private queue: SyncAction[] = [];
  private syncState: 'idle' | 'syncing' | 'error' = 'idle';
  private lastSyncTime: number | null = null;

  /**
   * Add action to queue
   */
  enqueue(action: SyncAction): void {
    // Insert based on priority
    const priorityOrder = {
      [SyncPriority.HIGH]: 0,
      [SyncPriority.MEDIUM]: 1,
      [SyncPriority.LOW]: 2,
    };

    const insertIndex = this.queue.findIndex(
      (a) => priorityOrder[a.priority] > priorityOrder[action.priority]
    );

    if (insertIndex === -1) {
      this.queue.push(action);
    } else {
      this.queue.splice(insertIndex, 0, action);
    }
  }

  /**
   * Remove action from queue
   */
  dequeue(actionId: string): SyncAction | null {
    const index = this.queue.findIndex((a) => a.id === actionId);
    if (index >= 0) {
      return this.queue.splice(index, 1)[0];
    }
    return null;
  }

  /**
   * Get queue
   */
  getQueue(): SyncAction[] {
    return [...this.queue];
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get high priority actions
   */
  getHighPriorityActions(): SyncAction[] {
    return this.queue.filter((a) => a.priority === SyncPriority.HIGH);
  }

  /**
   * Set sync state
   */
  setSyncState(state: 'idle' | 'syncing' | 'error'): void {
    this.syncState = state;
    if (state === 'idle') {
      this.lastSyncTime = Date.now();
    }
  }

  /**
   * Get sync state
   */
  getSyncState(): 'idle' | 'syncing' | 'error' {
    return this.syncState;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number | null {
    return this.lastSyncTime;
  }
}

/**
 * Export singleton instance
 */
export const offlineSync = new OfflineSync();
