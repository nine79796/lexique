'use strict';

// ════════════════════════════════════════════════════════════════
//  TIMER — Chrono de travail avec historique par tâche
// ════════════════════════════════════════════════════════════════

const LS_KEY_TIMER   = 'lexique_timer';
const MAX_SESSION_MS = 3 * 60 * 60 * 1000; // 3h auto-stop

// Cache mémoire — évite de parser localStorage à chaque tick (100×/s)
let _timerCache = null;

const Timer = {
  // ── State ────────────────────────────────────────────────────

  /** Charge l'état — depuis le cache mémoire si disponible */
  load() {
    if (_timerCache) return _timerCache;
    try {
      const raw = localStorage.getItem(LS_KEY_TIMER);
      const st  = raw ? JSON.parse(raw) : this.defaultState();
      st.milestones ??= [];
      _timerCache = st;
      return st;
    } catch { return this.defaultState(); }
  },

  defaultState() {
    return {
      running:     false,
      startedAt:   null,  // timestamp ms du dernier start
      elapsed:     0,     // ms accumulées avant la pause en cours
      currentTask: '',    // label de la tâche en cours
      sessions:    [],    // historique { date, task, duration, startedAt }
      milestones:  [],    // drapeaux { date, task, totalMs, lapMs, ts }
    };
  },

  save(st) {
    // Horodater chaque sauvegarde pour que le pull Firebase sache
    // si le cloud est plus récent que le local (comparaison timerPushedAt vs updatedAt)
    st.updatedAt = Date.now();
    _timerCache = st;
    try { localStorage.setItem(LS_KEY_TIMER, JSON.stringify(st)); } catch { /* quota */ }
    // Déclencher une sync cloud légère à chaque changement d'état du timer
    if (typeof CloudSync !== 'undefined') CloudSync.schedule(3000);
  },

  // ── Durée courante ───────────────────────────────────────────

  /** Retourne la durée totale en ms (elapsed + temps depuis startedAt si running) */
  currentMs(st) {
    if (!st.running || !st.startedAt) return st.elapsed;
    return st.elapsed + (Date.now() - st.startedAt);
  },

  // ── Actions ──────────────────────────────────────────────────

  start() {
    const st = this.load();
    if (st.running) return;
    st.running   = true;
    st.startedAt = Date.now();
    this.save(st);
    timerTick();
  },

  pause() {
    const st = this.load();
    if (!st.running) return;
    st.elapsed  = this.currentMs(st);
    st.running  = false;
    st.startedAt = null;
    this.save(st);
    timerTick();
  },

  stop() {
    const st = this.load();
    const duration = this.currentMs(st);
    if (duration > 5000) { // ignorer les sessions < 5 secondes
      this.commitSession(st, duration);
    }
    const fresh = this.defaultState();
    // Conserver l'historique sessions ET milestones
    fresh.sessions   = st.sessions;
    fresh.milestones = st.milestones;
    this.save(fresh);
    timerTick();
    renderTimerHistory();
  },

  /** Enregistre la session courante dans l'historique */
  commitSession(st, duration) {
    const session = {
      date:      fmtDay(Date.now()),
      task:      st.currentTask || '—',
      duration:  Math.round(duration / 1000), // en secondes
      startedAt: st.startedAt || Date.now(),
    };
    st.sessions.unshift(session);
    // Garder max 200 sessions
    if (st.sessions.length > 200) st.sessions = st.sessions.slice(0, 200);
  },

  setTask(label) {
    const st = this.load();

    // Si chrono en cours et tâche différente → commit la session actuelle
    if (st.running && st.currentTask !== label) {
      const duration = this.currentMs(st);
      if (duration > 5000) this.commitSession(st, duration);
      // Redémarre le compteur pour la nouvelle tâche
      st.elapsed   = 0;
      st.startedAt = Date.now();
    }

    st.currentTask = label;
    this.save(st);
    renderTimerHistory();
  },

  /** Vérifie l'auto-stop à 3h */
  checkAutoStop() {
    const st = this.load();
    if (!st.running) return;
    if (this.currentMs(st) >= MAX_SESSION_MS) {
      console.debug('[Timer] Auto-stop à 3h');
      this.stop();
      renderTimerUI();
    }
  },

  /** Supprime une session de l'historique par index */
  deleteSession(idx) {
    const st = this.load();
    st.sessions.splice(idx, 1);
    this.save(st);
    renderTimerHistory();
  },

  /**
   * Pose un drapeau : enregistre un milestone "tâche terminée"
   * avec le temps total et le temps depuis le dernier drapeau (lap),
   * puis remet le compteur de lap à zéro.
   */
  flag() {
    // Invalider le cache avant load() pour éviter le bug PC
    // où _timerCache est périmé après une mise en veille ou un changement d'onglet
    _timerCache = null;
    const st      = this.load();
    // Recalculer totalMs directement depuis Date.now() pour être précis
    const now     = Date.now();
    const totalMs = st.running && st.startedAt
      ? st.elapsed + (now - st.startedAt)
      : st.elapsed;

    // Ignorer si aucun temps écoulé (< 1 seconde)
    if (totalMs < 1000) return;

    // lapMs = temps depuis le dernier drapeau posé AUJOURD'HUI (ou depuis le début)
    // On filtre sur today pour éviter les calculs faux entre deux jours
    const today = fmtDay(now);
    const todayMilestones = st.milestones.filter(m => m.date === today);
    const lastFlagTotalMs = todayMilestones.length > 0 ? todayMilestones[0].totalMs : 0;
    const lapMs = totalMs - lastFlagTotalMs;

    // Ignorer les double-clics (lap < 1 seconde)
    if (lapMs < 1000) return;

    const milestone = {
      date:    fmtDay(now),
      task:    st.currentTask || '—',
      totalMs,
      lapMs,
      ts:      now,
    };

    st.milestones.unshift(milestone);
    if (st.milestones.length > 200) st.milestones = st.milestones.slice(0, 200);

    this.save(st);

    // ── Marquer la tâche courante comme done dans Tasks ──────
    this._markTaskDone(st.currentTask);

    renderTimerHistory();
  },

  /** Cherche la tâche du timer dans state.tasks et la marque done */
  _markTaskDone(taskLabel) {
    if (!taskLabel || taskLabel === '—') return;
    if (typeof state === 'undefined' || !Array.isArray(state.tasks)) return;

    const today = todayStr();
    let changed = false;

    state.tasks.forEach(task => {
      // Correspondance sur le titre (insensible à la casse)
      if (task.title.toLowerCase() !== taskLabel.toLowerCase()) return;

      if (task.recurType === 'once') {
        if (!task.done) {
          task.done      = true;
          task.doneAt    = Date.now();
          task.updatedAt = Date.now();
          changed = true;
        }
      } else {
        if (task.history[today] !== 'done') {
          task.history[today] = 'done';
          task.updatedAt      = Date.now();
          changed = true;
        }
      }
    });

    if (changed) {
      if (typeof save === 'function') save();
      if (typeof renderTasks === 'function') renderTasks();
      if (typeof updateTaskStats === 'function') updateTaskStats();
    }

    // Toujours vider la tâche courante après le drapeau
    // qu'on passe par cselect (mobile) ou le select natif (PC)
    const st2 = Timer.load();
    st2.currentTask = '';
    Timer.save(st2);

    if (typeof _cselectState !== 'undefined') _cselectState.timer = '';
    if (typeof updateTimerSelectBtn === 'function') updateTimerSelectBtn('');
    if (typeof renderTimerTaskSelect === 'function') renderTimerTaskSelect();
    if (typeof renderTimerUI === 'function') renderTimerUI();
  },

  /** Annule le dernier drapeau (missclick) */
  undoFlag() {
    const st = this.load();
    if (!st.milestones.length) return;
    st.milestones.shift();
    this.save(st);
    renderTimerHistory();
  },
};

