'use strict';

// ════════════════════════════════════════════════════════════════
//  STATE & PERSISTENCE
//
//  Rôle de ce fichier :
//    - Contenir le runtime state (lecture rapide dans l'UI)
//    - Persister en localStorage (fallback offline)
//
//  Ce fichier NE déclenche PLUS de sync cloud.
//  La sync est gérée exclusivement par firebase.js (onSnapshot).
//
//  ⚠️  SUPPRIMÉ : installSyncProxy() — il déclenchait des push
//      en double et interférait avec les listeners onSnapshot.
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
    } catch (e) {
      // Quota exceeded : tenter un nettoyage partiel
      console.warn('[Storage] localStorage plein :', e);
    }
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
  // ✅ Sauvegarde locale uniquement.
  // La sync Firestore est gérée par onSnapshot dans firebase.js.
  Storage.writeState(state);
}

// ── Migration ─────────────────────────────────────────────────

function migrate() {
  // Carry forward data from older storage keys
  ['lexique_v5', 'lexique_v4'].forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      if (raw && !localStorage.getItem(key + '_migrated')) {
        const old = JSON.parse(raw);
        if (old.words)      Object.assign(state.words,      old.words);
        if (old.categories) Object.assign(state.categories, old.categories);
        if (old.tasks) {
          state.tasks.push(
            ...old.tasks.filter(t => !state.tasks.find(x => x.id === t.id))
          );
        }
        localStorage.setItem(key + '_migrated', '1');
      }
    } catch { /* ignore corrupted data */ }
  });

  // ✅ Guard défensif sur tous les mots
  // Assure qu'aucun mot corrompu ne génère "undefined" dans l'UI
  Object.keys(state.words).forEach(key => {
    const w = state.words[key];
    if (!w || typeof w.label !== 'string' || !w.label.trim()) {
      // Document corrompu : supprimer silencieusement du state local
      console.warn('[migrate] Mot corrompu supprimé localement :', key, w);
      delete state.words[key];
      return;
    }
    w.validity ??= 'unknown';
    w.ankiDone ??= false;
    if (!Array.isArray(w.occurrences)) w.occurrences = [];
    w.updatedAt ??= Date.now();
    w.createdAt ??= Date.now();
  });

  // Ensure all tasks have required fields
  state.tasks.forEach(task => {
    task.id            ??= 'task_' + Math.random().toString(36).slice(2);
    task.recurType     ??= 'once';
    task.reportHistory ??= [];
    task.reportCount   ??= 0;
    task.history       ??= {};
  });

  save();
}
