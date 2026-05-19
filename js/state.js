'use strict';

// ════════════════════════════════════════════════════════════════
//  STATE — Source de vérité unique : Firestore
//
//  Architecture v2 :
//  • state (mémoire) ←── onSnapshot (Firestore) : lecture temps réel
//  • mutations       ───► Firestore directement  : écriture immédiate
//  • localStorage    : cache de démarrage uniquement (évite l'écran
//                      blanc avant que Firestore réponde)
//
//  Plus de save() général — chaque module écrit dans Firestore
//  lui-même via FireStore.saveWord(), FireStore.saveTask(), etc.
// ════════════════════════════════════════════════════════════════

// ── Cache de démarrage (localStorage) ────────────────────────
//
//  Utilisé uniquement pour afficher quelque chose pendant le pull
//  initial Firestore. Dès que onSnapshot arrive, state est mis à
//  jour et ce cache devient obsolète.

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
    } catch { /* quota exceeded */ }
  },

  /** Appelé par firebase.js après chaque onSnapshot pour tenir le cache à jour */
  updateCache(appState) {
    this.writeState(appState);
  },

  /**
   * Conservé pour compatibilité avec le timer et le spelling SRS
   * qui restent en localStorage (données très locales).
   */
  installSyncProxy() {
    const native = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      native(key, value);
      // Seuls le timer et le spelling déclenchent un push cloud
      const LOCAL_ONLY_KEYS = ['lexique_timer', 'lexique_spelling_srs'];
      if (LOCAL_ONLY_KEYS.includes(key) && typeof CloudSync !== 'undefined') {
        CloudSync.schedule(30000);
      }
    };
  },
};

// ── Runtime state (mémoire) ───────────────────────────────────

let state = { words: {}, categories: {}, tasks: [], sources: {} };

// UI filter state
let activeFilter     = 'all';
let activeTaskFilter = 'all';

// Task modal state
let modalEditId    = null;
let modalRecurType = 'once';
let selectedDays   = new Set();

// Chart references (for destroy-before-redraw)
let chartTimeline = null, chartCats = null, chartAnkiPie = null, chartTasksBar = null, chartWorkTime = null;

// PWA install prompt
let deferredInstallPrompt = null;

// Wordnik validation debounce
let validationTimer = null;

/** In-memory cache: word text → Wordnik result (true | false | null) */
const validationCache = {};

// ── Initialisation ────────────────────────────────────────────
//
//  load() hydrate state depuis le cache localStorage pour un
//  affichage immédiat. Firestore prend le relais via onSnapshot
//  quelques instants plus tard.

function load() {
  const cached = Storage.readState();
  state.words      = cached.words      ?? {};
  state.categories = cached.categories ?? {};
  state.tasks      = cached.tasks      ?? [];
  state.sources    = cached.sources    ?? {};
  state.knownWords = cached.knownWords ?? {};
  _migrateInMemory();
}

/**
 * save() — conservé pour compatibilité avec quelques appels
 * existants (onboarding, suggestions, etc.) mais n'écrit plus
 * dans Firestore directement. Les modules words/tasks écrivent
 * eux-mêmes dans Firestore.
 *
 * Écrit uniquement dans le cache localStorage.
 */
function save() {
  Storage.writeState(state);
}

// ── Migration en mémoire ──────────────────────────────────────
//
//  Assure que les champs requis existent sur les objets en mémoire.
//  Ne sauvegarde plus systématiquement — Firestore fait foi.

