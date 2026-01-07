import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { mmkvStorage } from '../utils/mmkvStorage';
import { storage } from '../utils/storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  truckNearby: boolean;
  orderReady: boolean;
}

const PREFERENCES_KEY = '@notification_preferences';

class NotificationService {
  private expoPushToken: string | null = null;
  private lastNotificationTime: { [key: string]: number } = {};
  private readonly RATE_LIMIT_MS = 5000; // 5 seconds between same type notifications

  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Must use physical device for Push Notifications');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      this.expoPushToken = tokenData.data;
      
      // Register token with backend
      await this.registerTokenWithBackend(tokenData.data);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Order Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('promotions', {
          name: 'Promotions',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      return tokenData.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const accessToken = await storage.getAccessToken();
      if (!accessToken) return;

      await fetch(`${API_BASE_URL}/api/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ pushToken: token, platform: Platform.OS }),
      });
    } catch (error) {
      console.error('Error registering token with backend:', error);
    }
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    channelId: string = 'default'
  ): Promise<void> {
    // Rate limiting check
    const notificationKey = `${title}-${body}`;
    const now = Date.now();
    if (
      this.lastNotificationTime[notificationKey] &&
      now - this.lastNotificationTime[notificationKey] < this.RATE_LIMIT_MS
    ) {
      console.log('Notification rate limited:', notificationKey);
      return;
    }

    this.lastNotificationTime[notificationKey] = now;

    // Check user preferences
    const prefs = await this.getPreferences();
    if (title.includes('Order') && !prefs.orderUpdates) return;
    if (title.includes('Promo') && !prefs.promotions) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
  }

  async schedulePromoNotification(
    title: string,
    body: string,
    promoData?: any
  ): Promise<void> {
    const prefs = await this.getPreferences();
    if (!prefs.promotions) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'promo', ...promoData },
        sound: true,
      },
      trigger: null,
    });
  }

  async scheduleOrderReadyNotification(orderId: string): Promise<void> {
    const prefs = await this.getPreferences();
    if (!prefs.orderReady) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Order Ready! 🎉',
        body: `Your order ${orderId} is ready for pickup!`,
        data: { type: 'order_ready', orderId },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  }

  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const prefs = mmkvStorage.mmkvStorage.getString(PREFERENCES_KEY);
      if (prefs) {
        return JSON.parse(prefs);
      }
      // Default preferences
      return {
        orderUpdates: true,
        promotions: true,
        truckNearby: true,
        orderReady: true,
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return {
        orderUpdates: true,
        promotions: true,
        truckNearby: true,
        orderReady: true,
      };
    }
  }

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...prefs };
      mmkvStorage.mmkvStorage.set(PREFERENCES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }
}

export const notificationService = new NotificationService();
