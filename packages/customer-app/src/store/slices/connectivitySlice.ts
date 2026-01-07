import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface ConnectivityState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string | null;
  details: any;
  lastChecked: number | null;
}

const initialState: ConnectivityState = {
  isConnected: false,
  isInternetReachable: false,
  type: null,
  details: null,
  lastChecked: null,
};

export const connectivitySlice = createSlice({
  name: 'connectivity',
  initialState,
  reducers: {
    updateConnectivity: (state, action: PayloadAction<NetInfoState>) => {
      state.isConnected = action.payload.isConnected ?? false;
      state.isInternetReachable = action.payload.isInternetReachable ?? false;
      state.type = action.payload.type;
      state.details = action.payload.details;
      state.lastChecked = Date.now();
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      state.lastChecked = Date.now();
    },
  },
});

export const { updateConnectivity, setConnected } = connectivitySlice.actions;

export default connectivitySlice.reducer;
