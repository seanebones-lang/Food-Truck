/**
 * useOfflineOrder Hook Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { useOfflineOrder } from '../useOfflineOrder';
import * as cartStoreModule from '../../store/cartStore';

jest.mock('../../store/cartStore');

describe('useOfflineOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useOfflineOrder());

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should submit order successfully', async () => {
    const mockSubmitOrder = jest.fn().mockResolvedValue({
      success: true,
      data: { id: 'order-1' },
    });

    // Mock implementation
    (global.fetch as jest.Mock) = mockSubmitOrder;

    const { result } = renderHook(() => useOfflineOrder());

    await act(async () => {
      await result.current.submitOrder();
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('should handle submission errors', async () => {
    const mockSubmitOrder = jest.fn().mockRejectedValue(
      new Error('Network error')
    );

    (global.fetch as jest.Mock) = mockSubmitOrder;

    const { result } = renderHook(() => useOfflineOrder());

    await act(async () => {
      await result.current.submitOrder();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isSubmitting).toBe(false);
  });
});
