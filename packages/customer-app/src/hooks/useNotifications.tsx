import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationService';
import { io } from 'socket.io-client';
import type { NotificationPreferences } from '../services/notificationService';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    orderUpdates: true,
    promotions: true,
    truckNearby: true,
    orderReady: true,
  });
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Register for push notifications
    notificationService.registerForPushNotifications().then((token) => {
      setExpoPushToken(token);
    });

    // Load preferences
    notificationService.getPreferences().then(setPreferences);

    // Listen for notifications received while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification received:', notification);
      });

    // Listen for user tapping on notifications
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('Notification response:', response);
        const data = response.notification.request.content.data;

        // Handle different notification types
        if (data.type === 'order_ready') {
          // Navigate to order details
          console.log('Order ready:', data.orderId);
        } else if (data.type === 'order_status') {
          // Navigate to order status
          console.log('Order status update:', data.orderId, data.status);
        } else if (data.type === 'promo') {
          // Navigate to promo
          console.log('Promo notification:', data.promoId);
        }
      });

    // Set up Socket.io listeners for real-time notifications
    const socket = io(SOCKET_URL);

    socket.on('order:status:updated', async (data: { id: string; status: string }) => {
      const prefs = await notificationService.getPreferences();
      if (!prefs.orderUpdates) return;

      let title = 'Order Update';
      let body = `Order ${data.id} status: ${data.status}`;

      if (data.status === 'ready') {
        title = 'Order Ready! 🎉';
        body = `Your order ${data.id} is ready for pickup!`;
        await notificationService.scheduleOrderReadyNotification(data.id);
      } else if (data.status === 'preparing') {
        title = 'Order Being Prepared';
        body = `Your order ${data.id} is being prepared!`;
      } else if (data.status === 'completed') {
        title = 'Order Completed';
        body = `Thank you! Order ${data.id} has been completed.`;
      }

      await notificationService.scheduleLocalNotification(title, body, {
        type: 'order_status',
        orderId: data.id,
        status: data.status,
      });
    });

    socket.on('promo:alert', async (data: { title: string; message: string; promoId?: string }) => {
      await notificationService.schedulePromoNotification(data.title, data.message, {
        promoId: data.promoId,
      });
    });

    socket.on('truck:nearby', async (data: { truckName: string; distance: number }) => {
      const prefs = await notificationService.getPreferences();
      if (!prefs.truckNearby) return;

      await notificationService.scheduleLocalNotification(
        'Truck Nearby! 🚚',
        `${data.truckName} is ${data.distance.toFixed(1)}km away`,
        { type: 'truck_nearby', truckName: data.truckName }
      );
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      socket.close();
    };
  }, []);

  const updatePreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    await notificationService.updatePreferences(newPrefs);
    setPreferences((prev) => ({ ...prev, ...newPrefs }));
  };

  return {
    expoPushToken,
    preferences,
    updatePreferences,
  };
}
