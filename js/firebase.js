'use strict';

// ════════════════════════════════════════════════════════════════
//  FIREBASE CLOUD SYNC  ⚠️  Do not modify without testing sync.
// ════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyBY55p8u0kULi87qsuRvkfxyyNrn1eqBYc',           // ✅ CORRIGÉ — champ manquant
  authDomain:        'lexique-999ff.firebaseapp.com',
  projectId:         'lexique-999ff',
  storageBucket:     'lexique-999ff.firebasestorage.app',
  messagingSenderId: '32359120766',
  appId:             '1:32359120766:web:91b8b664b4bbf67a717d2f',
};

let db         = null;
let currentUid = null;
let isSyncing  = false;
let fbReady    = false;
let syncTimer  = null;

const CloudSync = {
  userRef()  { return db && currentUid ? db.collection('users').doc(currentUid) : null; },
  wordsRef() { const u = this.userRef(); return u ? u.collection('words') : null; },
  tasksRef() { const u = this.userRef(); return u ? u.collection('tasks') : null; },

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
    badge.textContent  = c.icon;
    badge.style.color  = c.color;
    badge.title        = c.title;
  },

  schedule(delayMs = 2000) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (navigator.onLine) this.pushToCloud();
      else this.showStatus('offline');
    }, delayMs);
  },

  async pushToCloud() {
    if (!fbReady || !db || !currentUid || isSyncing) return;
    isSyncing = true;
    this.showStatus('syncing');
    try {
      const st    = Storage.readState();
      const words = st.words || {};
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      const now   = Date.now();
      const BATCH = 400;

      const wRef = this.wordsRef();
      if (wRef) {
        const entries = Object.entries(words);
        for (let i = 0; i < entries.length; i += BATCH) {
          const batch = db.batch();
          entries.slice(i, i + BATCH).forEach(([id, w]) => {
            batch.set(wRef.doc(String(id)), {
              text:        w.text        ?? '',
              occurrences: Array.isArray(w.occurrences) ? w.occurrences : [], // ✅ CORRIGÉ
              category:    w.category    ?? '',
              note:        w.note        ?? '',
              ankiDone:    w.ankiDone    ?? false,
              addedAt:     w.addedAt     ?? now,
              updatedAt:   w.updatedAt   ?? now,
            }, { merge: true });
          });
          await batch.commit();
        }
      }

      const tRef = this.tasksRef();
      if (tRef && tasks.length > 0) {
        for (let i = 0; i < tasks.length; i += BATCH) {
          const batch = db.batch();
          tasks.slice(i, i + BATCH).forEach(task => {
            if (!task.id) return;
            batch.set(tRef.doc(String(task.id)), {
              id:            task.id,
              title:         task.title         ?? '',
              note:          task.note          ?? '',
              category:      task.category      ?? '',
              dueDate:       task.dueDate        ?? '',
              done:          task.done           ?? false,
              doneAt:        task.doneAt         ?? null,
              recurType:     task.recurType      ?? 'once',
              recurDays:     task.recurDays      ?? [],
              history:       task.history        ?? {},
              reportHistory: task.reportHistory  ?? [],
              createdAt:     task.createdAt      ?? now,
              updatedAt:     task.updatedAt      ?? now,
            }, { merge: true });
          });
          await batch.commit();
        }
      }

      const u = this.userRef();
      if (u) await u.set({ lastSync: Date.now(), appVersion: 'lexique-v6' }, { merge: true });
      this.showStatus('synced');
    } catch (err) {
      console.error('[Sync↑]', err);
      this.showStatus('error');
    } finally {
      isSyncing = false;
    }
  },

  async pullFromCloud() {
    if (!fbReady || !db || !currentUid) return;
    this.showStatus('syncing');
    try {
      const appState   = Storage.readState();
      const localWords = appState.words || {};
      const localTasks = {};
      (Array.isArray(appState.tasks) ? appState.tasks : []).forEach(task => {
        if (task.id) localTasks[String(task.id)] = task;
      });

      const wRef = this.wordsRef();
      if (wRef) {
        const snap = await wRef.get();
        snap.forEach(doc => {
          const cloud = doc.data();
          const local = localWords[doc.id];
          if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
            localWords[doc.id] = { ...local, ...cloud, id: doc.id };
          }
        });
      }

      const tRef = this.tasksRef();
      if (tRef) {
        const snap = await tRef.get();
        snap.forEach(doc => {
          const cloud = doc.data();
          const local = localTasks[String(cloud.id)];
          if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
            localTasks[String(cloud.id)] = { ...local, ...cloud };
          }
        });
      }

      appState.words = localWords;
      appState.tasks = Object.values(localTasks);
      Storage.writeState(appState);
      this.showStatus('synced');
    } catch (err) {
      if (err.code === 'unavailable') this.showStatus('offline');
      else { console.error('[Sync↓]', err); this.showStatus('error'); }
    }
  },
};

// Trigger sync on connectivity changes
window.addEventListener('online',  () => CloudSync.pushToCloud());
window.addEventListener('offline', () => CloudSync.showStatus('offline'));

// ── Firebase initialisation ───────────────────────────────────

(function initFirebase() {
  try {
    if (typeof firebase === 'undefined') return;
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        currentUid = user.uid;
        fbReady    = true;
        CloudSync.pullFromCloud().then(() => {
          load();
          render(); renderTasks(); updateStats(); updateTaskStats();
        });
      } else {
        firebase.auth().signInAnonymously().catch(console.error);
      }
    });
  } catch (err) {
    console.warn('[Firebase] Init error:', err);
  }
})();