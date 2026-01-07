import { useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAppDispatch, useAppSelector } from './reduxHooks';
import { updateConnectivity } from '../store/slices/connectivitySlice';
import { syncService } from '../services/syncService';

export function useConnectivity() {
  const dispatch = useAppDispatch();
  const { isConnected, isInternetReachable } = useAppSelector((state) => state.connectivity);

  useEffect(() => {
    // Initial connectivity check
    NetInfo.fetch().then((state) => {
      dispatch(updateConnectivity(state));
    });

    // Subscribe to connectivity changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      dispatch(updateConnectivity(state));

      // When connection is restored, trigger sync
      if (state.isConnected && state.isInternetReachable) {
        console.log('Connection restored, syncing queued actions...');
        syncService.syncQueue();
      }
    });

    // Start auto-sync when online
    if (isConnected) {
      syncService.startAutoSync(30000); // Sync every 30 seconds
    }

    return () => {
      unsubscribe();
      syncService.stopAutoSync();
    };
  }, [dispatch, isConnected]);

  return {
    isConnected,
    isInternetReachable,
  };
}
