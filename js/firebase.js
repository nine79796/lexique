'use strict';

// ════════════════════════════════════════════════════════════════
//  FIREBASE CLOUD SYNC — v2 (temps réel)
//
//  Architecture :
//  ┌─────────────────────────────────────────────────────────────┐
//  │  onSnapshot  →  pull temps réel (mots, tâches)             │
//  │  pushToCloud →  push différé 30s après chaque write local  │
//  │  Conflict    →  last-write-wins sur updatedAt              │
//  │  Timer       →  champ dédié, fusion par startedAt unique   │
//  └─────────────────────────────────────────────────────────────┘
//
//  SÉCURITÉ : La clé API Firebase ci-dessous est publique par nature
//  (elle identifie le projet côté client). Les règles Firestore
//  restreignent l'accès par UID — ne jamais commettre de clé Admin SDK.
// ════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyBY55p8u0kULi87qsuRvkfxyyNrn1eqBYc',
  authDomain:        'lexique-999ff.firebaseapp.com',
  projectId:         'lexique-999ff',
  storageBucket:     'lexique-999ff.firebasestorage.app',
  messagingSenderId: '32359120766',
  appId:             '1:32359120766:web:91b8b664b4bbf67a717d2f',
};

// ── Runtime state ─────────────────────────────────────────────

let db          = null;
let currentUid  = null;
let fbReady     = false;
let isSyncing   = false;
let syncTimer   = null;
let firstPull   = true;

// Listeners onSnapshot actifs — stockés pour pouvoir les unsubscribe
const _listeners = { words: null, tasks: null };

// ── Helpers ────────────────────────────────────────────────────

/** Fusionne deux tableaux sur une clé unique — last-write-wins sur updatedAt/ts */
function mergeById(local, cloud, key) {
  const map = new Map();
  local.forEach(item => { if (item[key] != null) map.set(item[key], item); });
  // Cloud écrase local si pas de updatedAt, sinon last-write-wins
  cloud.forEach(item => {
    if (item[key] == null) return;
    const existing = map.get(item[key]);
    if (!existing || (item.updatedAt ?? item.ts ?? 0) >= (existing.updatedAt ?? existing.ts ?? 0)) {
      map.set(item[key], item);
    }
  });
  return [...map.values()].sort((a, b) => (b[key] || 0) - (a[key] || 0));
}

function reRenderAll() {
  try {
    load();
    autoReportTasks();
    rebuildNgrams();
    render(); renderTasks(); updateStats(); updateTaskStats();
    renderCatManager(); renderCatSelect(); renderFilters();
    renderTimerHistory(); timerTick();
  } catch (e) {
    console.warn('[Sync] reRenderAll error:', e);
  }
}

// ── Auth UI ───────────────────────────────────────────────────

const AuthUI = {
  update(user) {
    const btn = document.getElementById('authBtn');
    if (!btn) return;

    if (user && !user.isAnonymous) {
      const name  = user.displayName || user.email || 'Compte';
      const photo = user.photoURL;
      btn.title     = name;
      btn.innerHTML = photo
        ? `<img src="${photo}" alt="" class="auth-avatar"> <span class="auth-name">${escHtml(name.split(' ')[0])}</span>`
        : `<span class="auth-avatar-initials">${escHtml(name[0].toUpperCase())}</span> <span class="auth-name">${escHtml(name.split(' ')[0])}</span>`;
      btn.classList.add('signed-in');
      btn.onclick = () => AuthUI.showMenu(user);
    } else {
      btn.innerHTML = `<span class="auth-icon">👤</span> <span data-i18n="auth.sign_in">${t('auth.sign_in')}</span>`;
      btn.title     = t('auth.sign_in_title');
      btn.classList.remove('signed-in');
      btn.onclick   = () => AuthService.signInWithGoogle();
    }
  },

  showMenu(user) {
    let menu = document.getElementById('authMenu');
    if (menu) { menu.remove(); return; }

    menu             = document.createElement('div');
    menu.id          = 'authMenu';
    menu.className   = 'auth-menu';
    menu.innerHTML   = `
      <div class="auth-menu-name">${escHtml(user.displayName || user.email || 'Compte')}</div>
      <div class="auth-menu-email">${escHtml(user.email || '')}</div>
      <hr class="auth-menu-divider">
      <button class="auth-menu-item" onclick="AuthService.signOut()">
        <span>⎋</span> <span data-i18n="auth.sign_out">${t('auth.sign_out')}</span>
      </button>`;

    const btn  = document.getElementById('authBtn');
    const rect = btn.getBoundingClientRect();
    menu.style.top   = (rect.bottom + window.scrollY + 6) + 'px';
    menu.style.right = (window.innerWidth - rect.right)   + 'px';
    document.body.appendChild(menu);

    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target) && e.target !== btn) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 0);
  },
};

