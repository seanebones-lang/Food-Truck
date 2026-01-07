import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import type { Truck, Coordinate } from '@food-truck/shared';
import { locationCache } from '../utils/locationCache';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001';
const GPS_UPDATE_INTERVAL = 30000; // 30 seconds
const LOCATION_UPDATE_THROTTLE = 5000; // 5 seconds minimum between updates

const { width, height } = Dimensions.get('window');

interface MapScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
  };
}

export const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const mapRef = useRef<MapView>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const locationWatchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const requestLocationPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to show nearby food trucks. Please enable it in your settings.',
          [{ text: 'OK' }]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }, []);

  const fetchNearbyTrucks = useCallback(async (latitude: number, longitude: number) => {
    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: '10', // 10km radius
        limit: '50',
      });

      const response = await fetch(`${API_BASE_URL}/api/trucks/nearby?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setTrucks(data.data);
        // Cache the results
        await locationCache.save(data.data, { latitude, longitude });
      }
    } catch (error) {
      console.error('Error fetching nearby trucks:', error);
      // Try to load from cache if online fetch fails
      const cached = await locationCache.get();
      if (cached && cached.trucks.length > 0) {
        setTrucks(cached.trucks);
        Alert.alert(
          'Offline Mode',
          'Showing cached truck locations. Some data may be outdated.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    const now = Date.now();
    
    // Throttle location updates
    if (now - lastLocationUpdateRef.current < LOCATION_UPDATE_THROTTLE) {
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: Coordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      lastLocationUpdateRef.current = now;

      // Fetch nearby trucks
      await fetchNearbyTrucks(coords.latitude, coords.longitude);

      // Center map on user location
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...coords,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Unable to get your location');
    }
  }, [fetchNearbyTrucks]);

  const watchLocation = useCallback(async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: GPS_UPDATE_INTERVAL,
          distanceInterval: 100, // Update every 100 meters
        },
        async (location) => {
          const now = Date.now();
          // Throttle updates
          if (now - lastLocationUpdateRef.current < LOCATION_UPDATE_THROTTLE) {
            return;
          }

          const coords: Coordinate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setUserLocation(coords);
          lastLocationUpdateRef.current = now;

          // Update nearby trucks periodically
          if (now % (GPS_UPDATE_INTERVAL * 2) < LOCATION_UPDATE_THROTTLE) {
            await fetchNearbyTrucks(coords.latitude, coords.longitude);
          }
        }
      );

      locationWatchSubscriptionRef.current = subscription;
    } catch (error) {
      console.error('Error watching location:', error);
    }
  }, [fetchNearbyTrucks]);

  useEffect(() => {
    let socket: any = null;

    const initializeLocation = async () => {
      // Check for cached data first
      const cached = await locationCache.get();
      if (cached && cached.trucks.length > 0) {
        setTrucks(cached.trucks);
        if (cached.userLocation) {
          setUserLocation(cached.userLocation);
        }
        setLoading(false);
      }

      // Request permissions
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        await getCurrentLocation();
        await watchLocation();
      } else {
        setLoading(false);
      }

      // Set up Socket.io for real-time updates
      socket = io(SOCKET_URL);

      socket.on('truck:location:updated', (truck: Truck) => {
        setTrucks((prevTrucks) => {
          const index = prevTrucks.findIndex((t) => t.id === truck.id);
          if (index >= 0) {
            const updated = [...prevTrucks];
            updated[index] = truck;
            return updated;
          }
          return prevTrucks;
        });
      });

      socket.on('trucks:updated', (data: { trucks: Truck[] }) => {
        if (userLocation) {
          // Filter to nearby trucks
          fetchNearbyTrucks(userLocation.latitude, userLocation.longitude);
        }
      });
    };

    initializeLocation();

    return () => {
      if (locationWatchSubscriptionRef.current) {
        locationWatchSubscriptionRef.current.remove();
      }
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const handleTruckPress = (truck: Truck) => {
    setSelectedTruck(truck);
  };

  const handleCenterOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f4511e" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (permissionStatus === 'denied') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Location permission denied</Text>
        <Text style={styles.errorSubtext}>
          Please enable location permissions in your device settings to see nearby food trucks.
        </Text>
      </View>
    );
  }

  const initialRegion = userLocation || {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {trucks.map((truck) => (
          <Marker
            key={truck.id}
            coordinate={truck.location}
            title={truck.name}
            description={
              truck.estimatedWaitTime
                ? `Est. wait: ${truck.estimatedWaitTime} min`
                : undefined
            }
            onPress={() => handleTruckPress(truck)}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker}>
                <Text style={styles.markerText}>🚚</Text>
              </View>
              {truck.distance !== undefined && (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>
                    {truck.distance.toFixed(1)}km
                  </Text>
                </View>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      {selectedTruck && (
        <View style={styles.truckInfo}>
          <Text style={styles.truckName}>{selectedTruck.name}</Text>
          {selectedTruck.driverName && (
            <Text style={styles.truckDriver}>Driver: {selectedTruck.driverName}</Text>
          )}
          {selectedTruck.estimatedWaitTime && (
            <Text style={styles.waitTime}>
              Est. Wait: {selectedTruck.estimatedWaitTime} min
            </Text>
          )}
          {selectedTruck.schedule && (
            <Text style={styles.schedule}>
              Schedule: {selectedTruck.schedule.startTime} - {selectedTruck.schedule.endTime}
            </Text>
          )}
          {selectedTruck.distance !== undefined && (
            <Text style={styles.distance}>
              Distance: {selectedTruck.distance.toFixed(1)} km
            </Text>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedTruck(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.centerButton} onPress={handleCenterOnUser}>
        <Text style={styles.centerButtonText}>📍</Text>
      </TouchableOpacity>

      <View style={styles.legend}>
        <Text style={styles.legendText}>
          {trucks.length} truck{trucks.length !== 1 ? 's' : ''} nearby
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4511e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  markerText: {
    fontSize: 20,
  },
  distanceBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  distanceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  truckInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  truckName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  truckDriver: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  waitTime: {
    fontSize: 14,
    color: '#f4511e',
    fontWeight: '600',
    marginBottom: 4,
  },
  schedule: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  distance: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  closeButton: {
    backgroundColor: '#f4511e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  centerButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  centerButtonText: {
    fontSize: 24,
  },
  legend: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
