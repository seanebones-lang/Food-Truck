import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { io } from 'socket.io-client';
import './LocationUpdate.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function LocationUpdate({ truckId = '1' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [socket, setSocket] = useState(null);
  const [trucks, setTrucks] = useState([]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      truckId: truckId,
      latitude: '',
      longitude: '',
      heading: '',
      speed: '',
    },
  });

  const watchedLatitude = watch('latitude');
  const watchedLongitude = watch('longitude');

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('truck:location:updated', (truck) => {
      console.log('Truck location updated via socket:', truck);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchTrucks();
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trucks`);
      const data = await response.json();
      if (data.success) {
        setTrucks(data.data);
      }
    } catch (error) {
      console.error('Error fetching trucks:', error);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const token = localStorage.getItem('auth_token'); // Get from your auth system

      const payload = {
        truckId: data.truckId,
        location: {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
        },
      };

      if (data.heading) {
        payload.heading = parseFloat(data.heading);
      }

      if (data.speed !== undefined && data.speed !== '') {
        payload.speed = parseFloat(data.speed);
      }

      const response = await fetch(`${API_BASE_URL}/api/trucks/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update truck location');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Reset form but keep truck ID
      reset({
        truckId: data.truckId,
        latitude: '',
        longitude: '',
        heading: '',
        speed: '',
      });
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          reset({
            ...watch(),
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          });
        },
        (error) => {
          alert('Error getting location: ' + error.message);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  return (
    <div className="location-update">
      <h2>Update Truck Location</h2>

      {error && <div className="error-message">{error}</div>}
      {success && (
        <div className="success-message">
          Location updated successfully! Real-time update sent.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="location-form">
        <div className="form-group">
          <label htmlFor="truckId">Truck ID *</label>
          <Controller
            name="truckId"
            control={control}
            rules={{ required: 'Truck ID is required' }}
            render={({ field }) => (
              <select {...field} id="truckId" className={errors.truckId ? 'error' : ''}>
                <option value="">Select a truck</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.name} ({truck.id})
                  </option>
                ))}
                <option value={truckId}>{truckId}</option>
              </select>
            )}
          />
          {errors.truckId && (
            <span className="field-error">{errors.truckId.message}</span>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="latitude">
              Latitude * (-90 to 90)
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="location-button"
              >
                Use Current
              </button>
            </label>
            <Controller
              name="latitude"
              control={control}
              rules={{
                required: 'Latitude is required',
                min: { value: -90, message: 'Latitude must be between -90 and 90' },
                max: { value: 90, message: 'Latitude must be between -90 and 90' },
              }}
              render={({ field }) => (
                <input
                  {...field}
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="37.7749"
                  className={errors.latitude ? 'error' : ''}
                />
              )}
            />
            {errors.latitude && (
              <span className="field-error">{errors.latitude.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="longitude">
              Longitude * (-180 to 180)
            </label>
            <Controller
              name="longitude"
              control={control}
              rules={{
                required: 'Longitude is required',
                min: { value: -180, message: 'Longitude must be between -180 and 180' },
                max: { value: 180, message: 'Longitude must be between -180 and 180' },
              }}
              render={({ field }) => (
                <input
                  {...field}
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="-122.4194"
                  className={errors.longitude ? 'error' : ''}
                />
              )}
            />
            {errors.longitude && (
              <span className="field-error">{errors.longitude.message}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="heading">Heading (0-360 degrees, optional)</label>
            <Controller
              name="heading"
              control={control}
              rules={{
                min: { value: 0, message: 'Heading must be between 0 and 360' },
                max: { value: 360, message: 'Heading must be between 0 and 360' },
              }}
              render={({ field }) => (
                <input
                  {...field}
                  id="heading"
                  type="number"
                  step="any"
                  placeholder="90"
                  className={errors.heading ? 'error' : ''}
                />
              )}
            />
            {errors.heading && (
              <span className="field-error">{errors.heading.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="speed">Speed (km/h, optional)</label>
            <Controller
              name="speed"
              control={control}
              rules={{
                min: { value: 0, message: 'Speed must be non-negative' },
              }}
              render={({ field }) => (
                <input
                  {...field}
                  id="speed"
                  type="number"
                  step="any"
                  placeholder="0"
                  className={errors.speed ? 'error' : ''}
                />
              )}
            />
            {errors.speed && (
              <span className="field-error">{errors.speed.message}</span>
            )}
          </div>
        </div>

        {watchedLatitude && watchedLongitude && (
          <div className="map-preview">
            <iframe
              width="100%"
              height="200"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${watchedLatitude},${watchedLongitude}`}
              allowFullScreen
            ></iframe>
            <small>Map preview (requires Google Maps API key)</small>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Updating...' : 'Update Location'}
          </button>
        </div>
      </form>

      <div className="trucks-list">
        <h3>Current Truck Locations</h3>
        {trucks.length === 0 ? (
          <p>No trucks found</p>
        ) : (
          <div className="trucks-grid">
            {trucks.map((truck) => (
              <div key={truck.id} className="truck-card">
                <h4>{truck.name}</h4>
                <p>
                  <strong>Location:</strong> {truck.location.latitude.toFixed(6)},{' '}
                  {truck.location.longitude.toFixed(6)}
                </p>
                {truck.heading !== undefined && (
                  <p>
                    <strong>Heading:</strong> {truck.heading}°
                  </p>
                )}
                {truck.speed !== undefined && (
                  <p>
                    <strong>Speed:</strong> {truck.speed} km/h
                  </p>
                )}
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={truck.isActive ? 'status-active' : 'status-inactive'}>
                    {truck.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
                <p className="last-updated">
                  Last updated: {new Date(truck.lastUpdated).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
