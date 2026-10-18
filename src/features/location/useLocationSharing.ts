import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { haversineM } from '../../lib/geo';
import { useAuth } from '../../auth/AuthProvider';

export interface MyPosition {
  lat: number;
  lng: number;
  accuracy: number;
  at: Date;
}

export interface LocationSharing {
  position: MyPosition | null;
  lastSent: Date | null;
  error: string | null;
  shareNow: () => Promise<void>;
}

const SEND_EVERY_MS = 30_000;
const SEND_AFTER_MOVE_M = 25;

/** Shares the user's position while the app is open and visible (a PWA gets no background GPS). */
export function useLocationSharing(): LocationSharing {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [position, setPosition] = useState<MyPosition | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ pos: MyPosition; sentAt: number } | null>(null);
  const latest = useRef<MyPosition | null>(null);

  const send = useCallback(
    (pos: MyPosition) => {
      if (!userId) return;
      const sentAt = Date.now();
      last.current = { pos, sentAt };
      setLastSent(new Date(sentAt));
      void supabase
        .from('locations')
        .upsert({ user_id: userId, lat: pos.lat, lng: pos.lng, accuracy_m: pos.accuracy, updated_at: new Date(sentAt).toISOString() })
        .then(({ error: err }) => setError(err ? 'Locatie delen mislukt' : null));
    },
    [userId],
  );

  const onFix = useCallback(
    (p: GeolocationPosition) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: new Date() };
      latest.current = pos;
      setPosition(pos);
      const prev = last.current;
      if (!prev || Date.now() - prev.sentAt >= SEND_EVERY_MS || haversineM(prev.pos, pos) >= SEND_AFTER_MOVE_M) send(pos);
    },
    [send],
  );

  useEffect(() => {
    if (!userId || !('geolocation' in navigator)) return;
    let watchId: number | null = null;
    const onError = (e: GeolocationPositionError) =>
      setError(e.code === e.PERMISSION_DENIED ? 'Geen toestemming voor locatie' : 'Locatie niet beschikbaar');
    const start = () => {
      if (watchId === null) watchId = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 10_000 });
    };
    const stop = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(() => {
      const prev = last.current;
      if (watchId !== null && latest.current && prev && Date.now() - prev.sentAt >= SEND_EVERY_MS) send(latest.current);
    }, 5_000);
    return () => {
      stop();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, onFix, send]);

  const shareNow = useCallback(
    () =>
      new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: new Date() };
            latest.current = pos;
            setPosition(pos);
            send(pos);
            resolve();
          },
          () => {
            setError('Locatie niet beschikbaar');
            resolve();
          },
          { enableHighAccuracy: true, timeout: 15_000 },
        );
      }),
    [send],
  );

  return { position, lastSent, error, shareNow };
}