// ── Auth Service ──────────────────────────────────────────────

const AuthService = {
  async signInWithGoogle() {
    if (typeof firebase === 'undefined') return;
    const provider = new firebase.auth.GoogleAuthProvider();
    const anonUser = firebase.auth().currentUser;
    try {
      if (anonUser && anonUser.isAnonymous) {
        try {
          await anonUser.linkWithPopup(provider);
          console.debug('[Auth] ✅ Compte anonyme lié à Google — UID conservé :', anonUser.uid);
          return;
        } catch (linkErr) {
          if (linkErr.code === 'auth/credential-already-in-use') {
            await firebase.auth().signInWithPopup(provider);
            return;
          }
          throw linkErr;
        }
      }
      await firebase.auth().signInWithPopup(provider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('[Auth] Erreur connexion Google :', err);
      }
    }
  },

  async signOut() {
    const menu = document.getElementById('authMenu');
    if (menu) menu.remove();
    // Arrêter les listeners temps réel avant de déconnecter
    CloudSync.stopListeners();
    try {
      await firebase.auth().signOut();
      console.debug('[Auth] Déconnecté');
    } catch (err) {
      console.error('[Auth] Erreur déconnexion :', err);
    }
  },
};

// ── CloudSync ─────────────────────────────────────────────────

