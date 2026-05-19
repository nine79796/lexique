'use strict';

// ════════════════════════════════════════════════════════════════
//  WORDS — CRUD & Wordnik validation
//
//  v2 : toutes les mutations écrivent directement dans Firestore
//  via FireStore.saveWord() avec optimistic update en mémoire.
//  Plus de save() global — onSnapshot met à jour les autres appareils.
// ════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────

const isAnkiReady = w => Array.isArray(w.occurrences) && w.occurrences.length >= ANKI_THRESHOLD && !w.ankiDone;

// ── Category colour ───────────────────────────────────────────

function getCatColor(key) {
  const cat = state.categories[key];
  return cat ? PALETTE[cat.colorIdx % PALETTE.length] : null;
}

// ── CRUD ──────────────────────────────────────────────────────

/**
 * Enregistre une occurrence en mémoire.
 * L'appelant est responsable d'écrire dans Firestore ensuite.
 */
function recordOccurrence(key) {
  const w = state.words[key];
  if (!w) return false;

  const now = Date.now();
  w.occurrences.push(now);
  w.updatedAt = now;

  if (w.occurrences.length === ANKI_THRESHOLD) notify('anki', w.label);
  return true;
}

async function addWord() {
  const inp    = document.getElementById('wordInput');
  const sel    = document.getElementById('catSelect');
  const srcSel = document.getElementById('sourceSelect');
  const label  = inp.value.trim();
  if (!label) return;

  const key    = label.toLowerCase().replace(/\s+/g, '_');
  const catKey = sel.value || (typeof _cselectState !== 'undefined' ? _cselectState.cat || null : null);
  const source = (srcSel && srcSel.value) ? srcSel.value : (typeof _cselectState !== 'undefined' ? _cselectState.source || null : null);
  const now    = ts();

  // ── Optimistic update en mémoire ────────────────────────────
  if (!state.words[key]) {
    state.words[key] = {
      label,
      createdAt:   now,
      updatedAt:   now,
      catKey,
      source,
      occurrences: [],
      ankiDone:    false,
      ankiDoneAt:  null,
      validity:    'unknown',
    };
  } else {
    if (catKey) state.words[key].catKey = catKey;
    if (source) state.words[key].source = source;
  }

  const ok = recordOccurrence(key);
  if (!ok) { inp.value = ''; return; }

  // ── UI immédiate ────────────────────────────────────────────
  inp.value = '';
  document.getElementById('validationStrip').innerHTML = '';
  updateStats();
  render();
  rebuildNgrams();

  // ── Écriture Firestore (+ cache local en fallback offline) ──
  await FireStore.saveWord(key, state.words[key]);

  if (navigator.onLine) await validateWord(label);
}

function clickWord(key) {
  const w = state.words[key];
  if (!w) return;

  const ok = recordOccurrence(key);
  if (!ok) return;

  // ── UI immédiate (optimistic) ───────────────────────────────
  requestAnimationFrame(() => {
    refreshWordCard(key);
    updateStats();
    showUndoBtn(key);
  });

  // ── Écriture Firestore différée 50ms pour ne pas bloquer le touch ──
  setTimeout(() => {
    FireStore.saveWord(key, state.words[key]);
  }, 50);
}

/**
 * Annule le dernier clic — retire la dernière occurrence et
 * met à jour Firestore.
 */
function undoLastClick(key) {
  const w = state.words[key];
  if (!w || !w.occurrences.length) return;

  w.occurrences.pop();
  w.updatedAt = ts();

  hideUndoBtn();
  FireStore.saveWord(key, w);

  if (w.occurrences.length < ANKI_THRESHOLD) render();
  else refreshWordCard(key);
  updateStats();
}

// ── Undo UI ───────────────────────────────────────────────────

let undoTimer = null;

function showUndoBtn(key) {
  clearTimeout(undoTimer);

  let btn = document.getElementById('undoClickBtn');
  if (!btn) {
    btn           = document.createElement('button');
    btn.id        = 'undoClickBtn';
    btn.className = 'undo-click-btn';
    document.body.appendChild(btn);
  }

  const w = state.words[key];
  btn.textContent = `↩ ${t('words.undo_click')} "${escHtml(w?.label ?? '')}"`;
  btn.onclick     = () => undoLastClick(key);
  btn.classList.add('visible');

  undoTimer = setTimeout(hideUndoBtn, 5000);
}

function hideUndoBtn() {
  document.getElementById('undoClickBtn')?.classList.remove('visible');
  clearTimeout(undoTimer);
}

async function deleteWord(key) {
  if (!state.words[key]) return;

  // ── Optimistic : retire de l'état mémoire immédiatement ────
  delete state.words[key];
  updateStats();
  render();
  rebuildNgrams();

  // ── Suppression Firestore ───────────────────────────────────
  await FireStore.deleteWord(key);
}

function markAnkiDone(key) {
  if (!state.words[key]) return;

  const w = state.words[key];
  w.ankiDone   = true;
  w.ankiDoneAt = Date.now();
  w.updatedAt  = Date.now();

  // Optimistic UI
  updateStats();
  refreshWordCard(key);

  // Écriture Firestore
  FireStore.saveWord(key, w);
}

// ── Wordnik validation ────────────────────────────────────────

async function checkWordnik(word) {
  if (!WORDNIK_API_KEY || WORDNIK_API_KEY.startsWith('VOTRE')) return null;
  try {
    const res = await fetch(
      `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word.toLowerCase())}/definitions?limit=3&useCanonical=false&api_key=${WORDNIK_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.status === 404) return false;
    if (!res.ok)            return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return false;

    const wordLow = word.toLowerCase();
    return data.some(d => (d.word || '').toLowerCase() === wordLow);
  } catch { return null; }
}

async function validateWord(word) {
  const strip = document.getElementById('validationStrip');
  if (!word)                               { strip.innerHTML = ''; return; }
  if (validationCache[word] !== undefined) { renderValidationStrip(strip, word, validationCache[word]); return; }
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
  const w   = state.words[key];
  if (w) {
    w.validity  = result === true ? 'valid' : result === false ? 'invalid' : 'unknown';
    w.updatedAt = ts();
    FireStore.saveWord(key, w);
    refreshWordCard(key);
  }
}

/** Debounce Wordnik check on every keystroke in the word input. */
function onWordInputChange() {
  const word = document.getElementById('wordInput').value.trim();
  clearTimeout(validationTimer);
  document.getElementById('validationStrip').innerHTML = '';
  if (!word || word.length < 2) return;
  validationTimer = setTimeout(() => validateWord(word), 600);
}
