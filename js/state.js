'use strict';

// ════════════════════════════════════════════════════════════════
//  STATE & PERSISTENCE
// ════════════════════════════════════════════════════════════════

// ── localStorage abstraction ──────────────────────────────────

const Storage = {
  readState() {
    try {
      const raw = localStorage.getItem(LS_KEY_STATE);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  },

  writeState(appState) {
    try {
      localStorage.setItem(LS_KEY_STATE, JSON.stringify(appState));
    } catch { /* quota exceeded — silent fail */ }
  },

  /**
   * Monkey-patch localStorage.setItem so that writes to sync-relevant
   * keys automatically schedule a cloud push.
   */
  installSyncProxy() {
    const native = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      native(key, value);
      if (LS_SYNC_KEYS.includes(key)) CloudSync.schedule();
    };
  },
};

// ── Runtime state ─────────────────────────────────────────────

let state = { words: {}, categories: {}, tasks: [] };

// UI filter state
let activeFilter     = 'all';
let activeTaskFilter = 'all';

// Task modal state
let modalEditId    = null;
let modalRecurType = 'once';
let selectedDays   = new Set();

// Chart references (for destroy-before-redraw)
let chartTimeline = null, chartCats = null, chartAnkiPie = null, chartTasksBar = null;

// PWA install prompt
let deferredInstallPrompt = null;

// Wordnik validation debounce
let validationTimer = null;

/** In-memory cache: word text → Wordnik result (true | false | null) */
const validationCache = {};

// ── Load / Save ───────────────────────────────────────────────

function load() {
  state = Storage.readState();
  state.words      ??= {};
  state.categories ??= {};
  state.tasks      ??= [];
  migrate();
}

function save() {
  Storage.writeState(state);
}

// ── Migration ─────────────────────────────────────────────────

function migrate() {
  // FIX: track whether anything actually changed so we don't
  // trigger an unnecessary save() (and cloud sync) on every boot.
  let changed = false;

  // Carry forward data from older storage keys
  ['lexique_v5', 'lexique_v4'].forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      if (raw && !localStorage.getItem(key + '_migrated')) {
        const old = JSON.parse(raw);
        if (old.words)      { Object.assign(state.words,      old.words);      changed = true; }
        if (old.categories) { Object.assign(state.categories, old.categories); changed = true; }
        if (old.tasks) {
          state.tasks.push(
            ...old.tasks.filter(t => !state.tasks.find(x => x.id === t.id))
          );
          changed = true;
        }
        localStorage.setItem(key + '_migrated', '1');
      }
    } catch { /* ignore corrupted data */ }
  });

  // Ensure all words have required fields
  Object.values(state.words).forEach(w => {
    if (w.validity === undefined)  { w.validity  = 'unknown'; changed = true; }
    if (w.ankiDone === undefined)  { w.ankiDone  = false;     changed = true; }
    if (!Array.isArray(w.occurrences)) { w.occurrences = [];  changed = true; }
  });

  // Ensure all tasks have required fields
  state.tasks.forEach(task => {
    if (!task.id)                    { task.id            = 'task_' + Math.random().toString(36).slice(2); changed = true; }
    if (!task.recurType)             { task.recurType     = 'once'; changed = true; }
    if (!task.reportHistory)         { task.reportHistory = [];     changed = true; }
    if (task.reportCount === undefined) { task.reportCount = 0;     changed = true; }
    if (!task.history)               { task.history       = {};     changed = true; }
  });

  if (changed) save();
}
