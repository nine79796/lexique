'use strict';

// ════════════════════════════════════════════════════════════════
//  SERVICE WORKER — Lexique PWA
//  ⚠️  Ne jamais intercepter les requêtes Firebase/Firestore
// ════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'lexique-v51';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

// ── Ressources à précacher au install ────────────────────────

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/js/constants.js',
  '/js/utils.js',
  '/js/state.js',
  '/js/i18n.js',
  '/js/words.js',
  '/js/categories.js',
  '/js/tasks.js',
  '/js/recurrence.js',
  '/js/revision.js',
  '/js/suggestions.js',
  '/js/notifications.js',
  '/js/charts.js',
  '/js/ui.js',
  '/js/pwa.js',
  '/js/spelling.js',
  '/js/bootstrap.js',
  '/js/freq_en.js',
  '/js/priority.js',
  '/js/onboarding.js',
];

// ── Patterns à NE JAMAIS intercepter ─────────────────────────
//
//  Firestore utilise un WebChannel HTTP/1.1 long-polling :
//    POST  /google.firestore.v1.Firestore/Listen/channel
//    GET   /google.firestore.v1.Firestore/Listen/channel  (SSE-like stream)
//
//  Ces flux sont des streams infinis — toute tentative de les mettre
//  en cache, de les cloner ou de les envelopper dans respondWith()
//  provoque une exception ou une réponse corrompue côté SDK Firestore.

const BYPASS_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firebase\.googleapis\.com/,
  /firebaseinstallations\.googleapis\.com/,
  /firebaselogging\.googleapis\.com/,
  /googleapis\.com/,
  /firebaseapp\.com/,
  /^chrome-extension:\/\//,
];

function shouldBypass(request) {
  const url = request.url;
  if (BYPASS_PATTERNS.some(p => p.test(url))) return true;
  if (request.method !== 'GET') return true;
  if (!url.startsWith('http')) return true;
  return false;
}

// ════════════════════════════════════════════════════════════════
//  INSTALL — Précache des assets statiques
// ════════════════════════════════════════════════════════════════

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => console.log(`[SW] ✅ Install — cache ${CACHE_STATIC} prêt`))
      .catch(err => console.warn('[SW] Précache partiel :', err))
  );
});

// ════════════════════════════════════════════════════════════════
//  ACTIVATE — Purge des anciens caches + notification clients
// ════════════════════════════════════════════════════════════════

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
            .map(k => {
              console.log(`[SW] 🗑 Purge ancien cache : ${k}`);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        console.log(`[SW] ✅ Activate — contrôle de tous les clients`);
        // Notifie les clients que le SW est à jour
        return self.clients.matchAll({ includeUncontrolled: true }).then(clients =>
          clients.forEach(client =>
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
          )
        );
      })
  );
});

// ════════════════════════════════════════════════════════════════
//  FETCH — Stratégie par type de ressource
// ════════════════════════════════════════════════════════════════

self.addEventListener('fetch', event => {
  // 1. Bypass immédiat pour Firebase et tout ce qui ne doit pas être caché
  if (shouldBypass(event.request)) return;

  const url = new URL(event.request.url);

  // 2. Assets statiques précachés → Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 3. Pages HTML → Network First (toujours la version la plus récente)
  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirstHtml(event.request));
    return;
  }

  // 4. Autres ressources same-origin → Stale While Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 5. Tout le reste cross-origin non-bypassé → réseau uniquement
});

// ════════════════════════════════════════════════════════════════
//  STRATÉGIES DE CACHE
// ════════════════════════════════════════════════════════════════

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

async function networkFirstHtml(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const indexCache = await caches.match('/index.html');
    return indexCache || offlineFallback(request);
  }
}

async function staleWhileRevalidate(request) {
  const cache       = await caches.open(CACHE_DYNAMIC);
  const cached      = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise || offlineFallback(request);
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

function isStaticAsset(url) {
  const path = url.pathname;
  return STATIC_ASSETS.includes(path)
    || /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/.test(path);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate'
    || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

function offlineFallback(request) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return new Response(
      `<!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="utf-8"><title>Lexique — Hors ligne</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px;color:#888">
        <h2>⊘ Hors ligne</h2>
        <p>L'application Lexique est indisponible sans connexion.<br>
           Vos données locales sont conservées.</p>
      </body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

// ════════════════════════════════════════════════════════════════
//  MESSAGES — Communication avec pwa.js
// ════════════════════════════════════════════════════════════════

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] ⏩ SKIP_WAITING reçu — activation immédiate');
    self.skipWaiting();
  }
});
