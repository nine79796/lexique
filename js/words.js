'use strict';

// ════════════════════════════════════════════════════════════════
//  WORDS — CRUD & Wordnik validation
// ════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────

const isAnkiReady  = w => Array.isArray(w.occurrences) && w.occurrences.length >= ANKI_THRESHOLD && !w.ankiDone;
// Un mot ankiDone ne peut plus être bloqué par MAX_CLICKS — il peut continuer à être rencontré
const isMaxReached = w => Array.isArray(w.occurrences) && w.occurrences.length >= MAX_CLICKS && !w.ankiDone;

// ── Category colour ───────────────────────────────────────────

function getCatColor(key) {
  const cat = state.categories[key];
  return cat ? PALETTE[cat.colorIdx % PALETTE.length] : null;
}

// ── CRUD ──────────────────────────────────────────────────────

/**
 * Logique centrale d'enregistrement d'une occurrence.
 * Utilisée par addWord() et clickWord() pour éviter la duplication.
 * Retourne false si le clic est bloqué (max atteint), true sinon.
 */
function recordOccurrence(key) {
  const w = state.words[key];
  if (!w) return false;

  if (isMaxReached(w)) {
    notify('max', w.label);
    return false;
  }

  // Utilise un timestamp normalisé à midi pour éviter les dérives
  // entre fuseaux horaires lors de l'affichage par jour
  const now = Date.now();
  w.occurrences.push(now);
  w.updatedAt = now;

  const count = w.occurrences.length;
  if (count === ANKI_THRESHOLD) notify('anki', w.label);

  return true;
}

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
      occurrences: [],
      ankiDone:    false,
      validity:    'unknown',
    };
    console.debug('[addWord] Nouveau mot créé :', key);
  } else {
    if (catKey) state.words[key].catKey = catKey;
  }

  const ok = recordOccurrence(key);
  if (!ok) { inp.value = ''; return; }

  console.debug('[addWord] Occurrence ajoutée :', key, '→', state.words[key].occurrences.length, 'fois');

  inp.value = '';
  document.getElementById('validationStrip').innerHTML = '';
  save();
  updateStats();
  render();
  rebuildNgrams();

  if (navigator.onLine) await validateWord(label);
}

function clickWord(key) {
  const w = state.words[key];
  if (!w) return;

  const ok = recordOccurrence(key);
  if (!ok) return;

  const count = w.occurrences.length;

  save();
  updateStats();

  // Push immédiat vers Firestore pour éviter qu'un pull ultérieur
  // écrase le clic avec une version moins récente
  if (navigator.onLine) CloudSync.schedule(300);

  // Affiche le bouton undo après chaque clic
  showUndoBtn(key);

  // Forcer render() complet dès que la carte change d'apparence
  // (badge Anki, bouton désactivé, etc.)
  // Sur mobile, on utilise requestAnimationFrame pour laisser le touch
  // se terminer proprement avant de reconstruire le DOM.
  if (count >= ANKI_THRESHOLD || count >= MAX_CLICKS) {
    requestAnimationFrame(() => render());
  } else {
    requestAnimationFrame(() => refreshWordCard(key));
  }
}

/**
 * Annule le dernier clic enregistré sur un mot.
 * Supprime la dernière occurrence et met à jour l'UI.
 */
function undoLastClick(key) {
  const w = state.words[key];
  if (!w || !w.occurrences.length) return;

  w.occurrences.pop();
  w.updatedAt = ts();

  save();
  updateStats();
  hideUndoBtn();

  if (navigator.onLine) CloudSync.schedule(300);

  // Forcer render() complet si on repasse sous le seuil Anki
  if (w.occurrences.length < ANKI_THRESHOLD) {
    render();
  } else {
    refreshWordCard(key);
  }
}

// ── Undo UI ───────────────────────────────────────────────────

let undoTimer = null;

function showUndoBtn(key) {
  clearTimeout(undoTimer);

  let btn = document.getElementById('undoClickBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id        = 'undoClickBtn';
    btn.className = 'undo-click-btn';
    document.body.appendChild(btn);
  }

  const w = state.words[key];
  btn.textContent = `↩ ${t('words.undo_click')} "${escHtml(w?.label ?? '')}"`;
  btn.onclick     = () => undoLastClick(key);
  btn.classList.add('visible');

  // Disparaît automatiquement après 5 secondes
  undoTimer = setTimeout(hideUndoBtn, 5000);
}

function hideUndoBtn() {
  const btn = document.getElementById('undoClickBtn');
  if (btn) btn.classList.remove('visible');
  clearTimeout(undoTimer);
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
      `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word.toLowerCase())}/definitions?limit=3&useCanonical=false&api_key=${WORDNIK_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.status === 404) return false;
    if (!res.ok)            return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return false;

    // Vérifier que le mot retourné correspond exactement au mot saisi
    // (Wordnik peut retourner des définitions pour des variantes proches)
    const wordLow = word.toLowerCase();
    const hasExactMatch = data.some(d => {
      const w = (d.word || '').toLowerCase();
      return w === wordLow;
    });
    return hasExactMatch;
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
