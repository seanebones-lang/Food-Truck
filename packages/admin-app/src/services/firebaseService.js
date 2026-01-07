import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { io } from 'socket.io-client';

// Firebase config (replace with your config)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'your-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-auth-domain',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-storage-bucket',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'your-app-id',
};

let messaging = null;
let fcmToken = null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize messaging if supported
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
});

export const firebaseService = {
  async requestPermission() {
    if (!messaging) {
      console.warn('Firebase messaging not supported');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'your-vapid-key',
        });

        if (token) {
          fcmToken = token;
          await this.registerToken(token);
          return token;
        }
      }
      return null;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return null;
    }
  },

  async registerToken(token) {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const authToken = localStorage.getItem('auth_token');
      
      await fetch(`${API_BASE_URL}/api/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({
          pushToken: token,
          platform: 'web',
        }),
      });
    } catch (error) {
      console.error('Error registering FCM token:', error);
    }
  },

  onMessage(callback) {
    if (!messaging) return () => {};

    return onMessage(messaging, (payload) => {
      callback(payload);
    });
  },

  getToken() {
    return fcmToken;
  },
};
