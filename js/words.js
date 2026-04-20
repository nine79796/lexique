'use strict';

// ════════════════════════════════════════════════════════════════
//  WORDS — CRUD & Wordnik validation
// ════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────

const isAnkiReady  = w => Array.isArray(w.occurrences) && w.occurrences.length >= ANKI_THRESHOLD && !w.ankiDone;
// FIX : était >= MAX_CLICKS, ce qui bloquait le 3e clic avant qu'il soit enregistré
const isMaxReached = w => Array.isArray(w.occurrences) && w.occurrences.length > MAX_CLICKS;

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

  console.debug('[addWord] Ajout :', label);

  const key    = label.toLowerCase().replace(/\s+/g, '_');
  const catKey = sel.value || null;
  const now    = ts();

  if (!state.words[key]) {
    state.words[key] = {
      label,
      createdAt:   now,
      updatedAt:   now,
      catKey,
      occurrences: [now],
      ankiDone:    false,
      validity:    'unknown',
    };
    console.debug('[addWord] Nouveau mot créé :', key);
  } else {
    if (isMaxReached(state.words[key])) {
      notify('max', label);
      inp.value = '';
      return;
    }
    state.words[key].occurrences.push(now);
    state.words[key].updatedAt = now;
    if (catKey) state.words[key].catKey = catKey;
    console.debug('[addWord] Occurrence ajoutée :', key, '→', state.words[key].occurrences.length, 'fois');
  }

  inp.value = '';
  document.getElementById('validationStrip').innerHTML = '';
  save();
  updateStats();
  render();
  rebuildNgrams();

  if (state.words[key].occurrences.length === ANKI_THRESHOLD) notify('anki', label);
  if (navigator.onLine) await validateWord(label);
}

function clickWord(key) {
  const w = state.words[key];
  if (!w) return;
  if (isMaxReached(w)) { notify('max', w.label); return; }

  const now = Date.now();
  w.occurrences.push(now);
  w.updatedAt = now;

  const count = w.occurrences.length;
  if (count === ANKI_THRESHOLD) notify('anki', w.label);

  save();
  updateStats();
  // FIX : on ne recrée QUE la carte du mot cliqué, pas tout le DOM
  refreshWordCard(key);
}

async function deleteWord(key) {
  if (!state.words[key]) return;

  // Sauvegarde le label AVANT de supprimer (sinon state.words[key] est undefined)
  const label = state.words[key].label;

  delete state.words[key];
  save();
  updateStats();
  render();
  rebuildNgrams();

  console.debug('[deleteWord] Supprimé localement :', key, '—', label);

  // Suppression Firestore avec retry si pas encore prêt
  deleteFromFirestore(key);
}

function markAnkiDone(key) {
  if (!state.words[key]) return;

  // Supprime le mot localement immédiatement
  delete state.words[key];
  save();
  updateStats();
  render();

  console.debug('[markAnkiDone] Supprimé localement :', key);

  // Suppression Firestore avec retry si pas encore prêt
  deleteFromFirestore(key);
}

/**
 * Supprime un doc Firestore de manière robuste.
 * Réessaie toutes les 500ms pendant 10s si Firebase n'est pas encore prêt.
 */
function deleteFromFirestore(key, attempts = 0) {
  const MAX_ATTEMPTS = 20; // 10 secondes max
  try {
    const wRef = CloudSync.wordsRef();
    if (wRef) {
      wRef.doc(String(key)).delete()
        .then(() => console.debug('[Firestore] Supprimé :', key))
        .catch(err => console.error('[Firestore] Erreur suppression :', err));
    } else if (attempts < MAX_ATTEMPTS) {
      // Firebase pas encore prêt — on réessaie dans 500ms
      console.debug('[Firestore] Pas encore prêt, retry dans 500ms (' + (attempts + 1) + '/' + MAX_ATTEMPTS + ')');
      setTimeout(() => deleteFromFirestore(key, attempts + 1), 500);
    } else {
      console.warn('[Firestore] Abandon suppression après ' + MAX_ATTEMPTS + ' tentatives :', key);
    }
  } catch (err) {
    console.error('[Firestore] Erreur deleteFromFirestore :', err);
  }
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

  const key = word.toLowerCase().replace(/\s+/g, '_');
  if (state.words[key]) {
    state.words[key].validity  = result === true ? 'valid' : result === false ? 'invalid' : 'unknown';
    state.words[key].updatedAt = ts();
    save();
    refreshWordCard(key);
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