const CloudSync = {

  // ── Refs ──────────────────────────────────────────────────

  userRef()  { return db && currentUid ? db.collection('users').doc(currentUid) : null; },
  wordsRef() { const u = this.userRef(); return u ? u.collection('words') : null; },
  tasksRef() { const u = this.userRef(); return u ? u.collection('tasks') : null; },

  // ── Status badge ──────────────────────────────────────────

  showStatus(status) {
    const badge = document.getElementById('syncBadge');
    if (!badge) return;
    const map = {
      syncing: { icon: '↻', color: 'var(--accent)',    title: t('sync.syncing') },
      synced:  { icon: '✓', color: 'var(--valid)',     title: t('sync.synced')  },
      offline: { icon: '⊘', color: 'var(--text-dim)', title: t('sync.offline') },
      error:   { icon: '⚠', color: 'var(--danger)',   title: t('sync.error')   },
    };
    const c = map[status] || { icon: '', color: '', title: '' };
    badge.textContent = c.icon;
    badge.style.color = c.color;
    badge.title       = c.title;
  },

  // ── Push différé ──────────────────────────────────────────
  //
  //  Chaque write local déclenche schedule(). Si plusieurs writes
  //  arrivent en rafale, un seul push part (debounce 30s min).

  schedule(delayMs = 30000) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (navigator.onLine) this.pushToCloud();
      else this.showStatus('offline');
    }, Math.max(delayMs, 30000));
  },

  // ── Listeners temps réel (onSnapshot) ────────────────────
  //
  //  onSnapshot écoute Firestore en permanence. Dès qu'un autre
  //  appareil fait un push, les données arrivent ici en <1s
  //  sans pull périodique. C'est la clé d'une sync pro.

  startListeners() {
    this.stopListeners(); // éviter les doublons

    const wRef = this.wordsRef();
    const tRef = this.tasksRef();

    if (wRef) {
      _listeners.words = wRef.onSnapshot(
        snap => {
          // Ignorer si c'est nous qui venons d'écrire (hasPendingWrites)
          if (snap.metadata.hasPendingWrites) return;

          const remoteIds = new Set();

          snap.forEach(doc => {
            const cloud = doc.data();
            if (!cloud.label) return;
            remoteIds.add(doc.id);
            const local = state.words[doc.id];
            // last-write-wins sur updatedAt
            if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
              state.words[doc.id] = { ...local, ...cloud, id: doc.id };
            }
          });

          // Supprimer les mots effacés sur un autre appareil
          Object.keys(state.words).forEach(id => {
            if (!remoteIds.has(id)) delete state.words[id];
          });

          // Mettre à jour le cache localStorage
          Storage.updateCache(state);
          console.debug('[onSnapshot] Mots mis à jour :', snap.size);
          reRenderAll();
        },
        err => console.warn('[onSnapshot] words error:', err)
      );
    }

    if (tRef) {
      _listeners.tasks = tRef.onSnapshot(
        snap => {
          if (snap.metadata.hasPendingWrites) return;

          const localTasks = {};
          (Array.isArray(state.tasks) ? state.tasks : [])
            .forEach(t => { if (t.id) localTasks[t.id] = t; });
          const remoteIds = new Set();

          snap.forEach(doc => {
            const cloud = doc.data();
            if (!cloud.id) return;
            remoteIds.add(String(cloud.id));
            const local = localTasks[String(cloud.id)];
            if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
              localTasks[String(cloud.id)] = { ...local, ...cloud };
            }
          });

          Object.keys(localTasks).forEach(id => {
            if (!remoteIds.has(id)) delete localTasks[id];
          });

          state.tasks = Object.values(localTasks);
          Storage.updateCache(state);
          console.debug('[onSnapshot] Tâches mises à jour :', snap.size);
          reRenderAll();
        },
        err => console.warn('[onSnapshot] tasks error:', err)
      );
    }

    // Timer & catégories : onSnapshot sur le doc user
    const uRef = this.userRef();
    if (uRef) {
      _listeners.user = uRef.onSnapshot(
        snap => {
          if (!snap.exists || snap.metadata.hasPendingWrites) return;
          const data = snap.data();

          // Catégories
          if (data.categories && typeof data.categories === 'object') {
            state.categories = data.categories;
            if (data.sources && typeof data.sources === 'object') {
              state.sources = data.sources;
            }
            Storage.updateCache(state);
          }

          // Timer — fusion sessions + milestones
          this._mergeTimerFromCloud(data);

          console.debug('[onSnapshot] Doc user mis à jour');
          reRenderAll();
        },
        err => console.warn('[onSnapshot] user error:', err)
      );
    }

    console.debug('[Sync] ✅ Listeners temps réel démarrés');
  },

  stopListeners() {
    Object.values(_listeners).forEach(unsub => { if (typeof unsub === 'function') unsub(); });
    _listeners.words = null;
    _listeners.tasks = null;
    _listeners.user  = null;
    console.debug('[Sync] Listeners arrêtés');
  },

  // ── Fusion timer depuis le cloud ──────────────────────────

  _mergeTimerFromCloud(data) {
    const cloudSessions   = data.timerSessions;
    const cloudMilestones = data.timerMilestones;
    const cloudState      = data.timerState;

    if (!cloudSessions && !cloudMilestones && !cloudState) return;

    let localTimer = {};
    try {
      const raw = localStorage.getItem('lexique_timer');
      if (raw) localTimer = JSON.parse(raw);
    } catch { /* ignore */ }

    const localSessions   = Array.isArray(localTimer.sessions)   ? localTimer.sessions   : [];
    const localMilestones = Array.isArray(localTimer.milestones) ? localTimer.milestones : [];

    // Fusion par startedAt unique — last-write-wins
    const mergedSessions   = mergeById(localSessions,   cloudSessions   || [], 'startedAt').slice(0, 200);
    const mergedMilestones = mergeById(localMilestones, cloudMilestones || [], 'ts').slice(0, 200);

    localTimer.sessions   = mergedSessions;
    localTimer.milestones = mergedMilestones;

    // État courant du timer : prendre le cloud si plus récent
    if (cloudState && cloudState.pushedAt) {
      const localPushedAt = localTimer.pushedAt || 0;
      if (cloudState.pushedAt > localPushedAt) {
        if (cloudState.running && cloudState.startedAt) {
          // Timer tournait côté cloud — calculer le temps écoulé
          localTimer.elapsed     = (cloudState.elapsed || 0) + (Date.now() - cloudState.startedAt);
          localTimer.running     = false; // on ne reprend pas auto sur un autre appareil
          localTimer.startedAt   = null;
        } else {
          localTimer.elapsed   = cloudState.elapsed || 0;
          localTimer.running   = false;
          localTimer.startedAt = null;
        }
        localTimer.currentTask      = cloudState.currentTask || '';
        localTimer.pushedAt         = cloudState.pushedAt;
        localTimer.sessionStartedAt = cloudState.sessionStartedAt || null;
      }
    }

    try { localStorage.setItem('lexique_timer', JSON.stringify(localTimer)); } catch { /* quota */ }
  },

  // ── PUSH ─────────────────────────────────────────────────
  //
  //  Push complet vers Firestore. Déclenché par schedule().
  //  Les onSnapshot des autres appareils reçoivent le changement
  //  automatiquement — pas besoin de pull côté pair.

  async pushToCloud() {
    if (!fbReady || !db || !currentUid || isSyncing) return;
    if (!navigator.onLine) { this.showStatus('offline'); return; }

    isSyncing = true;
    this.showStatus('syncing');
    console.debug('[Sync↑] Push vers Firestore…');

    try {
      const st    = Storage.readState();
      const words = st.words || {};
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      const now   = Date.now();
      const BATCH = 400;

      // ── Mots ────────────────────────────────────────────

      const wRef = this.wordsRef();
      if (wRef) {
        const entries = Object.entries(words);

        // Supprimer de Firestore les mots effacés localement
        const remoteSnap    = await wRef.get();
        const remoteDels    = [];
        remoteSnap.forEach(doc => { if (!words[doc.id]) remoteDels.push(doc.id); });
        if (remoteDels.length) {
          const delBatch = db.batch();
          remoteDels.forEach(id => delBatch.delete(wRef.doc(id)));
          await delBatch.commit();
          console.debug(`[Sync↑] ${remoteDels.length} mot(s) supprimé(s) de Firestore`);
        }

        // Push par batch de 400
        for (let i = 0; i < entries.length; i += BATCH) {
          const batch = db.batch();
          entries.slice(i, i + BATCH).forEach(([id, w]) => {
            batch.set(wRef.doc(String(id)), {
              label:       w.label       ?? '',
              catKey:      w.catKey      ?? null,
              source:      w.source      ?? null,
              occurrences: Array.isArray(w.occurrences) ? w.occurrences : [],
              note:        w.note        ?? '',
              ankiDone:    w.ankiDone    ?? false,
              ankiDoneAt:  w.ankiDoneAt  ?? null,
              validity:    w.validity    ?? 'unknown',
              createdAt:   w.createdAt   ?? now,
              updatedAt:   w.updatedAt   ?? now,
            }, { merge: true });
          });
          await batch.commit();
        }
        console.debug(`[Sync↑] ${entries.length} mot(s) poussés`);
      }

      // ── Tâches ──────────────────────────────────────────

      const tRef = this.tasksRef();
      if (tRef && tasks.length > 0) {
        for (let i = 0; i < tasks.length; i += BATCH) {
          const batch = db.batch();
          tasks.slice(i, i + BATCH).forEach(task => {
            if (!task.id) return;
            batch.set(tRef.doc(String(task.id)), {
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
              createdAt:     task.createdAt      ?? now,
              updatedAt:     task.updatedAt      ?? now,
            }, { merge: true });
          });
          await batch.commit();
        }
        console.debug(`[Sync↑] ${tasks.length} tâche(s) poussées`);
      }

      // ── Catégories + Sources + Timer + Spelling ──────────

      const cats    = st.categories || {};
      const sources = st.sources    || {};

      let timerData = {};
      try {
        const rawTimer = localStorage.getItem('lexique_timer');
        if (rawTimer) timerData = JSON.parse(rawTimer);
      } catch { /* ignore */ }

      let spellingData = {};
      try {
        const rawSpelling = localStorage.getItem('lexique_spelling_srs');
        if (rawSpelling) spellingData = JSON.parse(rawSpelling);
      } catch { /* ignore */ }

      const uRef = this.userRef();
      if (uRef) {
        await uRef.set({
          lastSync:        now,
          appVersion:      'lexique-v6',
          categories:      cats,
          sources:         sources,
          timerSessions:   Array.isArray(timerData.sessions)   ? timerData.sessions   : [],
          timerMilestones: Array.isArray(timerData.milestones) ? timerData.milestones : [],
          timerState: {
            running:            timerData.running            || false,
            elapsed:            timerData.elapsed            || 0,
            startedAt:          timerData.startedAt          || null,
            sessionStartedAt:   timerData.sessionStartedAt   || null,
            currentTask:        timerData.currentTask        || '',
            pushedAt:           now,
          },
          spellingCards:   spellingData.cards  || {},
          spellingToday:   spellingData.today  || {},
        }, { merge: true });
        console.debug('[Sync↑] Catégories + Timer + Spelling poussés');
      }

      this.showStatus('synced');
      console.debug('[Sync↑] ✅ Push terminé');
    } catch (err) {
      console.error('[Sync↑] ❌ Erreur push :', err);
      this.showStatus('error');
    } finally {
      isSyncing = false;
    }
  },

  // ── Pull initial ─────────────────────────────────────────
  //
  //  Utilisé une seule fois au démarrage pour avoir les données
  //  avant d'activer les listeners temps réel.

  async pullFromCloud() {
    if (!fbReady || !db || !currentUid) return;
    this.showStatus('syncing');
    console.debug('[Sync↓] Pull initial depuis Firestore…');

    try {
      const appState   = Storage.readState();
      const localWords = appState.words || {};
      const localTasks = {};
      (Array.isArray(appState.tasks) ? appState.tasks : [])
        .forEach(task => { if (task.id) localTasks[String(task.id)] = task; });

      // Mots
      const wRef = this.wordsRef();
      if (wRef) {
        const snap      = await wRef.get();
        const remoteIds = new Set();
        snap.forEach(doc => {
          const cloud = doc.data();
          if (!cloud.label) return;
          remoteIds.add(doc.id);
          const local = localWords[doc.id];
          if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
            localWords[doc.id] = { ...local, ...cloud, id: doc.id };
          }
        });
        Object.keys(localWords).forEach(id => {
          if (!remoteIds.has(id)) delete localWords[id];
        });
        console.debug(`[Sync↓] ${snap.size} mot(s) reçus`);
      }

      // Tâches
      const tRef = this.tasksRef();
      if (tRef) {
        const snap      = await tRef.get();
        const remoteIds = new Set();
        snap.forEach(doc => {
          const cloud = doc.data();
          if (!cloud.id) return;
          remoteIds.add(String(cloud.id));
          const local = localTasks[String(cloud.id)];
          if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
            localTasks[String(cloud.id)] = { ...local, ...cloud };
          }
        });
        Object.keys(localTasks).forEach(id => {
          if (!remoteIds.has(id)) delete localTasks[id];
        });
        console.debug(`[Sync↓] ${snap.size} tâche(s) reçues`);
      }

      // Doc user (catégories, timer, spelling)
      const uRef = this.userRef();
      if (uRef) {
        const uDoc = await uRef.get();
        if (uDoc.exists) {
          const data = uDoc.data();
          if (data.categories && typeof data.categories === 'object') {
            appState.categories = data.categories;
          }
          if (data.sources && typeof data.sources === 'object') {
            appState.sources = data.sources;
          }
          this._mergeTimerFromCloud(data);

          // Spelling SRS
          if (data.spellingCards || data.spellingToday) {
            let localSpelling = { cards: {}, today: {} };
            try {
              const raw = localStorage.getItem('lexique_spelling_srs');
              if (raw) localSpelling = JSON.parse(raw);
              localSpelling.cards ??= {};
              localSpelling.today ??= {};
            } catch { /* ignore */ }

            if (data.spellingCards) {
              Object.entries(data.spellingCards).forEach(([key, cloudCard]) => {
                const localCard = localSpelling.cards[key];
                if (!localCard || (cloudCard.reps || 0) >= (localCard.reps || 0)) {
                  localSpelling.cards[key] = cloudCard;
                }
              });
            }

            if (data.spellingToday) {
              Object.entries(data.spellingToday).forEach(([day, levels]) => {
                localSpelling.today[day] ??= {};
                Object.entries(levels || {}).forEach(([level, prog]) => {
                  if (level === '_exos') {
                    localSpelling.today[day]._exos ??= {};
                    Object.entries(prog || {}).forEach(([exoKey, val]) => {
                      const localVal = localSpelling.today[day]._exos[exoKey] || 0;
                      localSpelling.today[day]._exos[exoKey] = Math.max(localVal, typeof val === 'number' ? val : val ? 1 : 0);
                    });
                  } else if (level === '_exos_progress') {
                    localSpelling.today[day]._exos_progress ??= {};
                    Object.entries(prog || {}).forEach(([exoKey, exoProg]) => {
                      const local = localSpelling.today[day]._exos_progress[exoKey] || { done: 0, correct: 0 };
                      localSpelling.today[day]._exos_progress[exoKey] = {
                        done:    Math.max(local.done,    exoProg.done    || 0),
                        correct: Math.max(local.correct, exoProg.correct || 0),
                      };
                    });
                  } else {
                    const local = localSpelling.today[day][level] || { done: 0, correct: 0 };
                    localSpelling.today[day][level] = {
                      done:    Math.max(local.done,    prog.done    || 0),
                      correct: Math.max(local.correct, prog.correct || 0),
                    };
                  }
                });
              });
            }

            try { localStorage.setItem('lexique_spelling_srs', JSON.stringify(localSpelling)); } catch { /* quota */ }
          }
        }
      }

      appState.words = localWords;
      appState.tasks = Object.values(localTasks);
      Storage.writeState(appState);

      this.showStatus('synced');
      console.debug('[Sync↓] ✅ Pull initial terminé');
    } catch (err) {
      if (err.code === 'unavailable') this.showStatus('offline');
      else { console.error('[Sync↓] ❌ Erreur pull :', err); this.showStatus('error'); }
    }
  },
};

