'use strict';

// ════════════════════════════════════════════════════════════════
//  FIREBASE CLOUD SYNC — v2 (onSnapshot architecture)
//
//  ARCHITECTURE :
//    Firestore → onSnapshot → state{} → UI   (lecture temps réel)
//    UI action → deleteWord/addWord → Firestore directement (écriture atomique)
//
//  ❌ SUPPRIMÉ : modèle push/pull (était la cause de tous les bugs)
//  ✅ AJOUTÉ   : onSnapshot comme unique source de vérité
// ════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyBY55p8u0kULi87qsuRvkfxyyNrn1eqBYc',
  authDomain:        'lexique-999ff.firebaseapp.com',
  projectId:         'lexique-999ff',
  storageBucket:     'lexique-999ff.firebasestorage.app',
  messagingSenderId: '32359120766',
  appId:             '1:32359120766:web:91b8b664b4bbf67a717d2f',
};

// ── Références globales ────────────────────────────────────────

let db         = null;
let currentUid = null;
let fbReady    = false;

// Unsubscribe handles — pour nettoyer les listeners au logout
let _unsubWords = null;
let _unsubTasks = null;

// ── Helpers références ─────────────────────────────────────────

const CloudSync = {
  userRef()  { return db && currentUid ? db.collection('users').doc(currentUid) : null; },
  wordsRef() { const u = this.userRef(); return u ? u.collection('words') : null; },
  tasksRef() { const u = this.userRef(); return u ? u.collection('tasks') : null; },

  // ── Sync badge ──────────────────────────────────────────────
  showStatus(status) {
    const badge = document.getElementById('syncBadge');
    if (!badge) return;
    const map = {
      syncing: { icon: '↻', color: 'var(--accent)',    title: 'Synchronisation…'  },
      synced:  { icon: '✓', color: 'var(--valid)',     title: 'Synchronisé'        },
      offline: { icon: '⊘', color: 'var(--text-dim)', title: 'Hors ligne'         },
      error:   { icon: '⚠', color: 'var(--danger)',   title: 'Erreur de sync'     },
    };
    const c = map[status] || { icon: '', color: '', title: '' };
    badge.textContent = c.icon;
    badge.style.color = c.color;
    badge.title       = c.title;
  },
};

// ════════════════════════════════════════════════════════════════
//  LISTENERS TEMPS RÉEL (onSnapshot)
//
//  Règle absolue :
//    → onSnapshot est la SEULE fonction qui écrit dans state.words
//    → Les fonctions CRUD (addWord, deleteWord…) n'écrivent JAMAIS
//      dans state.words — elles écrivent dans Firestore, et
//      onSnapshot propage automatiquement le changement dans l'UI.
// ════════════════════════════════════════════════════════════════

function startWordListener() {
  if (_unsubWords) { _unsubWords(); _unsubWords = null; }

  const wRef = CloudSync.wordsRef();
  if (!wRef) return;

  _unsubWords = wRef.onSnapshot(
    snapshot => {
      // Reconstruction complète depuis Firestore (source de vérité)
      const words = {};
      snapshot.forEach(doc => {
        const data = doc.data();

        // ✅ Guard défensif : ignore les documents sans label valide
        if (!data || typeof data.label !== 'string' || !data.label.trim()) {
          console.warn('[onSnapshot] Doc ignoré (label manquant) :', doc.id, data);
          return;
        }

        words[doc.id] = {
          id:          doc.id,
          label:       data.label,
          catKey:      data.catKey      ?? null,
          occurrences: Array.isArray(data.occurrences) ? data.occurrences : [],
          note:        data.note        ?? '',
          ankiDone:    data.ankiDone    ?? false,
          validity:    data.validity    ?? 'unknown',
          createdAt:   data.createdAt   ?? Date.now(),
          updatedAt:   data.updatedAt   ?? Date.now(),
        };
      });

      // ✅ Écrase le state local avec la vérité Firestore
      state.words = words;
      // ✅ Persiste en localStorage pour usage offline
      save();

      // ✅ Met à jour l'UI depuis la nouvelle source de vérité
      updateStats();
      render();
      rebuildNgrams();

      CloudSync.showStatus('synced');
      console.debug('[onSnapshot] ✅ words mis à jour —', Object.keys(words).length, 'mots');
    },
    err => {
      console.error('[onSnapshot] ❌ Erreur listener words :', err);
      if (err.code === 'unavailable') CloudSync.showStatus('offline');
      else CloudSync.showStatus('error');
    }
  );
}

