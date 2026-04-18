'use strict';

// ════════════════════════════════════════════════════════════════
//  PWA — Service Worker & install banner
// ════════════════════════════════════════════════════════════════

(function initPWA() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Prompt the waiting worker to skip waiting as soon as it's installed
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Reload once the new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'SW_UPDATED') {
          console.log(`[SW] ✅ Lexique updated — cache version: ${event.data.version}`);
        }
      });

      // Check for updates every minute
      setInterval(() => registration.update().catch(() => {}), 60_000);
    } catch (err) {
      console.warn('[SW] Registration error:', err);
    }
  });
})();

// ── Install prompt ────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBanner').classList.add('show');
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').classList.remove('show');
  deferredInstallPrompt = null;
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    document.getElementById('installBanner').classList.remove('show');
  }
  deferredInstallPrompt = null;
});

function dismissInstall() {
  document.getElementById('installBanner').classList.remove('show');
}
