'use strict';

// ════════════════════════════════════════════════════════════════
//  FIREBASE CLOUD SYNC
//  ⚠️  Ne pas modifier sans tester la synchronisation complète.
//
//  SÉCURITÉ : La clé API Firebase ci-dessous est publique par nature
//  (elle identifie le projet côté client) mais les règles Firestore
//  doivent impérativement restreindre l'accès par UID.
//  Ne pas commettre de clé de service (Admin SDK) dans ce fichier.
// ════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyBY55p8u0kULi87qsuRvkfxyyNrn1eqBYc',
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
let firstPull  = true;

// ── Auth UI ───────────────────────────────────────────────────

const AuthUI = {
  /** Met à jour le bouton login dans le header selon l'état auth */
  update(user) {
    const btn = document.getElementById('authBtn');
    if (!btn) return;

    if (user && !user.isAnonymous) {
      // Connecté avec Google
      const name  = user.displayName || user.email || 'Compte';
      const photo = user.photoURL;
      btn.title   = name;
      btn.innerHTML = photo
        ? `<img src="${photo}" alt="" class="auth-avatar"> <span class="auth-name">${escHtml(name.split(' ')[0])}</span>`
        : `<span class="auth-avatar-initials">${escHtml(name[0].toUpperCase())}</span> <span class="auth-name">${escHtml(name.split(' ')[0])}</span>`;
      btn.classList.add('signed-in');
      btn.onclick = () => AuthUI.showMenu(user);
    } else {
      // Anonyme ou déconnecté
      btn.innerHTML = `<span class="auth-icon">👤</span> <span data-i18n="auth.sign_in">${t('auth.sign_in')}</span>`;
      btn.title     = t('auth.sign_in_title');
      btn.classList.remove('signed-in');
      btn.onclick = () => AuthService.signInWithGoogle();
    }
  },

  showMenu(user) {
    // Petit menu contextuel : nom + déconnexion
    let menu = document.getElementById('authMenu');
    if (menu) { menu.remove(); return; } // toggle

    menu = document.createElement('div');
    menu.id        = 'authMenu';
    menu.className = 'auth-menu';
    menu.innerHTML = `
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

    // Fermer au clic extérieur
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
    const provider  = new firebase.auth.GoogleAuthProvider();
    const anonUser  = firebase.auth().currentUser;

    try {
      // Si l'utilisateur est anonyme, on tente de lier son compte Google
      // pour migrer ses données → linkWithPopup conserve le même UID
      if (anonUser && anonUser.isAnonymous) {
        try {
          await anonUser.linkWithPopup(provider);
          console.debug('[Auth] ✅ Compte anonyme lié à Google — UID conservé :', anonUser.uid);
          // onAuthStateChanged se re-déclenche avec le même UID et isAnonymous=false
          return;
        } catch (linkErr) {
          // credential-already-in-use → ce compte Google existe déjà
          // On signe directement avec Google (ses données cloud seront récupérées)
          if (linkErr.code === 'auth/credential-already-in-use') {
            console.debug('[Auth] Compte Google déjà existant — connexion directe');
            await firebase.auth().signInWithPopup(provider);
            return;
          }
          throw linkErr;
        }
      }

      // Pas de session anonyme — connexion directe
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
    try {
      await firebase.auth().signOut();
      console.debug('[Auth] Déconnecté');
    } catch (err) {
      console.error('[Auth] Erreur déconnexion :', err);
    }
  },
};

// ── CloudSync ────────────────────────────────────────────────

/** Fusionne deux tableaux sur une clé unique, le cloud l'emporte en cas de doublon */
function mergeById(local, cloud, key) {
  const map = new Map();
  local.forEach(item => { if (item[key] != null) map.set(item[key], item); });
  cloud.forEach(item => { if (item[key] != null) map.set(item[key], item); }); // cloud wins
  return [...map.values()].sort((a, b) => (b[key] || 0) - (a[key] || 0));
}

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
    badge.textContent = c.icon;
    badge.style.color = c.color;
    badge.title       = c.title;
  },

  schedule(delayMs = 2000) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (navigator.onLine) this.pushToCloud();
      else this.showStatus('offline');
    }, delayMs);
  },

  // ── PUSH ────────────────────────────────────────────────────

  async pushToCloud() {
    if (!fbReady || !db || !currentUid || isSyncing) {
      console.debug('[Sync↑] Push ignoré —', { fbReady, db: !!db, currentUid, isSyncing });
      return;
    }
    isSyncing = true;
    this.showStatus('syncing');
    console.debug('[Sync↑] Début push vers Firestore…');

    try {
      const st    = Storage.readState();
      const words = st.words || {};
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      const now   = Date.now();
      const BATCH = 400;

      // ── Mots ──────────────────────────────────────────────
      const wRef = this.wordsRef();
      if (wRef) {
        const entries = Object.entries(words);
        console.debug(`[Sync↑] ${entries.length} mot(s) à pousser`);

        const remoteSnap = await wRef.get();
        const remoteDeletions = [];
        remoteSnap.forEach(doc => {
          if (!words[doc.id]) remoteDeletions.push(doc.id);
        });
        if (remoteDeletions.length) {
          const delBatch = db.batch();
          remoteDeletions.forEach(id => delBatch.delete(wRef.doc(id)));
          await delBatch.commit();
          console.debug(`[Sync↑] ${remoteDeletions.length} mot(s) supprimé(s) de Firestore ✓`);
        }

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
          console.debug(`[Sync↑] Batch mots ${i}–${i + BATCH} commité ✓`);
        }
      }

      // ── Tâches ────────────────────────────────────────────
      const tRef = this.tasksRef();
      if (tRef && tasks.length > 0) {
        console.debug(`[Sync↑] ${tasks.length} tâche(s) à pousser`);
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
          console.debug(`[Sync↑] Batch tâches ${i}–${i + BATCH} commité ✓`);
        }
      }

      // ── Catégories + Timer + métadonnées ─────────────────
      const cats    = st.categories || {};
      const sources = st.sources    || {};

      // Timer : sessions et milestones (drapeaux)
      let timerData = {};
      try {
        const rawTimer = localStorage.getItem('lexique_timer');
        if (rawTimer) timerData = JSON.parse(rawTimer);
      } catch { /* ignore */ }

      const uRef = this.userRef();
      if (uRef) {
        await uRef.set({
          lastSync:        Date.now(),
          appVersion:      'lexique-v6',
          categories:      cats,
          sources:         sources,
          timerSessions:   Array.isArray(timerData.sessions)   ? timerData.sessions   : [],
          timerMilestones: Array.isArray(timerData.milestones) ? timerData.milestones : [],
        }, { merge: true });
        console.debug('[Sync↑] Catégories + Timer poussés ✓');
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

  // ── PULL ────────────────────────────────────────────────────

  async pullFromCloud() {
    if (!fbReady || !db || !currentUid) {
      console.debug('[Sync↓] Pull ignoré —', { fbReady, db: !!db, currentUid });
      return;
    }
    this.showStatus('syncing');
    console.debug('[Sync↓] Début pull depuis Firestore…');

    try {
      const appState   = Storage.readState();
      const localWords = appState.words || {};
      const localTasks = {};
      (Array.isArray(appState.tasks) ? appState.tasks : []).forEach(task => {
        if (task.id) localTasks[String(task.id)] = task;
      });

      // ── Mots ──────────────────────────────────────────────
      const wRef = this.wordsRef();
      if (wRef) {
        const snap = await wRef.get();
        console.debug(`[Sync↓] ${snap.size} mot(s) reçus depuis Firestore`);

        // Construire l'index des mots présents dans Firestore
        const remoteWordIds = new Set();
        snap.forEach(doc => {
          const cloud = doc.data();
          if (!cloud.label) {
            console.warn('[Sync↓] Doc ignoré — label manquant :', doc.id);
            return;
          }
          remoteWordIds.add(doc.id);
          const local = localWords[doc.id];
          if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
            localWords[doc.id] = { ...local, ...cloud, id: doc.id };
          }
        });

        // Supprimer les mots locaux absents de Firestore
        const deletedWords = Object.keys(localWords).filter(id => !remoteWordIds.has(id));
        deletedWords.forEach(id => {
          console.debug('[Sync↓] Suppression locale du mot absent de Firestore :', id);
          delete localWords[id];
        });
        if (deletedWords.length) {
          console.debug(`[Sync↓] ${deletedWords.length} mot(s) supprimé(s) localement`);
        }
      }

      // ── Tâches ────────────────────────────────────────────
      const tRef = this.tasksRef();
      if (tRef) {
        const snap = await tRef.get();
        console.debug(`[Sync↓] ${snap.size} tâche(s) reçues depuis Firestore`);

        // Construire l'index des tâches présentes dans Firestore
        const remoteTaskIds = new Set();
        snap.forEach(doc => {
          const cloud = doc.data();
          if (cloud.id) remoteTaskIds.add(String(cloud.id));
          const local = localTasks[String(cloud.id)];
          if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
            localTasks[String(cloud.id)] = { ...local, ...cloud };
          }
        });

        // Supprimer les tâches locales absentes de Firestore
        Object.keys(localTasks).forEach(id => {
          if (!remoteTaskIds.has(id)) {
            console.debug('[Sync↓] Suppression locale de la tâche absente de Firestore :', id);
            delete localTasks[id];
          }
        });
      }

      // ── Catégories ────────────────────────────────────────
      const uRef2 = this.userRef();
      if (uRef2) {
        const uDoc = await uRef2.get();
        if (uDoc.exists) {
          const data = uDoc.data();

          // Catégories — remplacement complet (le cloud fait foi)
          const cloudCats = data.categories;
          if (cloudCats && typeof cloudCats === 'object') {
            appState.categories = cloudCats;
            console.debug('[Sync↓] Catégories reçues :', Object.keys(cloudCats).length);
          }

          // Sources personnalisées
          const cloudSources = data.sources;
          if (cloudSources && typeof cloudSources === 'object') {
            appState.sources = cloudSources;
            console.debug('[Sync↓] Sources reçues :', Object.keys(cloudSources).length);
          }

          // Timer
          const cloudSessions   = data.timerSessions;
          const cloudMilestones = data.timerMilestones;
          if (cloudSessions || cloudMilestones) {
            let localTimer = {};
            try {
              const rawTimer = localStorage.getItem('lexique_timer');
              if (rawTimer) localTimer = JSON.parse(rawTimer);
            } catch { /* ignore */ }

            // Fusion : on prend le plus grand ensemble (pas de suppression pour le timer)
            const localSessions   = Array.isArray(localTimer.sessions)   ? localTimer.sessions   : [];
            const localMilestones = Array.isArray(localTimer.milestones) ? localTimer.milestones : [];

            const mergedSessions = mergeById(localSessions, cloudSessions || [], 'startedAt');
            const mergedMilestones = mergeById(localMilestones, cloudMilestones || [], 'ts');

            localTimer.sessions   = mergedSessions.slice(0, 200);
            localTimer.milestones = mergedMilestones.slice(0, 200);
            try { localStorage.setItem('lexique_timer', JSON.stringify(localTimer)); } catch { /* quota */ }
            console.debug('[Sync↓] Timer reçu : ' + mergedSessions.length + ' sessions');
          }
        }
      }

      appState.words = localWords;
      appState.tasks = Object.values(localTasks);
      Storage.writeState(appState);

      this.showStatus('synced');
      console.debug('[Sync↓] ✅ Pull terminé');
    } catch (err) {
      if (err.code === 'unavailable') this.showStatus('offline');
      else { console.error('[Sync↓] ❌ Erreur pull :', err); this.showStatus('error'); }
    }
  },
};

// Trigger sync on connectivity changes
window.addEventListener('online',  () => CloudSync.pushToCloud());
window.addEventListener('offline', () => CloudSync.showStatus('offline'));

// Pull quand la fenêtre reprend le focus (ex : retour sur l'onglet PC après avoir modifié sur mobile)
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && fbReady && navigator.onLine) {
    CloudSync.pullFromCloud().then(() => {
      load();
      autoReportTasks(); // après pull pour ne pas écraser les actions d'autres appareils
      rebuildNgrams();
      render(); renderTasks(); updateStats(); updateTaskStats();
      renderCatManager(); renderCatSelect(); renderFilters();
      renderTimerHistory(); timerTick();
    }).catch(() => {});
  }
});

// Pull périodique toutes les 60 secondes si la page est visible
setInterval(() => {
  if (document.visibilityState === 'visible' && fbReady && navigator.onLine && !isSyncing) {
    CloudSync.pullFromCloud().then(() => {
      load();
      autoReportTasks(); // après pull
      rebuildNgrams();
      render(); renderTasks(); updateStats(); updateTaskStats();
      renderCatManager(); renderCatSelect(); renderFilters();
      renderTimerHistory(); timerTick();
    }).catch(() => {});
  }
}, 60_000);

// ── Firebase initialisation ───────────────────────────────────

(function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('[Firebase] SDK non chargé — sync désactivé');
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    console.debug('[Firebase] ✅ Firestore initialisé');

    firebase.auth().onAuthStateChanged(user => {
      // Met à jour le bouton header dans tous les cas
      AuthUI.update(user);

      if (user) {
        currentUid = user.uid;
        fbReady    = true;
        const type = user.isAnonymous ? 'anonyme' : 'Google';
        console.debug(`[Firebase] ✅ Auth ${type} — uid :`, currentUid);

        // Guard: onAuthStateChanged re-fires on every token refresh.
        if (!firstPull) {
          console.debug('[Firebase] Re-auth ignoré — pas de pull (firstPull=false)');
          return;
        }
        firstPull = false;

        const afterPull = () => {
          load();
          autoReportTasks(); // après le pull — les tâches cochées sur d'autres appareils sont déjà dans state
          rebuildNgrams();
          render(); renderTasks(); updateStats(); updateTaskStats();
          renderCatManager(); renderCatSelect(); renderFilters();
          renderTimerHistory(); timerTick();
        };

        CloudSync.pullFromCloud()
          .then(afterPull)
          .catch(err => {
            console.warn('[Firebase] Premier pull échoué, retry dans 5s…', err);
            setTimeout(() => CloudSync.pullFromCloud().then(afterPull).catch(() => {}), 5000);
          });
      } else {
        console.debug('[Firebase] Pas de session — connexion anonyme…');
        firebase.auth().signInAnonymously().catch(err => {
          console.error('[Firebase] signInAnonymously failed :', err);
        });
      }
    });
  } catch (err) {
    console.warn('[Firebase] Init error:', err);
  }
})();