function startTaskListener() {
  if (_unsubTasks) { _unsubTasks(); _unsubTasks = null; }

  const tRef = CloudSync.tasksRef();
  if (!tRef) return;

  _unsubTasks = tRef.onSnapshot(
    snapshot => {
      const tasks = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data || !data.id) return; // doc corrompu → ignoré
        tasks.push({ ...data, _docId: doc.id });
      });

      state.tasks = tasks;
      save();
      renderTasks();
      updateTaskStats();
      console.debug('[onSnapshot] ✅ tasks mis à jour —', tasks.length, 'tâches');
    },
    err => {
      console.error('[onSnapshot] ❌ Erreur listener tasks :', err);
    }
  );
}

// ════════════════════════════════════════════════════════════════
//  CRUD FIRESTORE — Mots
//
//  Ces fonctions :
//    1. Écrivent dans Firestore
//    2. Ne touchent JAMAIS state.words directement
//    3. Ne rappellent JAMAIS render() directement
//    → onSnapshot propage tout automatiquement
// ════════════════════════════════════════════════════════════════

/**
 * Ajoute ou incrémente un mot dans Firestore.
 * Utilise un runTransaction pour garantir l'atomicité du compteur.
 */
async function firestoreAddWord(wordData) {
  const wRef = CloudSync.wordsRef();
  if (!wRef) {
    console.warn('[firestoreAddWord] Firestore non prêt — sauvegarde locale uniquement');
    return;
  }

  CloudSync.showStatus('syncing');

  try {
    const docRef = wRef.doc(wordData.key);

    await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);

      if (snap.exists) {
        const existing = snap.data();
        const occurrences = Array.isArray(existing.occurrences)
          ? [...existing.occurrences, wordData.now]
          : [wordData.now];

        tx.update(docRef, {
          occurrences,
          updatedAt: wordData.now,
          // Met à jour catKey si fourni
          ...(wordData.catKey !== undefined && { catKey: wordData.catKey }),
        });
      } else {
        tx.set(docRef, {
          label:       wordData.label,
          catKey:      wordData.catKey ?? null,
          occurrences: [wordData.now],
          note:        '',
          ankiDone:    false,
          validity:    'unknown',
          createdAt:   wordData.now,
          updatedAt:   wordData.now,
        });
      }
    });

    // ✅ Pas de render() ici — onSnapshot s'en charge
    console.debug('[firestoreAddWord] ✅ Transaction OK —', wordData.key);

  } catch (err) {
    console.error('[firestoreAddWord] ❌ Erreur :', err);
    CloudSync.showStatus('error');
    throw err; // remonter pour gestion dans addWord()
  }
}

/**
 * Supprime définitivement un document Firestore.
 *
 * ⚠️  CORRECTION DU BUG PRINCIPAL :
 *   - Avant : deleteWord() faisait `delete state.words[key]` + save()
 *     → Firestore n'était jamais supprimé → réapparaissait au prochain pull
 *   - Maintenant : suppression atomique dans Firestore
 *     → onSnapshot reçoit l'event "removed" → reconstruit state.words
 *     → le mot disparaît de l'UI et ne peut plus revenir
 */
async function firestoreDeleteWord(key) {
  const wRef = CloudSync.wordsRef();
  if (!wRef) {
    // Fallback offline : suppression locale uniquement
    console.warn('[firestoreDeleteWord] Offline — suppression locale uniquement');
    delete state.words[key];
    save(); updateStats(); render(); rebuildNgrams();
    return;
  }

  CloudSync.showStatus('syncing');

  try {
    await wRef.doc(key).delete();
    // ✅ Pas de `delete state.words[key]` ici — onSnapshot s'en charge
    console.debug('[firestoreDeleteWord] ✅ Supprimé dans Firestore —', key);

  } catch (err) {
    console.error('[firestoreDeleteWord] ❌ Erreur :', err);
    CloudSync.showStatus('error');
    throw err;
  }
}

