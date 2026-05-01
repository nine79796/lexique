'use strict';

// ════════════════════════════════════════════════════════════════
//  BOOTSTRAP — App initialisation & keyboard shortcuts
// ════════════════════════════════════════════════════════════════

// ── Keyboard shortcuts ────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTaskModal(); hideSuggestions(); }

  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (e.key === 'f' || e.key === 'F') document.getElementById('searchInput').focus();
});

document.getElementById('wordInput').addEventListener('keydown',  e => { if (e.key === 'Enter') addWord(); });
document.getElementById('catInput').addEventListener('keydown',   e => { if (e.key === 'Enter') addCategory(); });
document.getElementById('mTaskTitle').addEventListener('keydown', e => { if (e.key === 'Enter') saveTaskFromModal(); });

// Close task modal on backdrop click
document.getElementById('taskModal').addEventListener('click', e => {
  if (e.target === document.getElementById('taskModal')) closeTaskModal();
});

// Online/offline status badge
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ── Bootstrap ─────────────────────────────────────────────────

(function bootstrap() {
  // BUG FIX #4 : installSyncProxy() DOIT être appelé en premier,
  // avant load() et avant que Firebase auth callback puisse déclencher
  // un Storage.writeState() → localStorage.setItem() non patché.
  Storage.installSyncProxy();

  currentLang = detectLang();
  load();
  initTheme();
  loadSuggPrefs();
  applyTranslations();
  rebuildNgrams();
  // Note: autoReportTasks() est appelé APRÈS le pull cloud (firebase.js)
  // pour éviter de marquer "missed" des tâches cochées sur un autre appareil.
  // En mode hors-ligne, il sera appelé lors de l'ouverture des onglets Tasks/Revision.
  renderCatManager();
  renderCatSelect();
  renderSourceManager();
  renderSourceSelect();
  renderFilters();
  updateStats();
  render();
  renderTaskFilters();
  renderTasks();
  updateTaskStats();
  checkNotifBanner();
  if (typeof NotificationService !== 'undefined') NotificationService.scheduleDaily();
  updateOnlineStatus();
  initTimer();

  setTimeout(attachSuggestions, 100);
})();
