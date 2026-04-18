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
