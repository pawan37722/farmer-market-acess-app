// mobile/hooks/useLocation.js
// Tries to get live GPS location.
// If GPS is unavailable, denied, or times out —
// falls back to Jhanjeri, Mohali, Punjab (140307)

import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

// ── Default fallback — Jhanjeri, Mohali, Punjab 140307 ───────
const DEFAULT_LOCATION = {
  latitude:  30.7659,   // Jhanjeri, Mohali
  longitude: 76.6584,
  address:   'Jhanjeri, Mohali, Punjab 140307',
  isDefault: true,      // flag so UI can show "Using default location"
};

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      // Ask for permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        // Permission denied — use default
        console.log('Location permission denied — using Jhanjeri default');
        setLocation(DEFAULT_LOCATION);
        setLoading(false);
        return;
      }

      // Try to get GPS with a 8-second timeout
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('GPS timeout')), 8000)
        ),
      ]);

      // GPS success
      let address = '';
      try {
        const geo = await Location.reverseGeocodeAsync(loc.coords);
        if (geo.length > 0) {
          const g = geo[0];
          address = [g.street, g.city, g.region].filter(Boolean).join(', ');
        }
      } catch (_) {
        // Reverse geocode failed — use coords only
      }

      setLocation({
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
        address:   address || 'Current Location',
        isDefault: false,
      });

    } catch (err) {
      // GPS failed or timed out — use default
      console.log('GPS unavailable — using Jhanjeri default:', err.message);
      setLocation(DEFAULT_LOCATION);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    location,
    loading,
    error,
    refresh:        getLocation,
    isDefaultLocation: location?.isDefault === true,
  };
}
