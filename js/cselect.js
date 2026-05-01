'use strict';

// ════════════════════════════════════════════════════════════════
//  CUSTOM SELECT — Popup style modal pour catégorie, source, timer
// ════════════════════════════════════════════════════════════════

let _cselectType = null; // 'cat' | 'source' | 'timer'

function openCselect(type) {
  _cselectType = type;
  const overlay = document.getElementById('cselectOverlay');
  const list    = document.getElementById('cselectList');
  const title   = document.getElementById('cselectTitle');

  let items = [];
  let currentVal = '';

  if (type === 'cat') {
    title.textContent = t('stats.categories') || 'Catégorie';
    currentVal = document.getElementById('catSelect').value;
    items = [
      { value: '', label: `— ${t('stats.categories')} —` },
      ...Object.entries(state.categories).map(([k, v]) => ({ value: k, label: v.label })),
    ];
  } else if (type === 'source') {
    title.textContent = t('sources.select') || 'Source';
    currentVal = document.getElementById('sourceSelect').value;
    const defaultItems = DEFAULT_SOURCES.map(s => ({
      value: s.key,
      label: `${s.emoji} ${t(s.labelKey) || s.key}`,
    }));
    const customItems = Object.entries(state.sources).map(([k, v]) => ({
      value: k,
      label: `${v.emoji || '🔖'} ${v.label}`,
    }));
    items = [
      { value: '', label: `— ${t('sources.select') || 'Source'} —` },
      ...defaultItems,
      ...customItems,
    ];
  } else if (type === 'timer') {
    title.textContent = t('tabs.timer') || 'Chrono';
    const st = Timer.load();
    currentVal = st.currentTask || '';
    const appLabels = getAppTaskLabels();
    items = [
      { value: '', label: t('timer.no_task') || '— Tâche libre —' },
      ...appLabels.map(l => ({ value: l, label: l })),
      { value: '__custom__', label: `✏️ ${t('timer.custom_task') || 'Autre tâche...'}` },
    ];
  }

  list.innerHTML = items.map(item => `
    <div class="cselect-item${item.value === currentVal ? ' selected' : ''}"
         onclick="pickCselect(${JSON.stringify(item.value)})">
      <span>${escHtml(item.label)}</span>
      <span class="cselect-item-radio"></span>
    </div>
  `).join('');

  // Si timer + custom : ajouter l'input texte inline
  if (type === 'timer' && currentVal && !getAppTaskLabels().includes(currentVal) && currentVal !== '') {
    list.innerHTML += `
      <div style="padding:4px 0 8px">
        <input class="cselect-item-custom-input" id="cselectCustomInput"
               type="text" value="${escHtml(currentVal)}"
               placeholder="${t('timer.custom_task') || 'Nom de la tâche...'}"
               oninput="onCselectCustomInput()" />
      </div>`;
  }

  overlay.classList.add('open');
}

function pickCselect(value) {
  const type = _cselectType;

  if (type === 'timer' && value === '__custom__') {
    // Afficher l'input custom inline
    const list = document.getElementById('cselectList');
    // Highlight l'item sélectionné
    list.querySelectorAll('.cselect-item').forEach(el => {
      el.classList.toggle('selected', el.querySelector('span')?.textContent.includes('✏️'));
    });
    // Ajouter ou focus l'input
    let inp = document.getElementById('cselectCustomInput');
    if (!inp) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:4px 0 8px';
      div.innerHTML = `<input class="cselect-item-custom-input" id="cselectCustomInput"
               type="text" placeholder="${t('timer.custom_task') || 'Nom de la tâche...'}"
               oninput="onCselectCustomInput()" />`;
      list.appendChild(div);
      inp = document.getElementById('cselectCustomInput');
    }
    inp.focus();
    return;
  }

  // Appliquer la valeur
  if (type === 'cat') {
    const sel = document.getElementById('catSelect');
    sel.value = value;
    const label = value
      ? (state.categories[value]?.label || value)
      : `— ${t('stats.categories')} —`;
    const btn = document.getElementById('catSelectBtn');
    document.getElementById('catSelectLabel').textContent = label;
    btn.classList.toggle('has-value', !!value);
  } else if (type === 'source') {
    const sel = document.getElementById('sourceSelect');
    sel.value = value;
    let label = `— ${t('sources.select') || 'Source'} —`;
    if (value) {
      const def = DEFAULT_SOURCES.find(s => s.key === value);
      if (def) label = `${def.emoji} ${t(def.labelKey) || def.key}`;
      else if (state.sources[value]) label = `${state.sources[value].emoji || '🔖'} ${state.sources[value].label}`;
    }
    document.getElementById('sourceSelectLabel').textContent = label;
    document.getElementById('sourceSelectBtn').classList.toggle('has-value', !!value);
  } else if (type === 'timer') {
    Timer.setTask(value);
    updateTimerSelectBtn(value);
    renderTimerUI();
  }

  closeCselect();
}

function onCselectCustomInput() {
  const inp = document.getElementById('cselectCustomInput');
  const val = inp.value.trim();
  Timer.setTask(val);
  updateTimerSelectBtn(val);
}

function updateTimerSelectBtn(val) {
  const noTaskLabel = t('timer.no_task') || '— Tâche libre —';
  document.getElementById('timerTaskSelectLabel').textContent = val || noTaskLabel;
  document.getElementById('timerTaskSelectBtn').classList.toggle('has-value', !!val);
}

function closeCselect() {
  document.getElementById('cselectOverlay').classList.remove('open');

  // Si custom timer, valider l'input avant de fermer
  if (_cselectType === 'timer') {
    const inp = document.getElementById('cselectCustomInput');
    if (inp) {
      const val = inp.value.trim();
      if (val) { Timer.setTask(val); updateTimerSelectBtn(val); }
    }
  }

  _cselectType = null;
}

// Fermer sur Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _cselectType) closeCselect();
});
