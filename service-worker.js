const CACHE_NAME = 'ledgent-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/service-worker.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  // Claim all clients immediately so the new SW takes control
  self.clients.claim();
});

// ============================================================
// CRITICAL: Never cache gateway WebSocket calls or API endpoints
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for any gateway WebSocket upgrades, API calls, or WS endpoints
  if (url.pathname.startsWith('/gateway') ||
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/ws') ||
      url.hostname.includes('gnani') ||
      url.pathname.includes('websocket')) {
    // Force network, no cache
    event.request = new Request(event.request.url, {
      cache: 'no-store',
      headers: {
        Pragma: 'no-cache',
        Cache-Control: 'no-cache, max-age=0',
      },
    });
    event.respondWith(fetch(event.request));
    return;
  }

  // For all other requests, use cache-first strategy with revalidation
  // but always refresh important resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response while fetching fresh version
        const fetchPromise = fetch(event.request).then((freshResponse) => {
          // Don't overwrite cache for non-JSON/html responses
          if (event.request.headers.get('accept').includes('text/html') ||
              event.request.headers.get('accept').includes('application/json')) {
            const cache = caches.open(CACHE_NAME);
            cache.put(event.request, freshResponse.clone());
          }
          return freshResponse;
        });

        return cachedResponse.headers.get('etag')
          ? { type: 'basic', inner: cachedResponse, overlay: fetchPromise }
          : { type: 'basic', inner: cachedResponse };
      }
      return fetch(event.request);
    })
  );
});