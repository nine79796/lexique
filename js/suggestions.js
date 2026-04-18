'use strict';

// ════════════════════════════════════════════════════════════════
//  WRITING SUGGESTIONS ENGINE
// ════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────

let suggPrefs  = { minChars: 3, maxItems: 5, style: 'completion' };
let ngramIndex = {};
let suggList   = [];
let suggActive = -1;
let suggTarget = null;
let suggTimer  = null;

// ── Preferences ───────────────────────────────────────────────

function loadSuggPrefs() {
  try {
    const raw = localStorage.getItem(LS_KEY_SUGG);
    if (raw) suggPrefs = { ...suggPrefs, ...JSON.parse(raw) };
  } catch { /* ignore */ }

  document.getElementById('prefFreq').value  = String(suggPrefs.minChars);
  document.getElementById('prefMax').value   = String(suggPrefs.maxItems);
  document.getElementById('prefStyle').value = suggPrefs.style;
}

function saveSuggPrefs() {
  suggPrefs.minChars = parseInt(document.getElementById('prefFreq').value) || 3;
  suggPrefs.maxItems = parseInt(document.getElementById('prefMax').value)  || 5;
  suggPrefs.style    = document.getElementById('prefStyle').value          || 'completion';
  localStorage.setItem(LS_KEY_SUGG, JSON.stringify(suggPrefs));
}

function toggleSuggPrefs() {
  const panel = document.getElementById('suggPrefsPanel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    const rect     = panel.previousElementSibling.getBoundingClientRect();
    const maxRight = window.innerWidth - 8;
    panel.style.right = rect.left + 220 > maxRight ? '0' : '';
  }
}

// Close prefs panel on outside click
document.addEventListener('click', e => {
  const panel = document.getElementById('suggPrefsPanel');
  if (panel?.classList.contains('open') && !panel.closest('[style*="position:relative"]')?.contains(e.target)) {
    panel.classList.remove('open');
  }
});

// ── N-gram index ──────────────────────────────────────────────

/**
 * Rebuilds the n-gram index from the current word list.
 * Call after addWord() or deleteWord(). Not on every keystroke.
 */
function rebuildNgrams() {
  ngramIndex = {};
  Object.values(state.words).forEach(w => {
    const word = w.label.toLowerCase();
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= word.length - n; i++) {
        const gram = word.slice(i, i + n);
        if (!ngramIndex[gram]) ngramIndex[gram] = new Set();
        ngramIndex[gram].add(word);
      }
    }
  });
}

function getTokenContext(text) {
  const tokens  = text.split(/\s+/);
  const current = tokens.at(-1) || '';
  const before  = tokens.slice(0, -1);
  return { tokens, current, before };
}

// ── Suggestion sources ────────────────────────────────────────

function getHistorySuggestions(prefix, max) {
  try {
    const hist = JSON.parse(localStorage.getItem(LS_KEY_HIST) || '{}');
    return Object.entries(hist)
      .filter(([w]) => w.startsWith(prefix.toLowerCase()) && w !== prefix.toLowerCase())
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([w]) => ({ text: w, source: 'hist' }));
  } catch { return []; }
}

function getNgramSuggestions(prefix, max) {
  if (suggPrefs.style === 'word') return [];
  const pLow = prefix.toLowerCase();
  const hits  = new Map();

  for (let n = Math.min(pLow.length, 4); n >= 2; n--) {
    const gram = pLow.slice(0, n);
    (ngramIndex[gram] || new Set()).forEach(word => {
      if (word.startsWith(pLow) && word !== pLow) {
        hits.set(word, (hits.get(word) || 0) + 1);
      }
    });
  }

  return [...hits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([text]) => ({ text, source: 'ngram' }));
}

function mergeSuggestions(hist, ngram, max) {
  const seen = new Set();
  const out  = [];
  for (const s of [...hist, ...ngram]) {
    const key = s.text.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(s); }
    if (out.length >= max) break;
  }
  return out;
}

function computeSuggestions(text) {
  const { current } = getTokenContext(text);
  if (current.length < suggPrefs.minChars) return [];
  return mergeSuggestions(
    getHistorySuggestions(current, suggPrefs.maxItems),
    getNgramSuggestions(current,   suggPrefs.maxItems),
    suggPrefs.maxItems,
  );
}

