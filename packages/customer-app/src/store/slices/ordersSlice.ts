import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Order {
  id: string;
  userId: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  isPendingSync?: boolean;
  localId?: string; // For offline-created orders
}

interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  lastFetched: number | null;
}

const initialState: OrdersState = {
  orders: [],
  currentOrder: null,
  lastFetched: null,
};

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action: PayloadAction<Order[]>) => {
      state.orders = action.payload;
      state.lastFetched = Date.now();
    },
    addOrder: (state, action: PayloadAction<Order>) => {
      // Check if order already exists (by id or localId)
      const existingIndex = state.orders.findIndex(
        (o) => o.id === action.payload.id || o.localId === action.payload.localId
      );

      if (existingIndex >= 0) {
        // Update existing order (conflict resolution)
        state.orders[existingIndex] = action.payload;
      } else {
        state.orders.push(action.payload);
      }
    },
    updateOrder: (state, action: PayloadAction<Partial<Order> & { id: string }>) => {
      const index = state.orders.findIndex((o) => o.id === action.payload.id || o.localId === action.payload.id);
      if (index >= 0) {
        state.orders[index] = { ...state.orders[index], ...action.payload };
      }
    },
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
    },
    markOrderPendingSync: (state, action: PayloadAction<string>) => {
      const order = state.orders.find((o) => o.id === action.payload || o.localId === action.payload);
      if (order) {
        order.isPendingSync = true;
      }
    },
    markOrderSynced: (state, action: PayloadAction<string>) => {
      const order = state.orders.find((o) => o.id === action.payload || o.localId === action.payload);
      if (order) {
        order.isPendingSync = false;
        delete order.localId; // Remove local ID after successful sync
      }
    },
  },
});

export const {
  setOrders,
  addOrder,
  updateOrder,
  setCurrentOrder,
  markOrderPendingSync,
  markOrderSynced,
} = ordersSlice.actions;

export default ordersSlice.reducer;
