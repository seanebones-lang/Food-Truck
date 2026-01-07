import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { useNotifications } from '../hooks/useNotifications';

export function NotificationSettingsScreen() {
  const { preferences, updatePreferences } = useNotifications();

  const togglePreference = async (key: keyof typeof preferences, value: boolean) => {
    await updatePreferences({ [key]: value });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>
        <Text style={styles.sectionDescription}>
          Choose what notifications you want to receive
        </Text>
      </View>

      <View style={styles.preferenceItem}>
        <View style={styles.preferenceContent}>
          <Text style={styles.preferenceTitle}>Order Updates</Text>
          <Text style={styles.preferenceDescription}>
            Get notified when your order status changes
          </Text>
        </View>
        <Switch
          value={preferences.orderUpdates}
          onValueChange={(value) => togglePreference('orderUpdates', value)}
        />
      </View>

      <View style={styles.preferenceItem}>
        <View style={styles.preferenceContent}>
          <Text style={styles.preferenceTitle}>Order Ready</Text>
          <Text style={styles.preferenceDescription}>
            Notify me when my order is ready for pickup
          </Text>
        </View>
        <Switch
          value={preferences.orderReady}
          onValueChange={(value) => togglePreference('orderReady', value)}
        />
      </View>

      <View style={styles.preferenceItem}>
        <View style={styles.preferenceContent}>
          <Text style={styles.preferenceTitle}>Promotions & Deals</Text>
          <Text style={styles.preferenceDescription}>
            Receive special offers and promotional alerts
          </Text>
        </View>
        <Switch
          value={preferences.promotions}
          onValueChange={(value) => togglePreference('promotions', value)}
        />
      </View>

      <View style={styles.preferenceItem}>
        <View style={styles.preferenceContent}>
          <Text style={styles.preferenceTitle}>Truck Nearby</Text>
          <Text style={styles.preferenceDescription}>
            Get alerts when a food truck is nearby
          </Text>
        </View>
        <Switch
          value={preferences.truckNearby}
          onValueChange={(value) => togglePreference('truckNearby', value)}
        />
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          💡 Notifications are personalized based on your preferences and activity.
          You can change these settings anytime.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  preferenceContent: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoSection: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    margin: 20,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
