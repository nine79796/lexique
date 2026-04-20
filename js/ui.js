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

const TAB_NAMES = ['mots', 'revision', 'taches', 'stats'];

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', TAB_NAMES[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'stats')    renderCharts();
  if (name === 'revision') renderRevision();
  if (name === 'taches')   { autoReportTasks(); renderTasks(); updateTaskStats(); }
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

// Met à jour une seule carte sans reconstruire toute la liste.
// Fallback sur render() complet si la carte n'est pas trouvée dans le DOM
// (sélecteur qui échoue, clé avec caractères spéciaux, etc.)
function refreshWordCard(key) {
  const safeKey  = CSS.escape(key);
  const existing = document.querySelector(`[data-word-key="${safeKey}"]`);
  if (!existing) {
    // Carte absente du DOM → render complet pour être sûr
    render();
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
  const maxed    = isMaxReached(w);
  const col      = w.catKey ? getCatColor(w.catKey) : null;
  const catLabel = w.catKey && state.categories[w.catKey] ? state.categories[w.catKey].label : null;

  const badge      = catLabel && col
    ? `<span class="cat-badge" style="background:${col.bg};color:${col.color};border:0.5px solid ${col.border}">${escHtml(catLabel)}</span>` : '';
  const ankiBadge  = anki ? `<span class="anki-badge">Anki</span>` : '';
  const ankiBtn    = anki ? `<button class="anki-check-btn" onclick="markAnkiDone('${key}')">${t('words.add_to_anki')}</button>` : '';
  const maxBadge   = maxed && !done ? `<span class="val-badge invalid" style="font-size:9px">${t('words.max_occ')}</span>` : '';
  const dates      = w.occurrences.map(occ => `<span class="date-tag" title="${fmtFull(occ)}">${fmtShort(occ)}</span>`).join('');
  const validBadge = w.validity === 'valid'
    ? `<span class="word-valid-badge valid">✓</span>`
    : w.validity === 'invalid'
    ? `<span class="word-valid-badge invalid">✗</span>` : '';

  // FIX : data-word-key permet à refreshWordCard() de cibler cette carte
  return `<div class="word-card${anki ? ' anki-ready' : ''}${done ? ' anki-done' : ''}${maxed && !done ? ' max-reached' : ''}"
               data-word-key="${key}">
    <div class="word-card-top">
      <button class="word-btn" onclick="clickWord('${key}')" ${maxed ? 'disabled' : ''}>${escHtml(w.label)}</button>
      ${badge}${validBadge}${maxBadge}${ankiBadge}
      <span class="count-badge">${w.occurrences.length}×</span>
      ${ankiBtn}
      <button class="btn btn-danger" onclick="deleteWord('${key}')">×</button>
    </div>
    <div class="word-dates">${dates}</div>
  </div>`;
}

// ── Online / offline status badge ────────────────────────────

function updateOnlineStatus() {
  document.getElementById('offlineBadge').classList.toggle('show', !navigator.onLine);
}
