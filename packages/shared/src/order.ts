// Order types and schemas
import { z } from 'zod';
import type { MenuItem } from './menu';

export interface OrderCustomization {
  optionId: string;
  name: string;
  value: string;
  priceModifier?: number;
}

export interface CartItemCustomization {
  optionId: string;
  name: string;
  value: string;
  priceModifier?: number;
}

export const orderItemSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().positive('Quantity must be positive'),
  customizations: z.array(
    z.object({
      optionId: z.string(),
      name: z.string(),
      value: z.string(),
      priceModifier: z.number().optional(),
    })
  ).default([]),
  specialInstructions: z.string().optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  deliveryAddress: z.string().optional(),
  pickupLocation: z.string().optional(),
  contactPhone: z.string().optional(),
  specialInstructions: z.string().optional(),
  paymentIntentId: z.string().optional(),
});

export interface OrderItem {
  menuItemId: string;
  menuItem?: MenuItem;
  quantity: number;
  price: number;
  customizations?: CartItemCustomization[];
  specialInstructions?: string;
}

export interface Order {
  id: string;
  userId?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  deliveryAddress?: string;
  pickupLocation?: string;
  contactPhone?: string;
  paymentIntentId?: string;
  paymentStatus: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  createdAt: string;
  updatedAt: string;
}

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
