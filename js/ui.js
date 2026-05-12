'use strict';

// ════════════════════════════════════════════════════════════════
//  UI — Word rendering, stats, filters, tabs, theme
// ════════════════════════════════════════════════════════════════

// ── Theme ─────────────────────────────────────────────────────

function initTheme() {
  applyTheme(localStorage.getItem(LS_KEY_THEME) || 'dark');
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  document.getElementById('themeBtn').textContent = theme === 'light' ? '🌙 Sombre' : '☀️ Clair';
  localStorage.setItem(LS_KEY_THEME, theme);
}

function toggleTheme() {
  applyTheme(document.body.classList.contains('light') ? 'dark' : 'light');
}

// ── Tab navigation ────────────────────────────────────────────

const TAB_NAMES = ['mots', 'revision', 'taches', 'timer', 'spelling', 'stats'];

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', TAB_NAMES[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'stats')    renderCharts();
  if (name === 'revision') renderRevision();
  if (name === 'taches')   { autoReportTasks(); renderTasks(); updateTaskStats(); }
  if (name === 'timer')    { _hideActiveTimerBanner(); renderTimerTaskSelect(); renderTimerHistory(); }
  if (name === 'spelling') renderSpelling();

  // Afficher le bandeau timer si on quitte l'onglet timer et que le chrono tourne
  if (name !== 'timer') {
    _hideActiveTimerBanner();
    setTimeout(_showActiveTimerBanner, 300);
  }
}

function toggleSection(bodyId, iconId) {
  document.getElementById(bodyId).classList.toggle('open');
  document.getElementById(iconId).classList.toggle('open');
}

// ── Word stats ────────────────────────────────────────────────

function updateStats() {
  const words = Object.values(state.words);
  document.getElementById('statWords').textContent = words.length;
  document.getElementById('statOcc').textContent   = words.reduce((a, w) => a + w.occurrences.length, 0);
  document.getElementById('statCats').textContent  = Object.keys(state.categories).length;
  document.getElementById('statAnki').textContent  = words.filter(w => isAnkiReady(w)).length;
}

// ── Word filters ──────────────────────────────────────────────

function renderFilters() {
  const row   = document.getElementById('filterRow');
  const parts = [
    `<button class="filter-btn ${activeFilter === 'all' ? 'active' : ''}" onclick="setFilter('all')">${t('words.all_filter')}</button>`,
  ];

  Object.entries(state.categories).forEach(([key, cat]) => {
    const col = getCatColor(key);
    const isA = activeFilter === key;
    parts.push(
      `<button class="filter-btn ${isA ? 'active' : ''}" onclick="setFilter('${key}')"
        style="${isA ? `background:${col.bg};border-color:${col.color};color:${col.color}` : ''}">
        ${escHtml(cat.label)}
      </button>`
    );
  });

  parts.push(
    `<button class="filter-btn ${activeFilter === 'none' ? 'active' : ''}" onclick="setFilter('none')">${t('words.cat_none')}</button>`,
    `<button class="filter-btn anki-filter ${activeFilter === 'anki' ? 'active' : ''}" onclick="setFilter('anki')">${t('words.anki_ready_filter')}</button>`,
  );

  row.innerHTML = parts.join('');
}

function setFilter(f) {
  activeFilter = f;
  renderFilters();
  render();
}

// ── Word list rendering ───────────────────────────────────────

function render() {
  const list   = document.getElementById('wordList');
  const sort   = document.getElementById('sortSelect').value;
  const search = (document.getElementById('searchInput').value || '').trim().toLowerCase();

  let keys = Object.keys(state.words).filter(key => {
    const w = state.words[key];
    if (search && !w.label.toLowerCase().includes(search)) return false;
    if (activeFilter === 'all')  return true;
    if (activeFilter === 'none') return !w.catKey;
    if (activeFilter === 'anki') return isAnkiReady(w);
    return w.catKey === activeFilter;
  });

  keys.sort((a, b) => {
    const wa = state.words[a], wb = state.words[b];
    if (sort === 'freq')   return wb.occurrences.length - wa.occurrences.length;
    if (sort === 'alpha')  return wa.label.localeCompare(wb.label);
    if (sort === 'recent') return (wb.occurrences.at(-1) || 0) - (wa.occurrences.at(-1) || 0);
    if (sort === 'oldest') return wa.createdAt - wb.createdAt;
    return 0;
  });

  if (!keys.length) {
    const msg = search
      ? `${t('words.no_results')} "${escHtml(search)}"`
      : activeFilter === 'anki' ? t('words.no_anki')
      : t('words.no_words');
    list.innerHTML = `<div class="empty"><span class="empty-icon">✦</span>${msg}</div>`;
    return;
  }

  list.innerHTML = keys.map(key => renderWordCard(key)).join('');
}

