/// <reference lib="webworker" />
// The service worker: keeps the app shell offline, shows reminders pushed by
// send-reminders-v2, and opens the plan a notification is about.
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.addEventListener('install', () => { void self.skipWaiting(); });
// v1's worker kept its files in caches named atler-<build>; v2 replaces it at
// the same sw.js, so those are dropped here.
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('atler-')).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

interface PushPayload { title: string; body: string; tag?: string; planId?: string }

self.addEventListener('push', event => {
  let data: PushPayload;
  try {
    data = event.data?.json() as PushPayload;
  } catch {
    data = { title: 'ATLER', body: event.data?.text() ?? '' };
  }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { planId: data.planId },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const planId = (event.notification.data as { planId?: string } | null)?.planId;
  const target = new URL(planId ? `./#/plan/${planId}` : './', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(w => w.url.startsWith(self.registration.scope));
    if (open) {
      await open.navigate(target);
      await open.focus();
    } else {
      await self.clients.openWindow(target);
    }
  })());
});
