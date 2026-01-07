import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { resolveConflict } from '../store/slices/offlineQueueSlice';
import { syncService } from '../services/syncService';

export function ConflictResolutionModal() {
  const dispatch = useAppDispatch();
  const { conflicts } = useAppSelector((state) => state.offlineQueue);
  const visible = conflicts.length > 0;
  const conflict = conflicts[0]; // Show first conflict

  if (!conflict) {
    return null;
  }

  const handleResolve = (useServerData: boolean) => {
    syncService.resolveConflict(conflict.actionId, useServerData);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Data Conflict Detected</Text>
          <Text style={styles.description}>
            The server has a different version of this data. Which version would you like to keep?
          </Text>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Local Version</Text>
              <Text style={styles.data}>
                {JSON.stringify(conflict.localData, null, 2)}
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.localButton]}
                onPress={() => handleResolve(false)}
              >
                <Text style={styles.buttonText}>Use Local Version</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Server Version</Text>
              <Text style={styles.data}>
                {JSON.stringify(conflict.serverData, null, 2)}
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.serverButton]}
                onPress={() => handleResolve(true)}
              >
                <Text style={styles.buttonText}>Use Server Version</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  content: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  data: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#666',
    marginBottom: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  localButton: {
    backgroundColor: '#f4511e',
  },
  serverButton: {
    backgroundColor: '#4caf50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
