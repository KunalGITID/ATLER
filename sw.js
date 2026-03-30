// Atler Service Worker — Cache-first for static assets, network-first for Supabase API
const CACHE_NAME = 'atler-v1';

// Assets to pre-cache on install (shell of the app)
const STATIC_ASSETS = [
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  // Supabase client — biggest perf offender, cache it
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
];

// ── Install: pre-cache the app shell ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Take control immediately, don't wait for old SW to die
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  // Take control of all open pages immediately
  self.clients.claim();
});

// ── Fetch: strategy depends on request type ───────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for:
  // 1. Supabase API calls
  // 2. Auth requests
  // 3. POST/PATCH/DELETE mutations
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    event.request.method !== 'GET'
  ) {
    return; // Let browser handle it normally
  }

  // Google Fonts / CDN: cache-first, long-lived
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Only cache valid responses
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // App shell files (HTML, CSS, JS): cache-first, update in background (stale-while-revalidate)
  if (
    url.hostname === self.location.hostname &&
    (url.pathname.endsWith('.html') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.json') ||
     url.pathname === '/')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached); // If offline, fall back to cache

        // Return cached version immediately, update cache in background
        return cached || networkFetch;
      })
    );
    return;
  }
});