// ── Tick ─────────────────────────────────────────────────────

let timerInterval = null;

function timerTick() {
  clearInterval(timerInterval);
  const st = Timer.load();
  renderTimerUI();
  if (st.running) {
    timerInterval = setInterval(() => {
      Timer.checkAutoStop();
      renderTimerDisplay();
    }, 10); // 10ms pour les millisecondes
  }
}

// ── Formatage ────────────────────────────────────────────────

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2,'0')}s`;
  return `${s}s`;
}

function fmtChrono(ms) {
  const cs    = Math.floor(ms / 10) % 100; // centisecondes (2 chiffres)
  const total = Math.floor(ms / 1000);
  const h  = Math.floor(total / 3600);
  const m  = Math.floor((total % 3600) / 60);
  const s  = total % 60;
  const mm = String(m).padStart(2,'0');
  const ss = String(s).padStart(2,'0');
  const cc = String(cs).padStart(2,'0');
  return h > 0
    ? `${h}:${mm}:${ss}<span class="timer-ms">.${cc}</span>`
    : `${mm}:${ss}<span class="timer-ms">.${cc}</span>`;
}

/** Format compact pour les laps de milestone : 1h23:45 ou 12:34 ou 5s */
function fmtChronoMs(ms) {
  if (!ms || ms < 0) return '0s';
  const total = Math.floor(ms / 1000);
  const h  = Math.floor(total / 3600);
  const m  = Math.floor((total % 3600) / 60);
  const s  = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2,'0')}s`;
  return `${s}s`;
}



