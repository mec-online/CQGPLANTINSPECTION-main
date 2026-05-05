import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

type GpsStatus = 'acquiring' | 'active' | 'denied' | 'unavailable';

interface GpsContextValue {
  position: GpsPosition | null;
  status: GpsStatus;
}

const GpsContext = createContext<GpsContextValue>({ position: null, status: 'acquiring' });

export function useGps() {
  return useContext(GpsContext);
}

export function GpsProvider({ children }: { children: ReactNode }) {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [status, setStatus] = useState<GpsStatus>('acquiring');
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setStatus('active');
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setStatus('denied');
        } else {
          setStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <GpsContext.Provider value={{ position, status }}>
      {children}
    </GpsContext.Provider>
  );
}
