// sw.js — Lexique Service Worker
// ⚠️  Incrémente CACHE_VERSION à chaque déploiement Vercel
//     pour forcer le rechargement automatique sur les appareils.
const CACHE_VERSION = 'v2'; // ← changer à v3, v4… à chaque release
const CACHE_NAME = `lexique-${CACHE_VERSION}`;

const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700&family=DM+Sans:wght@300;400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ── Install : pré-cache du shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log(`[SW] Install — cache ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_URLS))
      .then(() => {
        // Prend le contrôle immédiatement sans attendre la fermeture des onglets
        self.skipWaiting();
      })
  );
});

// ── Activate : supprime les anciens caches ───────────────────────────────────
self.addEventListener('activate', event => {
  console.log(`[SW] Activate — cache ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('lexique-') && k !== CACHE_NAME)
          .map(k => {
            console.log(`[SW] Suppression ancien cache : ${k}`);
            return caches.delete(k);
          })
      ))
      .then(() => {
        // Prend le contrôle de tous les clients ouverts
        self.clients.claim();
        // Notifie les clients qu'une nouvelle version est active
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
          );
        });
      })
  );
});

// ── Message handler : reçoit SKIP_WAITING depuis index.html ──────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING reçu — activation forcée');
    self.skipWaiting();
  }
});

// ── Fetch strategy ───────────────────────────────────────────────────────────
// • API Wordnik  → Network-only  (fail gracefully si hors-ligne)
// • Tout le reste → Cache-first  (fallback réseau + mise en cache)
const API_ORIGINS = ['api.wordnik.com'];

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only pour les appels API dictionnaire
  if (API_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Cache-first pour tout le reste
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Fallback navigation hors-ligne
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