// FIX : met à jour une seule carte sans reconstruire toute la liste
function refreshWordCard(key) {
  const existing = document.querySelector(`[data-word-key="${key}"]`);
  if (!existing) {
    // La carte n'est pas visible (filtre actif, etc.) — rien à faire
    return;
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = renderWordCard(key);
  existing.replaceWith(tmp.firstElementChild);
}

function renderWordCard(key) {
  const w        = state.words[key];
  const anki     = isAnkiReady(w);
  const done     = w.ankiDone;
  const col      = w.catKey ? getCatColor(w.catKey) : null;
  const catLabel = w.catKey && state.categories[w.catKey] ? state.categories[w.catKey].label : null;

  // Badge catégorie — cliquable pour modifier
  const badge = catLabel && col
    ? `<button class="cat-badge word-edit-btn" style="background:${col.bg};color:${col.color};border:0.5px solid ${col.border}" onclick="editWordCat('${key}')">${escHtml(catLabel)}</button>`
    : `<button class="cat-badge word-edit-btn" style="background:var(--surface2);color:var(--text-dim);border:0.5px solid var(--border)" onclick="editWordCat('${key}')">+ cat</button>`;
  const ankiBadge = anki ? `<span class="anki-badge">Anki</span>` : '';
  const ankiBtn   = anki ? `<button class="anki-check-btn" onclick="markAnkiDone('${key}')">${t('words.add_to_anki')}</button>` : '';

  // Badge source — cliquable pour modifier
  const srcBadge = w.source
    ? `<button class="source-badge word-edit-btn" onclick="editWordSource('${key}')" title="Changer la source">${renderSourceBadgeInner(w.source)}</button>`
    : `<button class="source-badge word-edit-btn" onclick="editWordSource('${key}')" title="Ajouter une source">+src</button>`;

  const validBadge = w.validity === 'valid'
    ? `<span class="word-valid-badge valid">✓</span>`
    : w.validity === 'invalid'
    ? `<span class="word-valid-badge invalid">✗</span>` : '';

  // Dates en déroulant si > 3 occurrences
  const occCount = w.occurrences.length;
  let datesHtml  = '';
  if (occCount > 0) {
    const allDates = w.occurrences.map(occ => `<span class="date-tag" title="${fmtFull(occ)}">${fmtShort(occ)}</span>`).join('');
    if (occCount <= 3) {
      datesHtml = `<div class="word-dates">${allDates}</div>`;
    } else {
      // Afficher seulement les 2 dernières + bouton déroulant
      const lastTwo = w.occurrences.slice(-2).map(occ => `<span class="date-tag" title="${fmtFull(occ)}">${fmtShort(occ)}</span>`).join('');
      datesHtml = `
        <div class="word-dates">
          ${lastTwo}
          <button class="dates-toggle-btn" onclick="toggleDates('${key}', this)">
            +${occCount - 2} ▼
          </button>
          <div class="word-dates-all" id="dates-all-${key}" style="display:none">${allDates}</div>
        </div>`;
    }
  }

  return `<div class="word-card${anki ? ' anki-ready' : ''}${done ? ' anki-done' : ''}"
               data-word-key="${key}">
    <div class="word-card-top">
      <button class="word-btn" onclick="clickWord('${key}')">${escHtml(w.label)}</button>
      ${badge}${srcBadge}${validBadge}${ankiBadge}
      <span class="count-badge">${occCount}×</span>
      <button class="wl-btn" onclick="WordLookup.open('${escHtml(w.label)}', this)" title="Définition">?</button>
      ${ankiBtn}
      <button class="btn btn-danger" onclick="deleteWord('${key}')">×</button>
    </div>
    ${datesHtml}
  </div>`;
}

// ── Inline edit cat & source ─────────────────────────────────

function editWordCat(key) {
  // Ouvre le cselect catégorie et applique le choix au mot
  _cselectState.cat = state.words[key]?.catKey || '';
  openCselect('cat');
  // Monkey-patch temporaire : quand le cselect ferme, applique au mot
  window._pendingWordCatEdit = key;
}

function editWordSource(key) {
  _cselectState.source = state.words[key]?.source || '';
  openCselect('source');
  window._pendingWordSourceEdit = key;
}

// Override pickCselect pour intercepter les edits inline
const _origPickCselect = pickCselect;
window.pickCselect = function(value) {
  if (window._pendingWordCatEdit && arguments.length > 0) {
    const key = window._pendingWordCatEdit;
    window._pendingWordCatEdit = null;
    if (state.words[key]) {
      state.words[key].catKey    = value || null;
      state.words[key].updatedAt = Date.now();
      save();
      refreshWordCard(key);
    }
    closeCselect();
    return;
  }
  if (window._pendingWordSourceEdit && arguments.length > 0) {
    const key = window._pendingWordSourceEdit;
    window._pendingWordSourceEdit = null;
    if (state.words[key]) {
      state.words[key].source    = value || null;
      state.words[key].updatedAt = Date.now();
      save();
      refreshWordCard(key);
    }
    closeCselect();
    return;
  }
  _origPickCselect(value);
};

/** Retourne le contenu intérieur du badge source (emoji + label) */
function renderSourceBadgeInner(sourceKey) {
  const def = DEFAULT_SOURCES.find(s => s.key === sourceKey);
  if (def) return def.emoji;
  const custom = state.sources[sourceKey];
  if (custom) return custom.emoji || '🔖';
  return '?';
}

/** Affiche le badge de la source d'un mot */
function renderSourceBadge(sourceKey) {
  // Source par défaut
  const def = DEFAULT_SOURCES.find(s => s.key === sourceKey);
  if (def) {
    return `<span class="source-badge" title="${t(def.labelKey) || def.key}">${def.emoji}</span>`;
  }
  // Source personnalisée
  const custom = state.sources[sourceKey];
  if (custom) {
    return `<span class="source-badge" title="${escHtml(custom.label)}">${custom.emoji || '🔖'}</span>`;
  }
  return '';
}

/** Bascule l'affichage de toutes les dates d'un mot */
function toggleDates(key, btn) {
  const allEl = document.getElementById('dates-all-' + key);
  if (!allEl) return;
  const open = allEl.style.display !== 'none';
  allEl.style.display = open ? 'none' : 'block';
  const w = state.words[key];
  if (w) btn.textContent = open ? `+${w.occurrences.length - 2} ▼` : '▲ Masquer';
}

// ── Online / offline status badge ────────────────────────────

function updateOnlineStatus() {
  document.getElementById('offlineBadge').classList.toggle('show', !navigator.onLine);
}
