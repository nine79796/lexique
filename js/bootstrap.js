'use strict';

// ════════════════════════════════════════════════════════════════
//  BOOTSTRAP — App initialisation & keyboard shortcuts
// ════════════════════════════════════════════════════════════════

// ── Keyboard shortcuts ────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTaskModal(); hideSuggestions(); }

  // Skip shortcuts when typing
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  // 'F' → focus search
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
  currentLang = detectLang();
  load();
  initTheme();
  loadSuggPrefs();
  applyTranslations();
  rebuildNgrams();
  autoReportTasks();
  renderCatManager();
  renderCatSelect();
  renderFilters();
  updateStats();
  render();
  renderTaskFilters();
  renderTasks();
  updateTaskStats();
  checkNotifBanner();
  // Replanifie la notification quotidienne si la permission est déjà accordée
  // (session suivante — évite de notifier à chaque reload)
  if (typeof NotificationService !== 'undefined') NotificationService.scheduleDaily();
  updateOnlineStatus();
  Storage.installSyncProxy();

  // Attach suggestions after initial render to catch dynamic inputs
  setTimeout(attachSuggestions, 100);
})();
