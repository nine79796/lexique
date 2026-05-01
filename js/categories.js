'use strict';

// ════════════════════════════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════════════════════════════

function addCategory() {
  const inp   = document.getElementById('catInput');
  const label = inp.value.trim();
  if (!label) return;

  const key = slug(label) || 'cat' + ts();
  if (!state.categories[key]) {
    state.categories[key] = {
      label,
      colorIdx: Object.keys(state.categories).length,
    };
  }
  inp.value = '';
  save();
  renderCatManager();
  renderCatSelect();
  renderFilters();
  updateStats();
}

function deleteCategory(key) {
  delete state.categories[key];
  // Detach the category from any words that used it
  Object.values(state.words).forEach(w => {
    if (w.catKey === key) w.catKey = null;
  });
  if (activeFilter === key) activeFilter = 'all';
  save();
  renderCatManager(); renderCatSelect(); renderFilters(); render();
}

// ── Rendering ─────────────────────────────────────────────────

function renderCatManager() {
  const list = document.getElementById('catChipList');
  const keys = Object.keys(state.categories);

  if (!keys.length) {
    list.innerHTML = `<span style="font-size:12px;color:var(--text-dim)">${t('words.no_cats')}</span>`;
    return;
  }

  list.innerHTML = keys.map(key => {
    const { label } = state.categories[key];
    const col       = getCatColor(key);
    return `<div class="cat-chip" style="background:${col.bg};color:${col.color};border-color:${col.border}">
      ${escHtml(label)}<button class="cat-chip-del" onclick="deleteCategory('${key}')">×</button>
    </div>`;
  }).join('');
}

function renderCatSelect() {
  document.getElementById('catSelect').innerHTML =
    `<option value="">— ${t('stats.categories')} —</option>`
    + Object.entries(state.categories)
        .map(([k, v]) => `<option value="${k}">${escHtml(v.label)}</option>`)
        .join('');
}

// ════════════════════════════════════════════════════════════════
//  SOURCES — Sources d'exposition personnalisées
//  Même logique que les catégories, mais pour l'origine des mots.
// ════════════════════════════════════════════════════════════════

function addCustomSource() {
  const inp   = document.getElementById('sourceInput');
  const emoji = document.getElementById('sourceEmoji');
  const label = inp.value.trim();
  if (!label) return;

  const key = slug(label) || 'src' + ts();
  if (!state.sources[key]) {
    state.sources[key] = {
      label,
      emoji: emoji.value.trim() || '🔖',
    };
  }
  inp.value   = '';
  emoji.value = '';
  save();
  renderSourceManager();
  renderSourceSelect();
}

function deleteCustomSource(key) {
  delete state.sources[key];
  // Détacher la source des mots qui l'utilisaient
  Object.values(state.words).forEach(w => {
    if (w.source === key) w.source = null;
  });
  save();
  renderSourceManager();
  renderSourceSelect();
  render();
}

function renderSourceManager() {
  const list = document.getElementById('sourceChipList');
  if (!list) return;

  const customKeys = Object.keys(state.sources);

  // Sources par défaut (non supprimables)
  const defaultHtml = DEFAULT_SOURCES.map(s => {
    const label = t(s.labelKey) || s.key;
    return `<div class="cat-chip" style="background:rgba(110,180,200,0.10);color:var(--text-muted);border-color:rgba(110,180,200,0.2)">
      ${s.emoji} ${escHtml(label)}
    </div>`;
  }).join('');

  // Sources personnalisées (supprimables)
  const customHtml = customKeys.map(key => {
    const { label, emoji } = state.sources[key];
    return `<div class="cat-chip" style="background:rgba(180,110,200,0.10);color:#b46ec8;border-color:rgba(180,110,200,0.2)">
      ${escHtml(emoji || '🔖')} ${escHtml(label)}
      <button class="cat-chip-del" onclick="deleteCustomSource('${key}')">×</button>
    </div>`;
  }).join('');

  list.innerHTML = defaultHtml + customHtml
    || `<span style="font-size:12px;color:var(--text-dim)">${t('sources.none')}</span>`;
}

function renderSourceSelect() {
  const sel = document.getElementById('sourceSelect');
  if (!sel) return;

  const defaultOpts = DEFAULT_SOURCES.map(s =>
    `<option value="${s.key}">${s.emoji} ${t(s.labelKey) || s.key}</option>`
  ).join('');

  const customOpts = Object.entries(state.sources).map(([k, v]) =>
    `<option value="${k}">${v.emoji || '🔖'} ${escHtml(v.label)}</option>`
  ).join('');

  sel.innerHTML =
    `<option value="">— ${t('sources.select')} —</option>`
    + defaultOpts
    + (customOpts ? `<optgroup label="${t('sources.custom')}">${customOpts}</optgroup>` : '');
}
