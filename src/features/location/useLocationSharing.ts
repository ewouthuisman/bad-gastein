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
  /** Resolves true when the position was stored; false on failure (see `error`). */
  shareNow: () => Promise<boolean>;
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
    async (pos: MyPosition): Promise<boolean> => {
      if (!userId) return false;
      const sentAt = Date.now();
      last.current = { pos, sentAt };
      setLastSent(new Date(sentAt));
      const { error: err } = await supabase
        .from('locations')
        .upsert({ user_id: userId, lat: pos.lat, lng: pos.lng, accuracy_m: pos.accuracy, updated_at: new Date(sentAt).toISOString() });
      setError(err ? 'Locatie delen mislukt' : null);
      return !err;
    },
    [userId],
  );

  const onFix = useCallback(
    (p: GeolocationPosition) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: new Date() };
      latest.current = pos;
      setPosition(pos);
      const prev = last.current;
      if (!prev || Date.now() - prev.sentAt >= SEND_EVERY_MS || haversineM(prev.pos, pos) >= SEND_AFTER_MOVE_M) void send(pos);
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
      if (watchId !== null && latest.current && prev && Date.now() - prev.sentAt >= SEND_EVERY_MS) void send(latest.current);
    }, 5_000);
    return () => {
      stop();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, onFix, send]);

  const shareNow = useCallback(async (): Promise<boolean> => {
    if (!('geolocation' in navigator)) {
      setError('Locatie niet beschikbaar');
      return false;
    }
    const getFix = (opts: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
    let fix: GeolocationPosition;
    try {
      // A cold GPS fix can take long (indoors, in a PWA); fall back to a coarse or cached fix.
      fix = await getFix({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }).catch((e: GeolocationPositionError) => {
        if (e.code === e.PERMISSION_DENIED) throw e;
        return getFix({ enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 });
      });
    } catch (e) {
      const err = e as GeolocationPositionError;
      setError(err.code === err.PERMISSION_DENIED ? 'Geen toestemming voor locatie' : 'Locatie niet beschikbaar');
      return false;
    }
    const pos = { lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy, at: new Date() };
    latest.current = pos;
    setPosition(pos);
    return send(pos);
  }, [send]);

  return { position, lastSent, error, shareNow };
}
