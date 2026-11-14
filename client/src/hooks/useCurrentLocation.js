import { useCallback, useState } from 'react';

function locationErrorMessage(error) {
  if (error.code === 1) return 'Location access was denied. Allow it in your browser settings, or choose a city or enter coordinates.';
  if (error.code === 2) return 'Your device could not determine your location. Check its location services and try again.';
  if (error.code === 3) return 'The location request timed out. Check your connection and device location settings, then try again.';
  return 'Your location is unavailable. Choose a city or enter coordinates instead.';
}

export default function useCurrentLocation() {
  const [state, setState] = useState({ status: 'idle', error: '', location: null });

  const requestLocation = useCallback(async () => {
    setState({ status: 'loading', error: '', location: null });

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({
        status: 'error',
        error: 'This browser does not support location access. Choose a city or enter coordinates instead.',
        location: null,
      });
      return null;
    }

    if (typeof window !== 'undefined' && window.isSecureContext === false
      && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
      setState({
        status: 'error',
        error: 'Location access requires a secure HTTPS connection. Choose a city or enter coordinates instead.',
        location: null,
      });
      return null;
    }

    try {
      const location = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
          reject,
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
        );
      });
      setState({ status: 'success', error: '', location });
      return location;
    } catch (error) {
      setState({ status: 'error', error: locationErrorMessage(error), location: null });
      return null;
    }
  }, []);

  return { ...state, requestLocation };
}
