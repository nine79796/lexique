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

  // Push immédiat vers Firestore pour éviter qu'un pull ultérieur
  // écrase le clic avec une version moins récente
  if (navigator.onLine) CloudSync.schedule(300);

  // Si on vient d'atteindre le seuil Anki ou le max, on force un render()
  // complet car la carte change d'apparence (badge, bouton désactivé, etc.)
  if (count === ANKI_THRESHOLD || count === MAX_CLICKS || count > MAX_CLICKS) {
    render();
  } else {
    refreshWordCard(key);
  }
}

async function deleteWord(key) {
  if (!state.words[key]) return;

  delete state.words[key];
  save();
  updateStats();
  render();
  rebuildNgrams();

  try {
    const wRef = CloudSync.wordsRef();
    if (wRef) {
      await wRef.doc(String(key)).delete();
      console.debug('[deleteWord] Firestore supprimé :', key);
    }
  } catch (err) {
    console.error('[deleteWord] erreur Firestore :', err);
  }
}

function markAnkiDone(key) {
  if (!state.words[key]) return;

  state.words[key].ankiDone  = true;
  state.words[key].updatedAt = Date.now();

  save();
  updateStats();
  refreshWordCard(key);
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
