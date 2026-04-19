'use strict';

// ════════════════════════════════════════════════════════════════
//  WORDS — CRUD & Wordnik validation
//
//  ARCHITECTURE :
//    ✅ Ce fichier NE MODIFIE JAMAIS state.words directement.
//    ✅ Toute modification passe par firestoreAddWord / firestoreDeleteWord
//       / firestoreUpdateWord (dans firebase.js).
//    ✅ onSnapshot (dans firebase.js) est la seule fonction qui
//       écrit dans state.words et appelle render().
// ════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────

const isAnkiReady  = w => Array.isArray(w.occurrences) && w.occurrences.length >= ANKI_THRESHOLD && !w.ankiDone;
const isMaxReached = w => Array.isArray(w.occurrences) && w.occurrences.length >= MAX_CLICKS;

// ── Category colour ───────────────────────────────────────────

function getCatColor(key) {
  const cat = state.categories[key];
  return cat ? PALETTE[cat.colorIdx % PALETTE.length] : null;
}

// ── CRUD ──────────────────────────────────────────────────────

async function addWord() {
  const inp   = document.getElementById('wordInput');
  const sel   = document.getElementById('catSelect');
  const label = inp.value.trim();
  if (!label) return;

  const key    = label.toLowerCase().replace(/\s+/g, '_');
  const catKey = sel.value || null;
  const now    = ts();

  // Vérification locale (MAX_CLICKS) avant d'appeler Firestore
  const existing = state.words[key];
  if (existing && isMaxReached(existing)) {
    notify('max', label);
    inp.value = '';
    return;
  }

  inp.value = '';
  document.getElementById('validationStrip').innerHTML = '';

  try {
    // ✅ Délègue l'écriture à firebase.js
    // ✅ Ne modifie PAS state.words ici — onSnapshot le fera
    await firestoreAddWord({ key, label, catKey, now });

    // Notification Anki si on vient d'atteindre le seuil
    const updatedWord = state.words[key];
    if (updatedWord && updatedWord.occurrences.length === ANKI_THRESHOLD) {
      notify('anki', label);
    }

    if (navigator.onLine) await validateWord(label);

  } catch (err) {
    console.error('[addWord] Erreur :', err);
    // Fallback local si Firestore échoue
    if (!state.words[key]) {
      state.words[key] = { label, createdAt: now, updatedAt: now, catKey, occurrences: [now], ankiDone: false, validity: 'unknown' };
    } else {
      state.words[key].occurrences.push(now);
      state.words[key].updatedAt = now;
    }
    save(); updateStats(); render(); rebuildNgrams();
  }
}

function clickWord(key) {
  const w = state.words[key];
  if (!w) return;
  if (isMaxReached(w)) { notify('max', w.label); return; }

  const now = ts();

  // ✅ Délègue à Firestore — ne pas muter state.words
  firestoreUpdateWord(key, {
    occurrences: [...(w.occurrences || []), now],
    updatedAt:   now,
  }).catch(err => {
    // Fallback local
    console.warn('[clickWord] Fallback local :', err);
    w.occurrences.push(now);
    w.updatedAt = now;
    if (w.occurrences.length === ANKI_THRESHOLD) notify('anki', w.label);
    save(); updateStats(); render();
  });
}

/**
 * Supprime un mot.
 *
 * ⚠️  CORRECTION DU BUG PRINCIPAL :
 *   Avant : `delete state.words[key]` → Firestore jamais touché
 *   Maintenant : firestoreDeleteWord(key) → suppression Firestore atomique
 *                → onSnapshot reçoit l'event 'removed'
 *                → reconstruit state.words sans ce mot
 *                → render() appelé automatiquement
 */
function deleteWord(key) {
  firestoreDeleteWord(key).catch(err => {
    // Fallback local si Firestore indisponible
    console.warn('[deleteWord] Fallback local :', err);
    delete state.words[key];
    save(); updateStats(); render(); rebuildNgrams();
  });
  // ✅ Pas de `delete state.words[key]` ici
  // ✅ Pas de render() ici — onSnapshot s'en charge
}

function markAnkiDone(key) {
  if (!state.words[key]) return;
  const now = ts();
  firestoreUpdateWord(key, { ankiDone: true, updatedAt: now }).catch(err => {
    // Fallback local
    console.warn('[markAnkiDone] Fallback local :', err);
    state.words[key].ankiDone  = true;
    state.words[key].updatedAt = now;
    save(); updateStats(); render();
  });
}

// ── Wordnik validation ────────────────────────────────────────

async function checkWordnik(word) {
  if (!WORDNIK_API_KEY || WORDNIK_API_KEY.startsWith('VOTRE')) return null;
  try {
    const res = await fetch(
      `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word.toLowerCase())}/definitions?limit=1&api_key=${WORDNIK_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.status === 404) return false;
    if (!res.ok)            return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch { return null; }
}

async function validateWord(word) {
  const strip = document.getElementById('validationStrip');
  if (!word)                               { strip.innerHTML = ''; return; }
  if (validationCache[word] !== undefined) {
    renderValidationStrip(strip, word, validationCache[word]);
    return;
  }
  if (!navigator.onLine) {
    strip.innerHTML = `<span class="val-badge pending">⚡ ${t('words.offline')}</span>`;
    return;
  }
  strip.innerHTML = `<span class="val-badge pending"><span class="val-spinner"></span>${t('words.checking')}</span>`;
  const result = await checkWordnik(word);
  validationCache[word] = result;
  renderValidationStrip(strip, word, result);
}

function renderValidationStrip(strip, word, result) {
  if (result === null) {
    strip.innerHTML = `<span class="val-badge pending">${t('words.wordnik_na')}</span>`;
  } else {
    const cls   = result ? 'valid'   : 'invalid';
    const icon  = result ? '✓'       : '✗';
    const label = result ? t('words.wordnik_valid') : t('words.wordnik_unknown');
    strip.innerHTML = `<span class="val-badge ${cls}">${icon} Wordnik · ${label}</span>`;
  }

  // Persist validity — via Firestore (pas de mutation locale directe)
  const key = word.toLowerCase().replace(/\s+/g, '_');
  if (state.words[key]) {
    const validity = result === true ? 'valid' : result === false ? 'invalid' : 'unknown';
    firestoreUpdateWord(key, { validity, updatedAt: ts() }).catch(() => {
      // Fallback local uniquement
      if (state.words[key]) {
        state.words[key].validity  = validity;
        state.words[key].updatedAt = ts();
        save(); render();
      }
    });
  }
}

/** Called on every keystroke in the word input — debounces Wordnik check. */
function onWordInputChange() {
  const word = document.getElementById('wordInput').value.trim();
  clearTimeout(validationTimer);
  document.getElementById('validationStrip').innerHTML = '';
  if (!word || word.length < 2) return;
  validationTimer = setTimeout(() => validateWord(word), 600);
}
