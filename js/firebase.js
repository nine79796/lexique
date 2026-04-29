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
              occurrences: Array.isArray(w.occurrences) ? w.occurrences : [],
              note:        w.note        ?? '',
              ankiDone:    w.ankiDone    ?? false,
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

      const u = this.userRef();
      if (u) await u.set({ lastSync: Date.now(), appVersion: 'lexique-v6' }, { merge: true });

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
        snap.forEach(doc => {
          const cloud = doc.data();
          if (!cloud.label) {
            console.warn('[Sync↓] Doc ignoré — label manquant :', doc.id);
            return;
          }
          const local = localWords[doc.id];
          if (!local || (cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
            localWords[doc.id] = { ...local, ...cloud, id: doc.id };
          }
        });
      }

      // ── Tâches ────────────────────────────────────────────
      const tRef = this.tasksRef();
      if (tRef) {
        const snap = await tRef.get();
        console.debug(`[Sync↓] ${snap.size} tâche(s) reçues depuis Firestore`);
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
          rebuildNgrams();
          render(); renderTasks(); updateStats(); updateTaskStats();
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
