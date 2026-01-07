/**
 * useSocket Hook Tests
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useSocket } from '../useSocket';
import { io } from 'socket.io-client';

jest.mock('socket.io-client');

describe('useSocket', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  it('should connect to socket on mount', () => {
    renderHook(() => useSocket('http://localhost:3001'));

    expect(io).toHaveBeenCalledWith('http://localhost:3001', expect.any(Object));
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useSocket('http://localhost:3001'));

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should handle socket events', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    // Simulate socket event
    const orderCreatedCallback = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'order:created'
    )?.[1];

    if (orderCreatedCallback) {
      orderCreatedCallback({ id: 'order-1' });
    }

    expect(mockSocket.on).toHaveBeenCalledWith(
      'order:created',
      expect.any(Function)
    );
  });
});