function _migrateInMemory() {
  let changed = false;

  // Anciens formats localStorage
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
    } catch { /* ignore */ }
  });

  // Champs requis sur les mots
  Object.values(state.words).forEach(w => {
    if (w.validity   === undefined) { w.validity   = 'unknown'; changed = true; }
    if (w.ankiDone   === undefined) { w.ankiDone   = false;     changed = true; }
    if (!Array.isArray(w.occurrences)) { w.occurrences = [];    changed = true; }
    if (w.source     === undefined) { w.source     = null;      changed = true; }
    if (w.ankiDoneAt === undefined) { w.ankiDoneAt = null;      changed = true; }
  });

  // Champs requis sur les tâches
  state.tasks.forEach(task => {
    if (!task.id)          { task.id            = 'task_' + Math.random().toString(36).slice(2); changed = true; }
    if (!task.recurType)   { task.recurType     = 'once'; changed = true; }
    if (!task.reportHistory) { task.reportHistory = [];   changed = true; }
    if (task.reportCount === undefined) { task.reportCount = 0; changed = true; }
    if (!task.history)     { task.history       = {};     changed = true; }
  });

  // Mettre à jour le cache local si migration nécessaire
  if (changed) Storage.writeState(state);
}

// ── Helpers Firestore ─────────────────────────────────────────
//
//  Couche fine entre les modules métier et Firestore.
//  Chaque fonction met à jour state en mémoire (optimistic update)
//  ET écrit dans Firestore. L'onSnapshot confirme ensuite.

const FireStore = {

  // ── Mots ────────────────────────────────────────────────────

  async saveWord(key, word) {
    // Optimistic : déjà dans state, on écrit juste dans Firestore
    try {
      const ref = CloudSync.wordsRef();
      if (!ref) { save(); return; } // fallback offline
      await ref.doc(String(key)).set({
        label:       word.label       ?? '',
        catKey:      word.catKey      ?? null,
        source:      word.source      ?? null,
        occurrences: Array.isArray(word.occurrences) ? word.occurrences : [],
        note:        word.note        ?? '',
        ankiDone:    word.ankiDone    ?? false,
        ankiDoneAt:  word.ankiDoneAt  ?? null,
        validity:    word.validity    ?? 'unknown',
        createdAt:   word.createdAt   ?? Date.now(),
        updatedAt:   word.updatedAt   ?? Date.now(),
      }, { merge: true });
    } catch (err) {
      console.warn('[FireStore] saveWord fallback localStorage :', err);
      save(); // offline — le SDK Firebase mettra en queue automatiquement
    }
  },

  async deleteWord(key) {
    try {
      const ref = CloudSync.wordsRef();
      if (ref) await ref.doc(String(key)).delete();
    } catch (err) {
      console.warn('[FireStore] deleteWord error :', err);
      save();
    }
  },

  // ── Tâches ──────────────────────────────────────────────────

  async saveTask(task) {
    try {
      const ref = CloudSync.tasksRef();
      if (!ref) { save(); return; }
      await ref.doc(String(task.id)).set({
        id:            task.id,
        title:         task.title         ?? '',
        desc:          task.desc          ?? '',
        cat:           task.cat           ?? '',
        dueDate:       task.dueDate        ?? '',
        done:          task.done           ?? false,
        doneAt:        task.doneAt         ?? null,
        recurType:     task.recurType      ?? 'once',
        recurDays:     task.recurDays      ?? [],
        recurStart:    task.recurStart     ?? '',
        recurEnd:      task.recurEnd       ?? '',
        recurInterval: task.recurInterval  ?? 1,
        deadline:      task.deadline       ?? '',
        history:       task.history        ?? {},
        reportHistory: task.reportHistory  ?? [],
        reportCount:   task.reportCount    ?? 0,
        createdAt:     task.createdAt      ?? Date.now(),
        updatedAt:     task.updatedAt      ?? Date.now(),
      }, { merge: true });
    } catch (err) {
      console.warn('[FireStore] saveTask fallback localStorage :', err);
      save();
    }
  },

  async deleteTask(id) {
    try {
      const ref = CloudSync.tasksRef();
      if (ref) await ref.doc(String(id)).delete();
    } catch (err) {
      console.warn('[FireStore] deleteTask error :', err);
      save();
    }
  },

  // ── Catégories & Sources ─────────────────────────────────────
  //
  //  Stockées dans le doc user — push différé via CloudSync.

  saveCategories() {
    // Mise à jour cache local immédiate
    save();
    // Push cloud différé 5s (les catégories changent rarement)
    if (typeof CloudSync !== 'undefined') CloudSync.schedule(5000);
  },
};