function renderTimerDisplay() {
  const st = Timer.load();
  const ms = Timer.currentMs(st);
  const el = document.getElementById('timerDisplay');
  if (el) el.innerHTML = fmtChrono(ms);
}

function renderTimerUI() {
  const st       = Timer.load();
  const ms       = Timer.currentMs(st);
  const display  = document.getElementById('timerDisplay');
  const btnStart = document.getElementById('timerBtnStart');
  const btnStop  = document.getElementById('timerBtnStop');
  const btnFlag  = document.getElementById('timerBtnFlag');
  const btnUndo  = document.getElementById('timerBtnUndo');
  const taskSel  = document.getElementById('timerTaskSelect');
  const taskInp  = document.getElementById('timerTaskInput');

  if (!display) return;

  display.innerHTML = fmtChrono(ms);
  display.className = 'timer-display' + (st.running ? ' running' : ms > 0 ? ' paused' : '');

  if (btnStart) {
    btnStart.textContent = st.running ? t('timer.pause') : ms > 0 ? t('timer.resume') : t('timer.start');
    btnStart.className   = 'timer-btn' + (st.running ? ' btn-pause' : ' btn-start');
  }
  if (btnStop) {
    btnStop.style.display = ms > 0 ? 'inline-flex' : 'none';
  }
  if (btnFlag) {
    btnFlag.style.display = (st.running || ms > 0) ? 'inline-flex' : 'none';
  }
  if (btnUndo) {
    btnUndo.style.display = st.milestones.length > 0 ? 'inline-flex' : 'none';
  }

  // Sync le bouton custom avec la tâche courante
  if (typeof updateTimerSelectBtn === 'function') {
    updateTimerSelectBtn(st.currentTask || '');
  }

  // Sync le select et l'input avec la tâche courante (fallback)
  if (taskSel && taskInp) {
    const isCustom = st.currentTask && !getAppTaskLabels().includes(st.currentTask);
    if (isCustom) {
      taskSel.value  = '__custom__';
      taskInp.value  = st.currentTask;
      taskInp.style.display = 'block';
    } else {
      taskSel.value  = st.currentTask || '';
      taskInp.style.display = 'none';
    }
  }
}

