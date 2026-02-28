// ⚠️ Incrémenter CACHE_NAME à chaque déploiement pour forcer la mise à jour
const CACHE_NAME = 'anitracker-v5';
const ASSETS = [
  '/index.html',
  '/quick.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/js/demo-db.js',
  '/js/quick.js',
  '/js/firebase-config.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // Prend la main immédiatement sans attendre la fermeture de l'onglet
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // 1. Purge les anciens caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));

    // 2. Prend le contrôle de tous les onglets ouverts
    await self.clients.claim();

    // 3. Demande à toutes les pages ouvertes de se recharger pour
    //    utiliser les nouveaux fichiers (évite les mélanges de versions)
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network-first pour les fichiers locaux de l'app
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
    // Cache-first pour les ressources externes (CDN Firebase, Chart.js…)
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
