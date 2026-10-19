import type { BusData } from '../features/nav/bus';

// Shipped with the app and precached by the service worker, like the ski graph. Without it the bus switch just hides.
let busPromise: Promise<BusData | null> | null = null;

export function loadBus(): Promise<BusData | null> {
  busPromise ??= fetch('./data/bus.json')
    .then((r) => (r.ok ? (r.json() as Promise<BusData>) : null))
    .catch(() => null);
  return busPromise;
}
