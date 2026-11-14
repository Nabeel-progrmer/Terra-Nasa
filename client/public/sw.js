const CACHE_NAME = 'terra-shell-v7';
const APP_SHELL = [
  '/', '/offline.html', '/manifest.webmanifest', '/icon.svg',
  '/icon-192.svg', '/icon-512.svg', '/icon-192.png', '/icon-512.png',
  '/icon-192-maskable.svg', '/icon-512-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const shellResponses = await Promise.all(APP_SHELL.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`Unable to cache app shell resource: ${url}`);
      await cache.put(url, response.clone());
      return { url, response };
    }));

    // Precache the app entry and the first route's lazy chunk dependency graph so
    // the application can start offline after its initial online visit.
    const index = shellResponses.find(({ url }) => url === '/').response;
    const html = await index.text();
    const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)]
      .map((match) => new URL(match[1], self.location.origin).href)
      .filter((url) => new URL(url).origin === self.location.origin);
    await Promise.all(assetUrls.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    }));
    const manifestResponse = await fetch('/terra-build-manifest.json', { cache: 'reload' }).catch(() => null);
    if (manifestResponse?.ok) await cache.put('/terra-build-manifest.json', manifestResponse.clone());
    const buildManifest = manifestResponse?.ok ? await manifestResponse.json() : null;
    const startupAssets = new Set();
    const visitAsset = (key) => {
      if (!buildManifest || !key || startupAssets.has(key) || !buildManifest[key]) return;
      startupAssets.add(key);
      (buildManifest[key].imports || []).forEach(visitAsset);
    };
    visitAsset('src/pages/HomePage.jsx');
    await Promise.all([...startupAssets].flatMap((key) => {
      const item = buildManifest[key];
      return [item.file, ...(item.css || [])].map(async (file) => {
        const url = new URL(`/${file}`, self.location.origin).href;
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      });
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('terra-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'TERRA_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Never cache API traffic, credentials, or cross-origin/provider responses.
  if (url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match('/')) || (await caches.match('/offline.html')) || Response.error();
      }
    })());
    return;
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination) || url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});

self.addEventListener('push', (event) => {
  let message = {};
  try { message = event.data?.json() || {}; } catch { message = { title: 'TERRA update', body: event.data?.text() || 'Open TERRA to review the latest source data.' }; }
  const title = typeof message.title === 'string' ? message.title.slice(0, 120) : 'TERRA safety signal';
  const options = {
    body: typeof message.body === 'string' ? message.body.slice(0, 500) : 'Open TERRA to review the source data.',
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: typeof message.eventId === 'string' ? `terra-${message.eventId}` : typeof message.forecastTime === 'string' ? `terra-rain-${message.forecastTime}` : `terra-${message.kind || 'update'}`,
    renotify: true, requireInteraction: true,
    vibrate: Array.isArray(message.vibrate) ? message.vibrate.slice(0, 8) : [250, 120, 250],
    data: { url: typeof message.url === 'string' ? message.url : '/alerts', source: message.source || 'TERRA' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawTarget = event.notification.data?.url || '/alerts';
  let target;
  try {
    target = new URL(rawTarget, self.location.origin);
    if (!['http:', 'https:'].includes(target.protocol)) target = new URL('/alerts', self.location.origin);
  } catch { target = new URL('/alerts', self.location.origin); }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (sameOrigin) {
      if (target.origin === self.location.origin && 'navigate' in sameOrigin) await sameOrigin.navigate(target.href);
      return sameOrigin.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