// ── Suggestions UI ────────────────────────────────────────────

const suggContainer = document.getElementById('sugg-container');

function showSuggestions(items, targetEl) {
  if (!items.length) { hideSuggestions(); return; }

  suggList   = items;
  suggActive = -1;

  const rect = targetEl.getBoundingClientRect();
  let top  = rect.bottom + window.scrollY + 3;
  let left = rect.left   + window.scrollX;

  if (rect.bottom + 220 > window.innerHeight) {
    top = rect.top + window.scrollY - 3;
    suggContainer.style.transform = 'translateY(-100%)';
  } else {
    suggContainer.style.transform = '';
  }

  suggContainer.style.top      = top  + 'px';
  suggContainer.style.left     = left + 'px';
  suggContainer.style.maxWidth = Math.max(rect.width, 180) + 'px';
  suggContainer.innerHTML      = items.map((s, i) => `
    <div class="sugg-item${i === suggActive ? ' active' : ''}"
         role="option"
         onmousedown="acceptSuggestion(${i})"
         onmouseenter="setSuggActive(${i})">
      <span class="sugg-icon">${s.source === 'hist' ? '⏱' : '◦'}</span>
      <span class="sugg-text">${escHtml(s.text)}</span>
      <span class="sugg-source src-${s.source}">${s.source === 'hist' ? 'hist' : 'auto'}</span>
    </div>`).join('');

  suggContainer.classList.add('visible');
}

function hideSuggestions() {
  suggContainer.classList.remove('visible');
  suggList   = [];
  suggActive = -1;
}

function setSuggActive(idx) {
  suggActive = idx;
  suggContainer.querySelectorAll('.sugg-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

function acceptSuggestion(idx) {
  const s = suggList[idx];
  if (!s || !suggTarget) { hideSuggestions(); return; }

  const { current } = getTokenContext(suggTarget.value);
  suggTarget.value  = suggTarget.value.slice(0, suggTarget.value.length - current.length) + s.text + ' ';
  suggTarget.dispatchEvent(new Event('input', { bubbles: true }));
  recordSuggUsage(s.text);
  hideSuggestions();
  suggTarget.focus();
}

function recordSuggUsage(word) {
  try {
    const hist = JSON.parse(localStorage.getItem(LS_KEY_HIST) || '{}');
    const key  = word.toLowerCase();
    hist[key]  = (hist[key] || 0) + 1;
    // Trim to top 200 entries by frequency
    const trimmed = Object.fromEntries(
      Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 200)
    );
    localStorage.setItem(LS_KEY_HIST, JSON.stringify(trimmed));
  } catch { /* ignore quota errors */ }
}

// ── Input attachment ──────────────────────────────────────────

/**
 * Attaches suggestion event listeners to all eligible text inputs.
 * Safe to call multiple times — uses data-sugg-attached to skip already-wired inputs.
 */
function attachSuggestions() {
  const selector = 'input[type="text"], input:not([type]), textarea';
  const excluded = ['#searchInput'];

  document.querySelectorAll(selector).forEach(el => {
    if (excluded.some(s => el.matches(s))) return;
    if (el.dataset.suggAttached) return;
    el.dataset.suggAttached = '1';

    el.addEventListener('focus',  () => { suggTarget = el; });
    el.addEventListener('blur',   () => { setTimeout(hideSuggestions, 150); });
    el.addEventListener('input',  () => {
      clearTimeout(suggTimer);
      suggTarget = el;
      const val  = el.value;
      // N-gram index is only rebuilt on word add/delete, not here
      suggTimer  = setTimeout(() => showSuggestions(computeSuggestions(val), el), 180);
    });
    el.addEventListener('keydown', e => {
      if (!suggList.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggActive(Math.min(suggActive + 1, suggList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggActive(Math.max(suggActive - 1, 0));
      } else if ((e.key === 'Tab' || e.key === 'Enter') && suggActive >= 0) {
        e.preventDefault();
        acceptSuggestion(suggActive);
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    });
  });
}

// Re-attach when the DOM changes (e.g. modal opens)
new MutationObserver(() => attachSuggestions())
  .observe(document.body, { childList: true, subtree: true });
