import { useEffect, useRef } from 'react';

/**
 * Calls `cb` when the app returns to the foreground or the network comes back. Phones drop the
 * realtime connection in the background and missed changes are not replayed, so data must be reloaded.
 */
export function useOnResume(cb: () => void) {
  const latest = useRef(cb);
  latest.current = cb;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const onOnline = () => latest.current();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);
}
