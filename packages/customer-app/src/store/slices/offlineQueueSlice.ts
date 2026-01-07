import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SyncActionType, SyncPriority, createSyncAction, getActionPriority } from '@food-truck/shared';

export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
  metadata?: {
    orderId?: string;
    userId?: string;
    [key: string]: any;
  };
}

interface OfflineQueueState {
  queue: QueuedAction[];
  syncState: 'idle' | 'syncing' | 'error';
  lastSyncTime: number | null;
  conflicts: Array<{
    actionId: string;
    localData: any;
    serverData: any;
    timestamp: number;
  }>;
}

const initialState: OfflineQueueState = {
  queue: [],
  syncState: 'idle',
  lastSyncTime: null,
  conflicts: [],
};

export const offlineQueueSlice = createSlice({
  name: 'offlineQueue',
  initialState,
  reducers: {
    enqueueAction: (state, action: PayloadAction<Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>>) => {
      const queuedAction: QueuedAction = {
        ...action.payload,
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: action.payload.maxRetries || 3,
      };

      // Insert based on priority (high priority first)
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const insertIndex = state.queue.findIndex(
        (action) => priorityOrder[action.priority] > priorityOrder[queuedAction.priority]
      );

      if (insertIndex === -1) {
        state.queue.push(queuedAction);
      } else {
        state.queue.splice(insertIndex, 0, queuedAction);
      }
    },
    dequeueAction: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((action) => action.id !== action.payload);
    },
    incrementRetry: (state, action: PayloadAction<string>) => {
      const actionToRetry = state.queue.find((a) => a.id === action.payload);
      if (actionToRetry) {
        actionToRetry.retryCount += 1;
      }
    },
    setSyncState: (state, action: PayloadAction<'idle' | 'syncing' | 'error'>) => {
      state.syncState = action.payload;
      if (action.payload === 'idle') {
        state.lastSyncTime = Date.now();
      }
    },
    addConflict: (
      state,
      action: PayloadAction<{
        actionId: string;
        localData: any;
        serverData: any;
      }>
    ) => {
      state.conflicts.push({
        ...action.payload,
        timestamp: Date.now(),
      });
    },
    resolveConflict: (state, action: PayloadAction<string>) => {
      state.conflicts = state.conflicts.filter((conflict) => conflict.actionId !== action.payload);
    },
    clearQueue: (state) => {
      state.queue = [];
    },
  },
});

export const {
  enqueueAction,
  dequeueAction,
  incrementRetry,
  setSyncState,
  addConflict,
  resolveConflict,
  clearQueue,
} = offlineQueueSlice.actions;

export default offlineQueueSlice.reducer;
