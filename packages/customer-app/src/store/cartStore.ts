import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  MenuItem,
  CartItem,
  CartItemCustomization,
} from '@food-truck/shared';
import { cartPersistConfig } from '@food-truck/shared';

interface CartStore {
  items: CartItem[];
  addItem: (
    menuItem: MenuItem,
    quantity?: number,
    customizations?: CartItemCustomization[],
    specialInstructions?: string
  ) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateItemCustomizations: (
    menuItemId: string,
    customizations: CartItemCustomization[]
  ) => void;
  updateItemInstructions: (menuItemId: string, instructions: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getSubtotal: () => number;
  getTax: (taxRate?: number) => number;
  getItemCount: () => number;
  getItemQuantity: (menuItemId: string) => number;
  validateStock: (menuItemId: string, quantity: number) => Promise<boolean>;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (
        menuItem: MenuItem,
        quantity = 1,
        customizations?: CartItemCustomization[],
        specialInstructions?: string
      ) => {
        const items = get().items;
        const existingItemIndex = items.findIndex(
          (item) =>
            item.menuItem.id === menuItem.id &&
            JSON.stringify(item.customizations || []) ===
              JSON.stringify(customizations || [])
        );

        if (existingItemIndex >= 0) {
          // Update existing item with same customizations
          set({
            items: items.map((item, index) =>
              index === existingItemIndex
                ? {
                    ...item,
                    quantity: item.quantity + quantity,
                    specialInstructions:
                      specialInstructions || item.specialInstructions,
                  }
                : item
            ),
          });
        } else {
          // Add new item
          set({
            items: [
              ...items,
              {
                menuItem,
                quantity,
                customizations: customizations || [],
                specialInstructions,
              },
            ],
          });
        }
      },

      removeItem: (menuItemId: string) => {
        set({
          items: get().items.filter((item) => item.menuItem.id !== menuItemId),
        });
      },

      updateQuantity: (menuItemId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }

        set({
          items: get().items.map((item) =>
            item.menuItem.id === menuItemId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      updateItemCustomizations: (
        menuItemId: string,
        customizations: CartItemCustomization[]
      ) => {
        set({
          items: get().items.map((item) =>
            item.menuItem.id === menuItemId
              ? { ...item, customizations }
              : item
          ),
        });
      },

      updateItemInstructions: (menuItemId: string, instructions: string) => {
        set({
          items: get().items.map((item) =>
            item.menuItem.id === menuItemId
              ? { ...item, specialInstructions: instructions }
              : item
          ),
        });
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          const itemPrice = item.menuItem.price;
          const customizationTotal =
            item.customizations?.reduce(
              (sum, custom) => sum + (custom.priceModifier || 0),
              0
            ) || 0;
          return total + (itemPrice + customizationTotal) * item.quantity;
        }, 0);
      },

      getTax: (taxRate = 0.08) => {
        // Default 8% tax
        return get().getSubtotal() * taxRate;
      },

      getTotal: (taxRate = 0.08) => {
        const subtotal = get().getSubtotal();
        const tax = subtotal * taxRate;
        return subtotal + tax;
      },

      validateStock: async (menuItemId: string, quantity: number) => {
        try {
          const API_BASE_URL =
            process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
          const response = await fetch(`${API_BASE_URL}/api/menus/${menuItemId}`);
          const data = await response.json();

          if (data.success && data.data) {
            const menuItem = data.data;
            const currentQuantity = get().getItemQuantity(menuItemId);
            const requestedTotal = currentQuantity + quantity;

            return (
              menuItem.isAvailable &&
              menuItem.stock >= requestedTotal
            );
          }

          return false;
        } catch (error) {
          console.error('Error validating stock:', error);
          return false;
        }
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },

      getItemQuantity: (menuItemId: string) => {
        const item = get().items.find((item) => item.menuItem.id === menuItemId);
        return item ? item.quantity : 0;
      },
    }),
    {
      name: cartPersistConfig.key,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        // Only persist items (as per whitelist in config)
        return { items: state.items };
      },
    }
  )
);
