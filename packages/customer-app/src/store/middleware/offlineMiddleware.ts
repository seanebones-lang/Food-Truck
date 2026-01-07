import { Middleware } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { enqueueAction } from '../slices/offlineQueueSlice';

// Actions that should be queued when offline
const OFFLINE_QUEUE_ACTIONS = [
  'orders/createOrder',
  'orders/updateOrder',
  'user/updateUser',
  'cart/submitOrder',
];

// Actions that should always go through (not queued)
const ALWAYS_ONLINE_ACTIONS = [
  'offlineQueue/sync',
  'connectivity/updateConnectivity',
];

export const offlineMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const state = store.getState();
  const isConnected = state.connectivity.isConnected;

  // Always allow connectivity and sync actions
  if (ALWAYS_ONLINE_ACTIONS.some((type) => action.type.includes(type))) {
    return next(action);
  }

  // If online, proceed normally
  if (isConnected) {
    return next(action);
  }

  // If offline and action should be queued
  if (OFFLINE_QUEUE_ACTIONS.some((type) => action.type.includes(type))) {
    // Determine priority based on action type
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (action.type.includes('order')) {
      priority = 'high'; // Orders are high priority
    } else if (action.type.includes('user')) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Queue the action
    store.dispatch(
      enqueueAction({
        type: action.type,
        payload: action.payload,
        priority,
        maxRetries: 3,
        metadata: {
          orderId: action.payload?.orderId || action.payload?.id,
          userId: state.user?.user?.id,
        },
      })
    );

    // Return a pending action to indicate it's queued
    return {
      ...action,
      meta: { ...action.meta, queued: true, offline: true },
    };
  }

  // For other actions, proceed normally (they might handle offline themselves)
  return next(action);
};
