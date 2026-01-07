import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineQueueReducer } from './slices/offlineQueueSlice';
import { connectivityReducer } from './slices/connectivitySlice';
import { ordersReducer } from './slices/ordersSlice';
import { userReducer } from './slices/userSlice';
import { offlineMiddleware } from './middleware/offlineMiddleware';

// Persist configuration for critical data
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['orders', 'user', 'offlineQueue'], // Only persist critical data
  blacklist: ['connectivity'], // Don't persist connectivity state
};

// Persist configuration for offline queue (highest priority)
const queuePersistConfig = {
  key: 'offlineQueue',
  storage: AsyncStorage,
  whitelist: ['queue', 'syncState'],
};

const rootReducer = combineReducers({
  offlineQueue: persistReducer(queuePersistConfig, offlineQueueReducer),
  connectivity: connectivityReducer,
  orders: ordersReducer,
  user: userReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(offlineMiddleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