/**
 * Met à jour des champs spécifiques d'un mot.
 */
async function firestoreUpdateWord(key, fields) {
  const wRef = CloudSync.wordsRef();
  if (!wRef) {
    // Fallback offline : mise à jour locale
    if (state.words[key]) {
      Object.assign(state.words[key], fields);
      save(); render();
    }
    return;
  }

  try {
    await wRef.doc(key).update({
      ...fields,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[firestoreUpdateWord] ❌ Erreur :', err);
    CloudSync.showStatus('error');
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
//  CRUD FIRESTORE — Tâches
// ════════════════════════════════════════════════════════════════

async function firestoreSaveTask(task) {
  const tRef = CloudSync.tasksRef();
  if (!tRef) { save(); return; }

  try {
    await tRef.doc(String(task.id)).set({
      id:            task.id,
      title:         task.title         ?? '',
      note:          task.note          ?? '',
      cat:           task.cat           ?? '',
      dueDate:       task.dueDate       ?? '',
      done:          task.done          ?? false,
      doneAt:        task.doneAt        ?? null,
      recurType:     task.recurType     ?? 'once',
      recurDays:     task.recurDays     ?? [],
      recurStart:    task.recurStart    ?? '',
      recurEnd:      task.recurEnd      ?? '',
      recurInterval: task.recurInterval ?? 1,
      deadline:      task.deadline      ?? '',
      history:       task.history       ?? {},
      reportHistory: task.reportHistory ?? [],
      createdAt:     task.createdAt     ?? Date.now(),
      updatedAt:     Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('[firestoreSaveTask] ❌ Erreur :', err);
    throw err;
  }
}

async function firestoreDeleteTask(taskId) {
  const tRef = CloudSync.tasksRef();
  if (!tRef) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    save(); renderTasks();
    return;
  }

  try {
    await tRef.doc(String(taskId)).delete();
  } catch (err) {
    console.error('[firestoreDeleteTask] ❌ Erreur :', err);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
//  AUTH — Gestion de session
// ════════════════════════════════════════════════════════════════

function stopListeners() {
  if (_unsubWords) { _unsubWords(); _unsubWords = null; }
  if (_unsubTasks) { _unsubTasks(); _unsubTasks = null; }
}

function initAuth() {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUid = user.uid;
      fbReady    = true;
      console.debug('[Firebase] ✅ Auth OK — uid :', currentUid);

      // Charger l'état local en premier (pour l'affichage immédiat offline)
      load();
      render();
      renderTasks();
      updateStats();
      updateTaskStats();

      // Puis démarrer les listeners temps réel
      // → onSnapshot va écraser/compléter avec les données Firestore
      startWordListener();
      startTaskListener();

    } else {
      console.debug('[Firebase] Pas de session — connexion anonyme…');
      stopListeners();
      currentUid = null;
      fbReady    = false;
      firebase.auth().signInAnonymously().catch(err => {
        console.error('[Firebase] signInAnonymously failed :', err);
      });
    }
  });
}

// Gestion de la connectivité
window.addEventListener('online',  () => { CloudSync.showStatus('syncing'); });
window.addEventListener('offline', () => { CloudSync.showStatus('offline'); });

// ════════════════════════════════════════════════════════════════
//  INITIALISATION
// ════════════════════════════════════════════════════════════════

(function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('[Firebase] SDK non chargé — mode local uniquement');
      load(); render(); renderTasks(); updateStats(); updateTaskStats();
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();

    // Activer la persistance offline (Firestore met en cache localement)
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      // FAILED_PRECONDITION = plusieurs onglets ouverts (normal)
      // UNIMPLEMENTED = navigateur ne supporte pas (Safari private)
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
        console.warn('[Firebase] enablePersistence :', err.code);
      }
    });

    console.debug('[Firebase] ✅ Firestore initialisé');
    initAuth();

  } catch (err) {
    console.warn('[Firebase] Init error — mode local uniquement :', err);
    load(); render(); renderTasks(); updateStats(); updateTaskStats();
  }
})();
