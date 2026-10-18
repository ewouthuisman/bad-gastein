/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { focusOrOpen } from './features/push/notificationClick';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Map tiles, fonts and sprites: keep what people have looked at, so the map works without signal on the mountain.
registerRoute(
  ({ url }) => url.hostname === 'tiles.openfreemap.org' && !url.pathname.startsWith('/styles/'),
  new CacheFirst({ cacheName: 'map-tiles', plugins: [new ExpirationPlugin({ maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 60 })] }),
);
registerRoute(
  ({ url }) => url.hostname === 'tiles.openfreemap.org' && url.pathname.startsWith('/styles/'),
  new StaleWhileRevalidate({ cacheName: 'map-style' }),
);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

interface PushData {
  title: string;
  body: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let data: PushData = { title: 'Bad Gastein', body: '' };
  try {
    data = event.data?.json() as PushData;
  } catch {
    data.body = event.data?.text() ?? '';
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: data.url ?? './' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data as { url?: string })?.url ?? './', self.registration.scope).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => focusOrOpen(windows as WindowClient[], target, (u) => self.clients.openWindow(u))),
  );
});
