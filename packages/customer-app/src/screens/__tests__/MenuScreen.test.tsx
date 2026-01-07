/**
 * MenuScreen Component Tests
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { MenuScreen } from '../MenuScreen';

// Mock dependencies
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User' },
    isAuthenticated: true,
  }),
}));

jest.mock('../../store/cartStore', () => ({
  useCartStore: () => ({
    items: [],
    addItem: jest.fn(),
    getTotal: () => 0,
  }),
}));

global.fetch = jest.fn();

describe('MenuScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'menu-1',
            name: 'Burger',
            price: 10.99,
            category: 'Food',
            isAvailable: true,
          },
        ],
      }),
    });
  });

  it('should render menu items', async () => {
    const { getByText } = render(<MenuScreen />);

    await waitFor(() => {
      expect(getByText('Burger')).toBeTruthy();
    });
  });

  it('should handle menu item selection', async () => {
    const { getByText } = render(<MenuScreen />);

    await waitFor(() => {
      expect(getByText('Burger')).toBeTruthy();
    });

    // Test item selection would go here
  });

  it('should handle loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { getByTestId } = render(<MenuScreen />);
    
    // Should show loading indicator
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('should handle error state', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { getByText } = render(<MenuScreen />);

    await waitFor(() => {
      // Should show error message
      expect(getByText(/error/i)).toBeTruthy();
    });
  });
});
