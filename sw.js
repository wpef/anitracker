const CACHE_NAME = 'anitracker-v3';
const ASSETS = [
  '/index.html',
  '/quick.html',
  '/css/style.css',
  '/js/db.js',
  '/js/app.js',
  '/js/quick.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network-first pour les fichiers de l'app (toujours frais en ligne)
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first pour les ressources externes (Firebase CDN, etc.)
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
  }
});
