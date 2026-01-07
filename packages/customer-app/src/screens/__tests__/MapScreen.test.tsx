/**
 * MapScreen Component Tests
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { MapScreen } from '../MapScreen';

// Mock dependencies
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 37.7749, longitude: -122.4194 },
    })
  ),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID="map" {...props} />,
    Marker: (props: any) => <View testID="marker" {...props} />,
  };
});

global.fetch = jest.fn();

describe('MapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'truck-1',
            name: 'Test Truck',
            location: { latitude: 37.7749, longitude: -122.4194 },
            isActive: true,
          },
        ],
      }),
    });
  });

  it('should render map component', async () => {
    const { getByTestId } = render(<MapScreen />);
    
    await waitFor(() => {
      expect(getByTestId('map')).toBeTruthy();
    });
  });

  it('should request location permissions', async () => {
    const { requestForegroundPermissionsAsync } = require('expo-location');
    
    render(<MapScreen />);
    
    await waitFor(() => {
      expect(requestForegroundPermissionsAsync).toHaveBeenCalled();
    });
  });

  it('should fetch and display nearby trucks', async () => {
    const { queryAllByTestId } = render(<MapScreen />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/trucks/nearby')
      );
    });
  });
});
