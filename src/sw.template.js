// The cache id and asset list placeholders are filled in by the build (vite.config.js),
// so every deploy gets a fresh cache without bumping versions by hand.
const CACHE_NAME = 'atler-__BUILD_ID__';

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './apple-touch-icon.png',
  ...__ASSETS__,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(
        APP_SHELL.map(async asset => {
          try {
            await cache.add(asset);
          } catch (_) {
            // Skip failed optional precache entries instead of aborting install.
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isAppShellAsset(requestUrl) {
  return (
    requestUrl.pathname === '/' ||
    requestUrl.pathname.endsWith('.html') ||
    requestUrl.pathname.endsWith('.css') ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname.endsWith('.json')
  );
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io')
  ) {
    return;
  }

  if (!isSameOrigin(url)) {
    return;
  }

  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./offline.html')))
    );
    return;
  }

  if (isAppShellAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});

// Renewal reminders sent by supabase/functions/send-reminders.
self.addEventListener('push', event => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Atler', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Atler', {
      body: data.body || '',
      tag: data.tag,
      icon: './apple-touch-icon.png',
      badge: './apple-touch-icon.png',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(w => w.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow('./');
    })
  );
});