// ── Événements réseau & visibilité ────────────────────────────

window.addEventListener('online', () => {
  console.debug('[Sync] Reconnecté — push immédiat');
  CloudSync.pushToCloud();
});

window.addEventListener('offline', () => {
  CloudSync.showStatus('offline');
});

// Retour sur l'onglet : les onSnapshot auront déjà mis à jour,
// mais on force un push au cas où des writes locaux sont en attente.
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && fbReady && navigator.onLine) {
    // Push différé 2s pour laisser les onSnapshot se déclencher en premier
    setTimeout(() => CloudSync.schedule(2000), 2000);
  }
});

// ── Firebase initialisation ───────────────────────────────────

(function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('[Firebase] SDK non chargé — sync désactivé');
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();

    // Activer la persistance offline Firestore — les writes sont mis en queue
    // quand hors ligne et envoyés automatiquement à la reconnexion.
    db.enablePersistence({ synchronizeTabs: true })
      .then(() => console.debug('[Firebase] ✅ Persistance offline activée'))
      .catch(err => {
        if (err.code === 'failed-precondition') {
          // Plusieurs onglets ouverts — persistance désactivée sur cet onglet
          console.warn('[Firebase] Persistance désactivée (plusieurs onglets)');
        } else if (err.code === 'unimplemented') {
          console.warn('[Firebase] Persistance non supportée sur ce navigateur');
        }
      });

    console.debug('[Firebase] ✅ Firestore initialisé');

    firebase.auth().onAuthStateChanged(user => {
      AuthUI.update(user);

      if (user) {
        currentUid = user.uid;
        fbReady    = true;
        console.debug(`[Firebase] ✅ Auth ${user.isAnonymous ? 'anonyme' : 'Google'} — uid :`, currentUid);

        // Guard : onAuthStateChanged re-fire à chaque refresh de token (~1h)
        if (!firstPull) {
          console.debug('[Firebase] Re-auth — listeners déjà actifs, pas de re-pull');
          return;
        }
        firstPull = false;

        // 1. Pull initial pour hydrater l'app avant les listeners
        CloudSync.pullFromCloud()
          .then(() => {
            reRenderAll();
            // 2. Activer les listeners temps réel APRÈS le pull initial
            //    pour éviter les doubles renders au démarrage
            CloudSync.startListeners();
          })
          .catch(err => {
            console.warn('[Firebase] Premier pull échoué, retry dans 5s…', err);
            setTimeout(() => {
              CloudSync.pullFromCloud()
                .then(() => { reRenderAll(); CloudSync.startListeners(); })
                .catch(() => CloudSync.startListeners()); // listeners quand même
            }, 5000);
          });
      } else {
        // Pas de session — attendre 2s avant user anonyme
        console.debug('[Firebase] Pas de session — attente 2s…');
        setTimeout(() => {
          if (!firebase.auth().currentUser) {
            firebase.auth().signInAnonymously()
              .catch(err => console.error('[Firebase] signInAnonymously failed :', err));
          }
        }, 2000);
      }
    });
  } catch (err) {
    console.warn('[Firebase] Init error:', err);
  }
})();
