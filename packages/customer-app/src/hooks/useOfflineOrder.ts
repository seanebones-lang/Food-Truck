import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './reduxHooks';
import { addOrder, markOrderPendingSync } from '../store/slices/ordersSlice';
import { useCartStore } from '../store/cartStore';
import { storage } from '../utils/storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Hook for creating orders with offline support
 * Automatically queues order creation when offline
 */
export function useOfflineOrder() {
  const dispatch = useAppDispatch();
  const { isConnected } = useAppSelector((state) => state.connectivity);
  const { items, getTotal, getSubtotal, getTax, clearCart } = useCartStore();

  const createOrder = useCallback(
    async (orderData: {
      deliveryAddress?: string;
      pickupLocation?: string;
      contactPhone?: string;
      specialInstructions?: string;
      paymentIntentId?: string;
    }) => {
      const orderItems = items.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        customizations: item.customizations,
        specialInstructions: item.specialInstructions,
      }));

      const orderPayload = {
        items: orderItems,
        ...orderData,
      };

      // If offline, create local order and queue for sync
      if (!isConnected) {
        const localOrder = {
          id: `local_${Date.now()}`,
          localId: `local_${Date.now()}`,
          userId: (await storage.getUser())?.id || 'guest',
          items: orderItems,
          subtotal: getSubtotal(),
          tax: getTax(),
          total: getTotal(),
          status: 'pending',
          paymentStatus: orderData.paymentIntentId ? 'processing' : 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPendingSync: true,
          ...orderData,
        };

        // Add to Redux store
        dispatch(addOrder(localOrder));
        dispatch(markOrderPendingSync(localOrder.localId!));

        // Queue action for sync
        dispatch({
          type: 'orders/createOrder',
          payload: orderPayload,
        });

        clearCart();
        return { success: true, data: localOrder, offline: true };
      }

      // If online, create order immediately
      try {
        const accessToken = await storage.getAccessToken();
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
          body: JSON.stringify(orderPayload),
        });

        const data = await response.json();

        if (data.success) {
          dispatch(addOrder(data.data));
          clearCart();
          return { success: true, data: data.data, offline: false };
        }

        throw new Error(data.message || 'Failed to create order');
      } catch (error) {
        // If request fails, queue for offline sync
        const localOrder = {
          id: `local_${Date.now()}`,
          localId: `local_${Date.now()}`,
          userId: (await storage.getUser())?.id || 'guest',
          items: orderItems,
          subtotal: getSubtotal(),
          tax: getTax(),
          total: getTotal(),
          status: 'pending',
          paymentStatus: orderData.paymentIntentId ? 'processing' : 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPendingSync: true,
          ...orderData,
        };

        dispatch(addOrder(localOrder));
        dispatch(markOrderPendingSync(localOrder.localId!));

        dispatch({
          type: 'orders/createOrder',
          payload: orderPayload,
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: localOrder,
          offline: true,
        };
      }
    },
    [items, getSubtotal, getTax, getTotal, clearCart, isConnected, dispatch]
  );

  return { createOrder };
}
