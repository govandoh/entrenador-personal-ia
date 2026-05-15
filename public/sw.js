const CACHE = 'entrenador-ia-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Recursos de CDN externos (WASM y modelo de MediaPipe): dejar pasar a la red.
  // Son demasiado grandes para el cache del SW y el browser HTTP cache ya los maneja.
  if (!e.request.url.startsWith(self.location.origin)) return;

  // App shell (HTML, JS, CSS): cache-first con actualización en background.
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached ?? networkFetch;
    })
  );
});
