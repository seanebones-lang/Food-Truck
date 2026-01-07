/**
 * Shared offline utilities for Redux Persist and sync actions
 * JavaScript version for compatibility
 */

/**
 * Sync action types
 */
export const SyncActionType = {
  CREATE_ORDER: 'CREATE_ORDER',
  UPDATE_ORDER: 'UPDATE_ORDER',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  ADD_TO_CART: 'ADD_TO_CART',
  UPDATE_CART: 'UPDATE_CART',
  CLEAR_CART: 'CLEAR_CART',
};

/**
 * Sync action priority levels
 */
export const SyncPriority = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Create a sync action
 */
export function createSyncAction(type, payload, priority = SyncPriority.MEDIUM, metadata = {}) {
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
 * Get action priority based on type
 */
export function getActionPriority(type) {
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
export const cartPersistConfig = {
  key: 'cart',
  whitelist: ['items'],
  version: 1,
};

export const menusPersistConfig = {
  key: 'menus',
  whitelist: ['items', 'lastFetched'],
  version: 1,
};

export const offlineQueuePersistConfig = {
  key: 'offlineQueue',
  whitelist: ['queue', 'syncState'],
  version: 1,
};

/**
 * Offline sync queue manager
 */
export class OfflineSync {
  constructor() {
    this.queue = [];
    this.syncState = 'idle';
    this.lastSyncTime = null;
  }

  enqueue(action) {
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

  dequeue(actionId) {
    const index = this.queue.findIndex((a) => a.id === actionId);
    if (index >= 0) {
      return this.queue.splice(index, 1)[0];
    }
    return null;
  }

  getQueue() {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
  }

  getQueueSize() {
    return this.queue.length;
  }

  getHighPriorityActions() {
    return this.queue.filter((a) => a.priority === SyncPriority.HIGH);
  }

  setSyncState(state) {
    this.syncState = state;
    if (state === 'idle') {
      this.lastSyncTime = Date.now();
    }
  }

  getSyncState() {
    return this.syncState;
  }

  getLastSyncTime() {
    return this.lastSyncTime;
  }
}

/**
 * Export singleton instance
 */
export const offlineSync = new OfflineSync();
