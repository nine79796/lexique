'use strict';

// ════════════════════════════════════════════════════════════════
//  CUSTOM SELECT — Popup style modal
// ════════════════════════════════════════════════════════════════

var _cselectState = { cat: '', source: '', timer: '' };
var _cselectType  = null;

function openCselect(type) {
  try {
    _cselectType = type;

    var overlay = document.getElementById('cselectOverlay');
    var list    = document.getElementById('cselectList');
    var titleEl = document.getElementById('cselectTitle');
    if (!overlay || !list || !titleEl) return;

    var items      = [];
    var currentVal = _cselectState[type] || '';

    if (type === 'cat') {
      titleEl.textContent = '— Catégorie —';
      items.push({ value: '', label: '— Catégorie —' });
      if (typeof state !== 'undefined' && state.categories) {
        Object.keys(state.categories).forEach(function(k) {
          items.push({ value: k, label: state.categories[k].label });
        });
      }

    } else if (type === 'source') {
      titleEl.textContent = 'Source';
      items.push({ value: '', label: '— Source —' });
      if (typeof DEFAULT_SOURCES !== 'undefined') {
        DEFAULT_SOURCES.forEach(function(s) {
          var label = (typeof t === 'function' ? t(s.labelKey) : null) || s.key;
          items.push({ value: s.key, label: s.emoji + ' ' + label });
        });
      }
      if (typeof state !== 'undefined' && state.sources) {
        Object.keys(state.sources).forEach(function(k) {
          var v = state.sources[k];
          items.push({ value: k, label: (v.emoji || '🔖') + ' ' + v.label });
        });
      }

    } else if (type === 'timer') {
      titleEl.textContent = 'Chrono';
      var appLabels = (typeof getAppTaskLabels === 'function') ? getAppTaskLabels() : [];
      var curTask   = '';
      if (typeof Timer !== 'undefined') {
        try { curTask = Timer.load().currentTask || ''; } catch(e) {}
      }
      currentVal = curTask;
      _cselectState.timer = curTask;
      items.push({ value: '', label: '— Tâche libre —' });
      appLabels.forEach(function(l) { items.push({ value: l, label: l }); });
      items.push({ value: '__custom__', label: '✏️ Autre tâche...' });
    }

    // Construire la liste
    list.innerHTML = '';
    items.forEach(function(item) {
      var div = document.createElement('div');
      div.className = 'cselect-item' + (item.value === currentVal ? ' selected' : '');

      var spanLabel = document.createElement('span');
      spanLabel.textContent = item.label;

      var spanRadio = document.createElement('span');
      spanRadio.className = 'cselect-item-radio';

      div.appendChild(spanLabel);
      div.appendChild(spanRadio);

      // Closure pour capturer item.value
      (function(val) {
        div.addEventListener('click', function() { pickCselect(val); });
      })(item.value);

      list.appendChild(div);
    });

    // Si timer custom actif
    if (type === 'timer' && currentVal && appLabels && !appLabels.includes(currentVal)) {
      _highlightCustomItem(list);
      _showCustomInput(currentVal, list);
    }

    overlay.classList.add('open');

  } catch(err) {
    console.error('[cselect] openCselect error:', err);
  }
}

function pickCselect(value) {
  try {
    var type = _cselectType;
    var list = document.getElementById('cselectList');

    if (type === 'timer' && value === '__custom__') {
      _highlightCustomItem(list);
      _showCustomInput(_cselectState.timer || '', list);
      return;
    }

    _cselectState[type] = value;

    if (type === 'cat') {
      // Sync le <select> caché
      var sel = document.getElementById('catSelect');
      if (sel) sel.value = value;

      var label = '— Catégorie —';
      if (value && typeof state !== 'undefined' && state.categories && state.categories[value]) {
        label = state.categories[value].label;
      }
      var lbl = document.getElementById('catSelectLabel');
      var btn = document.getElementById('catSelectBtn');
      if (lbl) lbl.textContent = label;
      if (btn) btn.classList.toggle('has-value', !!value);

    } else if (type === 'source') {
      var ssel = document.getElementById('sourceSelect');
      if (ssel) ssel.value = value;

      var slabel = '— Source —';
      if (value && typeof DEFAULT_SOURCES !== 'undefined') {
        var def = DEFAULT_SOURCES.filter(function(s) { return s.key === value; })[0];
        if (def) {
          slabel = def.emoji + ' ' + ((typeof t === 'function' ? t(def.labelKey) : null) || def.key);
        } else if (typeof state !== 'undefined' && state.sources && state.sources[value]) {
          slabel = (state.sources[value].emoji || '🔖') + ' ' + state.sources[value].label;
        }
      }
      var slbl = document.getElementById('sourceSelectLabel');
      var sbtn = document.getElementById('sourceSelectBtn');
      if (slbl) slbl.textContent = slabel;
      if (sbtn) sbtn.classList.toggle('has-value', !!value);

    } else if (type === 'timer') {
      if (typeof Timer !== 'undefined') Timer.setTask(value);
      _updateTimerBtn(value);
      if (typeof renderTimerUI === 'function') renderTimerUI();
    }

    closeCselect();

  } catch(err) {
    console.error('[cselect] pickCselect error:', err);
  }
}

function _highlightCustomItem(list) {
  if (!list) return;
  list.querySelectorAll('.cselect-item').forEach(function(el) {
    var span = el.querySelector('span');
    el.classList.toggle('selected', !!(span && span.textContent.indexOf('✏️') !== -1));
  });
}

function _showCustomInput(currentVal, list) {
  if (!list) list = document.getElementById('cselectList');
  if (document.getElementById('cselectCustomInput')) {
    document.getElementById('cselectCustomInput').focus();
    return;
  }
  var wrap = document.createElement('div');
  wrap.style.cssText = 'padding:6px 4px 8px';

  var inp = document.createElement('input');
  inp.className   = 'cselect-item-custom-input';
  inp.id          = 'cselectCustomInput';
  inp.type        = 'text';
  inp.value       = currentVal || '';
  inp.placeholder = 'Nom de la tâche...';

  inp.addEventListener('input', function() {
    var val = inp.value.trim();
    _cselectState.timer = val;
    if (typeof Timer !== 'undefined') Timer.setTask(val);
    _updateTimerBtn(val);
  });
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') closeCselect();
  });

  wrap.appendChild(inp);
  list.appendChild(wrap);
  inp.focus();
}

function closeCselect() {
  var overlay = document.getElementById('cselectOverlay');
  if (overlay) overlay.classList.remove('open');
  _cselectType = null;
}

function _updateTimerBtn(val) {
  var lbl = document.getElementById('timerTaskSelectLabel');
  var btn = document.getElementById('timerTaskSelectBtn');
  if (lbl) lbl.textContent = val || '— Tâche libre —';
  if (btn) btn.classList.toggle('has-value', !!val);
}

// Alias public pour timer.js
function updateTimerSelectBtn(val) { _updateTimerBtn(val); }

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && _cselectType) closeCselect();
});
