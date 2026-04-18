'use strict';

// ════════════════════════════════════════════════════════════════
//  SERVICE WORKER — Lexique PWA
//  ⚠️  Ne jamais intercepter les requêtes Firebase/Firestore
// ════════════════════════════════════════════════════════════════

const CACHE_VERSION  = 'lexique-v6';
const CACHE_STATIC   = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC  = `${CACHE_VERSION}-dynamic`;

// ── Ressources à précacher au install ────────────────────────

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // JS modules — adapter selon ta structure réelle
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
  '/js/bootstrap.js',
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
//
//  Règle absolue : si l'URL matche un de ces patterns → ne PAS appeler
//  event.respondWith() → le navigateur envoie la requête directement.

const BYPASS_PATTERNS = [
  // Firestore WebChannel (realtime sync)
  /firestore\.googleapis\.com/,
  // Firebase Auth token refresh
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  // Firebase Remote Config / Analytics / Crashlytics
  /firebase\.googleapis\.com/,
  /firebaseinstallations\.googleapis\.com/,
  /firebaselogging\.googleapis\.com/,
  // Google APIs génériques (par sécurité)
  /googleapis\.com/,
  // Firebase Hosting (réseau only — géré par Firebase lui-même)
  /firebaseapp\.com/,
  // Extension Chrome / navigateur interne
  /^chrome-extension:\/\//,
];

/**
 * Retourne true si la requête ne doit jamais passer par le cache.
 * Critères : patterns Firebase + requêtes non-GET + cross-origin inconnus.
 */
function shouldBypass(request) {
  const url = request.url;

  // Toujours bypasser les patterns Firebase/Google
  if (BYPASS_PATTERNS.some(p => p.test(url))) return true;

  // Ne cacher que les GET — les POST/PUT/DELETE vont toujours au réseau
  if (request.method !== 'GET') return true;

  // Requêtes navigateur internes (blob:, data:, chrome:)
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
      .then(() => {
        console.log(`[SW] ✅ Install — cache ${CACHE_STATIC} prêt`);
        // Ne PAS appeler self.skipWaiting() ici :
        // pwa.js l'envoie via postMessage({ type: 'SKIP_WAITING' })
        // ce qui est plus propre (évite de court-circuiter les onglets ouverts).
      })
      .catch(err => console.warn('[SW] Précache partiel :', err))
  );
});

// ════════════════════════════════════════════════════════════════
//  ACTIVATE — Purge des anciens caches
// ════════════════════════════════════════════════════════════════

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => {
            console.log(`[SW] 🗑 Purge ancien cache : ${k}`);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log(`[SW] ✅ Activate — contrôle de tous les clients`);
      return self.clients.claim();
    })
  );
});

// ════════════════════════════════════════════════════════════════
//  FETCH — Stratégie par type de ressource
// ════════════════════════════════════════════════════════════════

self.addEventListener('fetch', event => {
  // ── 1. Bypass immédiat pour Firebase et tout ce qui ne doit pas être caché
  if (shouldBypass(event.request)) {
    // Ne PAS appeler event.respondWith() → passage direct au réseau natif
    return;
  }

  const url = new URL(event.request.url);

  // ── 2. Assets statiques précachés → Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // ── 3. Pages HTML → Network First (toujours la version la plus récente)
  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirstHtml(event.request));
    return;
  }

  // ── 4. Autres ressources same-origin → Stale While Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // ── 5. Tout le reste cross-origin non-bypassé → réseau uniquement
  // (ne pas appeler respondWith → comportement natif)
});

// ════════════════════════════════════════════════════════════════
//  STRATÉGIES DE CACHE
// ════════════════════════════════════════════════════════════════

/**
 * Cache First : retourne le cache immédiatement, ne va au réseau
 * qu'en cas de miss. Idéal pour les assets versionnés (JS, CSS, images).
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone()); // ne pas await — fire-and-forget
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

/**
 * Network First : essaie le réseau, bascule sur le cache si offline.
 * Utilisé pour les pages HTML afin d'avoir toujours le dernier deploy.
 */
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

    // Fallback vers index.html pour les SPA (routing côté client)
    const indexCache = await caches.match('/index.html');
    return indexCache || offlineFallback(request);
  }
}

/**
 * Stale While Revalidate : retourne le cache instantanément,
 * revalide en arrière-plan. Bon compromis perf/fraîcheur.
 */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_DYNAMIC);
  const cached = await cache.match(request);

  // Lance la mise à jour réseau en arrière-plan (sans await ici)
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
  // Assets dont les URLs sont connues à l'avance (précachées au install)
  const path = url.pathname;
  return STATIC_ASSETS.includes(path)
    || /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/.test(path);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate'
    || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

/**
 * Réponse de fallback offline minimaliste.
 * Retourne une page ou une réponse JSON vide selon le type de requête.
 */
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

  // Pour les assets (JS/CSS/images) manquants offline
  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

// ════════════════════════════════════════════════════════════════
//  MESSAGES — Communication avec pwa.js
// ════════════════════════════════════════════════════════════════

self.addEventListener('message', event => {
  // pwa.js envoie SKIP_WAITING quand une mise à jour est prête
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] ⏩ SKIP_WAITING reçu — activation immédiate');
    self.skipWaiting();
  }
});

// Notifie les clients une fois le SW activé (pwa.js écoute SW_UPDATED)
self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
      clients.forEach(client =>
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
      );
    })
  );
});
