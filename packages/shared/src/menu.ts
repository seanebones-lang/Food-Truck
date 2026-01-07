// Menu types and schemas
import { z } from 'zod';

export const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  stock: z.number().int().nonnegative('Stock must be non-negative').default(0),
  isAvailable: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

export const menuItemUpdateSchema = menuItemSchema.partial().extend({
  id: z.string(),
});

export type MenuItem = z.infer<typeof menuItemSchema> & { id: string };
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type MenuItemUpdate = z.infer<typeof menuItemUpdateSchema>;

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customizations?: CartItemCustomization[];
  specialInstructions?: string;
}

export interface CartItemCustomization {
  optionId: string;
  name: string;
  value: string;
  priceModifier?: number;
}

export interface MenuFilters {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
}

export const MENU_CATEGORIES = [
  'All',
  'Burgers',
  'Sides',
  'Drinks',
  'Desserts',
  'Specials',
] as const;

export type MenuCategory = typeof MENU_CATEGORIES[number];