function renderTimerTaskSelect() {
  const sel = document.getElementById('timerTaskSelect');
  if (!sel) return;
  const labels = getAppTaskLabels();
  sel.innerHTML =
    `<option value="">${t('timer.no_task')}</option>`
    + labels.map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('')
    + `<option value="__custom__">✏️ ${t('timer.custom_task')}</option>`;
}

function getAppTaskLabels() {
  const today = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0, 10);
  return (state.tasks || [])
    .filter(t => {
      if (t.done) return false;
      // Exclure les récurrentes déjà cochées aujourd'hui (après drapeau)
      if (t.recurType !== 'once' && t.history && t.history[today] === 'done') return false;
      return true;
    })
    .map(t => t.title)
    .slice(0, 30);
}

function renderTimerHistory() {
  const container = document.getElementById('timerHistory');
  if (!container) return;

  const st = Timer.load();
  const hasSessions   = st.sessions.length > 0;
  const hasMilestones = st.milestones.length > 0;

  if (!hasSessions && !hasMilestones) {
    container.innerHTML = `<div class="empty"><span class="empty-icon">◷</span>${t('timer.no_sessions')}</div>`;
    return;
  }

  // Fusionner sessions et milestones par date
  const byDate = {};

  st.sessions.forEach((s, idx) => {
    if (!byDate[s.date]) byDate[s.date] = { sessions: [], milestones: [] };
    byDate[s.date].sessions.push({ ...s, idx });
  });

  st.milestones.forEach((m, idx) => {
    if (!byDate[m.date]) byDate[m.date] = { sessions: [], milestones: [] };
    byDate[m.date].milestones.push({ ...m, idx });
  });

  // Tri explicite : YYYY-MM-DD est comparable lexicographiquement, desc = plus récent en premier
  const sortedDates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

  const locale = DateUtils.getLocale();
  let html = '';

  // Le drapeau le plus récent = st.milestones[0] (unshift)
  const newestMilestoneTs = st.milestones.length > 0 ? st.milestones[0].ts : null;

  sortedDates.forEach(date => {
    const { sessions, milestones } = byDate[date];
    // Total = uniquement les sessions terminées (Terminer cliqué)
    // Les milestones (drapeaux) sont des marqueurs de temps dans la session, pas des durées additionnelles
    const total = sessions.reduce((a, s) => a + s.duration, 0);
    const dateDisp = new Date(date + 'T12:00:00').toLocaleDateString(locale, {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    html += `<div class="timer-day-group">
      <div class="timer-day-header">
        <span class="timer-day-label">${dateDisp}</span>
        ${total > 0 ? `<span class="timer-day-total">${fmtDuration(total)}</span>` : ''}
      </div>`;

    // Milestones (drapeaux)
    milestones.forEach(m => {
      const timeStr  = new Date(m.ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      const lapStr   = fmtChronoMs(m.lapMs);
      const isNewest = m.ts === newestMilestoneTs;
      html += `<div class="timer-milestone-row">
        <span class="timer-milestone-flag">🚩</span>
        <span class="timer-milestone-task">${escHtml(m.task)}</span>
        <span class="timer-milestone-time">${timeStr}</span>
        <span class="timer-milestone-lap">${lapStr}</span>
        ${isNewest ? `<button class="timer-session-del" onclick="Timer.undoFlag()" title="${t('timer.undo_flag')}">↩</button>` : '<span style="width:24px"></span>'}
      </div>`;
    });

    // Sessions masquées — les drapeaux suffisent pour le détail

    html += `</div>`;
  });

  container.innerHTML = html;
}

// ── Stats : données pour charts.js ───────────────────────────

/**
 * Retourne le temps travaillé (en secondes) par jour sur N jours.
 * Utilisé par renderWorkChart() dans charts.js.
 */
function getWorkDataByDay(days = 30) {
  const st     = Timer.load();
  const result = {};
  const now    = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result[fmtDay(d.getTime())] = 0;
  }

  // Sessions terminées uniquement — pas les milestones (double comptage)
  st.sessions.forEach(s => {
    if (result[s.date] !== undefined) result[s.date] += s.duration;
  });

  return result;
}

// ── Event handlers (appelés depuis HTML) ─────────────────────

function timerToggle() {
  const st = Timer.load();
  if (st.running) Timer.pause();
  else            Timer.start();
}

function timerFlag() {
  Timer.flag();
  renderTimerUI();
}

function timerUndoFlag() {
  Timer.undoFlag();
  renderTimerUI();
}

function timerStop() {
  Timer.stop();
  renderTimerHistory();
}

function onTimerTaskChange() {
  const sel = document.getElementById('timerTaskSelect');
  const inp = document.getElementById('timerTaskInput');
  if (sel.value === '__custom__') {
    inp.style.display = 'block';
    inp.focus();
  } else {
    inp.style.display = 'none';
    Timer.setTask(sel.value);
    renderTimerUI();
  }
}

function onTimerTaskInput() {
  const inp = document.getElementById('timerTaskInput');
  Timer.setTask(inp.value.trim());
}

// ── Init ─────────────────────────────────────────────────────

function initTimer() {
  renderTimerTaskSelect();
  timerTick();         // gère déjà la reprise du tick si running
  renderTimerHistory();
  // Afficher le bandeau après un court délai pour laisser le DOM se stabiliser
  // Fonctionne sur mobile ET desktop, peu importe l'onglet actif au démarrage
  setTimeout(_showActiveTimerBanner, 800);
}

/**
 * Affiche un bandeau en haut de l'app si un timer est en cours
 * quand on rouvre l'app — permet de retrouver facilement le chrono actif.
 */
function _showActiveTimerBanner() {
  const st = Timer.load();
  // Rien à afficher si aucun temps écoulé
  if (!st.running && (!st.elapsed || st.elapsed === 0)) return;

  const existing = document.getElementById('activeTimerBanner');
  if (existing) return; // déjà affiché

  const ms      = Timer.currentMs(st);
  const banner  = document.createElement('div');
  banner.id     = 'activeTimerBanner';
  banner.className = 'active-timer-banner';

  const taskLabel = st.currentTask ? `· ${st.currentTask}` : '';
  const stateLabel = st.running ? '▶ En cours' : '⏸ En pause';

  banner.innerHTML = `
    <span class="active-timer-text">${stateLabel}${taskLabel}</span>
    <button class="active-timer-resume" onclick="switchTab('timer');_hideActiveTimerBanner()">
      Reprendre →
    </button>
    <button class="active-timer-close" onclick="_hideActiveTimerBanner()">×</button>`;

  document.body.appendChild(banner);

  // Met à jour le temps affiché dans le bandeau toutes les secondes
  const bannerInterval = setInterval(() => {
    const s2 = Timer.load();
    if (!s2.running && s2.elapsed === 0) { _hideActiveTimerBanner(); clearInterval(bannerInterval); return; }
    const textEl = banner.querySelector('.active-timer-text');
    const curMs  = Timer.currentMs(s2);
    const stL    = s2.running ? '▶ En cours' : '⏸ En pause';
    const tL     = s2.currentTask ? `· ${s2.currentTask}` : '';
    const h = Math.floor(curMs / 3600000);
    const m = Math.floor((curMs % 3600000) / 60000);
    const sec = Math.floor((curMs % 60000) / 1000);
    const timeStr = h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    if (textEl) textEl.textContent = `${stL} ${tL} — ${timeStr}`;
  }, 1000);

  banner._interval = bannerInterval;
}

function _hideActiveTimerBanner() {
  const banner = document.getElementById('activeTimerBanner');
  if (!banner) return;
  if (banner._interval) clearInterval(banner._interval);
  banner.remove();
}
