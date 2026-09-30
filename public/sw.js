const CACHE_NAME = 'bustiempo-v2';
const API_CACHE_NAME = 'bustiempo-api-v2';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/bus-icon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first with cache fallback for APIs, Cache-first with background revalidate for assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // API Requests: Network first, fall back to cached API response when offline
  if (url.pathname.startsWith('/api/transit/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
              // Also cache base paths so offline queries with different lat/lng or radius still match
              if (url.pathname === '/api/transit/barcelona/stops') {
                cache.put('/api/transit/barcelona/stops', copy.clone());
              }
              if (url.pathname === '/api/transit/barcelona/lines') {
                cache.put('/api/transit/barcelona/lines', copy.clone());
              }
            });
          }
          return response;
        })
        .catch(() => {
          // Device is completely offline: return cached API response if available
          return caches.open(API_CACHE_NAME).then(async (cache) => {
            // 1. Try exact URL match
            const exactMatch = await cache.match(event.request);
            if (exactMatch) return exactMatch;

            // 2. Try base path match (e.g. /api/transit/barcelona/stops without query parameters)
            if (url.pathname.startsWith('/api/transit/barcelona/stops')) {
              const baseStops = await cache.match('/api/transit/barcelona/stops');
              if (baseStops) return baseStops;
            }
            if (url.pathname.startsWith('/api/transit/barcelona/lines')) {
              const baseLines = await cache.match('/api/transit/barcelona/lines');
              if (baseLines) return baseLines;
            }

            // 3. Search all cached API responses for a matching endpoint prefix
            const keys = await cache.keys();
            for (const key of keys) {
              const keyUrl = new URL(key.url);
              if (keyUrl.pathname === url.pathname) {
                const match = await cache.match(key);
                if (match) return match;
              }
            }

            return new Response(
              JSON.stringify({
                offline: true,
                success: false,
                message: 'Modo sin conexión: datos en caché no encontrados para esta solicitud.',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        })
    );
    return;
  }

  // Static Assets and app shell: Cache-first with background revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/');
        });
    })
  );
});

// Push notification event (incoming push from server / Web Push API)
self.addEventListener('push', (event) => {
  let data = {
    title: '🚌 BusTiempo Barcelona',
    body: 'Alerta de proximidad de transporte público.',
    icon: '/bus-icon.svg',
    tag: 'bustiempo-proximity',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/bus-icon.svg',
    badge: '/bus-icon.svg',
    vibrate: [250, 100, 250, 100, 350],
    tag: data.tag || 'bustiempo-proximity',
    renotify: true,
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Ver en Mapa 🗺️' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Message event: allows client app to trigger background push notifications and scheduled alerts via Service Worker
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notificationOptions = {
      icon: '/bus-icon.svg',
      badge: '/bus-icon.svg',
      vibrate: [250, 100, 250, 100, 350],
      tag: options?.tag || 'bustiempo-proximity-alert',
      renotify: true,
      actions: [
        { action: 'open', title: 'Ver en Mapa 🗺️' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
      ...options,
    };

    event.waitUntil(self.registration.showNotification(title, notificationOptions));
  }

  // Schedule a background alert outside the app after delayMs (even if app is in background or closed)
  if (event.data.type === 'SCHEDULE_BACKGROUND_ALERT' || event.data.type === 'TEST_BACKGROUND_PUSH') {
    const { title, options, delayMs = 5000 } = event.data;
    const notificationOptions = {
      body: options?.body || 'Alerta de autobús en tiempo real desde el Service Worker.',
      icon: '/bus-icon.svg',
      badge: '/bus-icon.svg',
      vibrate: [300, 150, 300, 150, 450],
      tag: options?.tag || `bustiempo-bg-${Date.now()}`,
      renotify: true,
      data: options?.data || '/',
      actions: [
        { action: 'open', title: 'Abrir BusTiempo 🚌' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
      ...options,
    };

    // Keep service worker alive until alert fires
    const waitPromise = new Promise((resolve) => {
      setTimeout(async () => {
        try {
          await self.registration.showNotification(title || '🚌 BusTiempo - Alerta en Segundo Plano', notificationOptions);
        } catch (e) {
          console.error('[SW] Error showing scheduled notification:', e);
        }
        resolve();
      }, Math.max(500, delayMs));
    });

    event.waitUntil(waitPromise);
  }
});

// Notification click event: focus existing tab or open new window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
