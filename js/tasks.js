'use strict';

// ════════════════════════════════════════════════════════════════
//  TASKS — CRUD, modal & rendering
// ════════════════════════════════════════════════════════════════

// ── CRUD ──────────────────────────────────────────────────────

function toggleTaskDone(id, dateStr) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const d = dateStr || todayStr();

  if (task.recurType === 'once') {
    task.done   = !task.done;
    task.doneAt = task.done ? ts() : null;
  } else {
    const current   = task.history[d] || null;
    task.history[d] = current === 'done' ? null : 'done';
    if (task.history[d] === null) delete task.history[d];
  }
  task.updatedAt = ts();
  save(); renderTasks(); updateTaskStats();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  renderTasks();
  updateTaskStats();

  // Supprime aussi dans Firestore pour éviter la résurrection au pull
  try {
    const tRef = CloudSync.tasksRef();
    if (tRef) {
      tRef.doc(String(id)).delete().catch(err =>
        console.error('[deleteTask] Firestore delete error:', err)
      );
    }
  } catch (err) {
    console.error('[deleteTask] Firestore error:', err);
  }
}

/**
 * Auto-advance past-due once-tasks to today and mark recurring tasks as missed.
 * Runs once on app boot and each time the Tasks or Revision tab is opened.
 */
function autoReportTasks() {
  const today   = todayStr();
  let   changed = false;

  state.tasks.forEach(task => {
    if (task.recurType === 'once') {
      if (!task.done && task.dueDate && task.dueDate < today) {
        task.reportHistory = task.reportHistory || [];
        task.reportHistory.push(task.dueDate);
        task.reportCount   = (task.reportCount || 0) + 1;
        task.dueDate       = today;
        task.updatedAt     = ts();
        changed = true;
      }
    } else {
      getPastDueDates(task, addDays(today, -1)).forEach(d => {
        if (!task.history[d]) {
          task.history[d]  = 'missed';
          task.reportCount = (task.reportCount || 0) + 1;
          task.updatedAt   = ts();
          changed = true;
        }
      });
    }
  });

  if (changed) save();
}

// ── Task modal ────────────────────────────────────────────────

function openTaskModal(editId, defaultType) {
  modalEditId = editId;
  const today = todayStr();

  document.getElementById('modalTitle').textContent   = editId ? t('modal.edit_task')  : t('modal.new_task');
  document.getElementById('modalSaveBtn').textContent = editId ? t('modal.save_task')   : t('modal.create_task');

  if (editId) {
    const task = state.tasks.find(x => x.id === editId);
    if (!task) return;
    document.getElementById('mTaskTitle').value       = task.title        || '';
    document.getElementById('mTaskDesc').value        = task.desc         || '';
    document.getElementById('mTaskCat').value         = task.cat          || '';
    document.getElementById('mTaskDate').value        = task.dueDate      || today;
    document.getElementById('mDailyStart').value      = task.recurStart   || today;
    document.getElementById('mDailyEnd').value        = task.recurEnd     || '';
    document.getElementById('mWeeklyStart').value     = task.recurStart   || today;
    document.getElementById('mWeeklyEnd').value       = task.recurEnd     || '';
    document.getElementById('mIntervalStart').value   = task.recurStart   || today;
    document.getElementById('mIntervalEnd').value     = task.recurEnd     || '';
    document.getElementById('mInterval').value        = task.recurInterval || 2;
    document.getElementById('mDeadline').value        = task.deadline     || '';
    selectedDays = new Set(task.recurDays || []);
    setRecurType(task.recurType || 'once');
  } else {
    document.getElementById('mTaskTitle').value     = '';
    document.getElementById('mTaskDesc').value      = '';
    document.getElementById('mTaskCat').value       = '';
    document.getElementById('mTaskDate').value      = today;
    document.getElementById('mDailyStart').value    = today;
    document.getElementById('mDailyEnd').value      = '';
    document.getElementById('mWeeklyStart').value   = today;
    document.getElementById('mWeeklyEnd').value     = '';
    document.getElementById('mIntervalStart').value = today;
    document.getElementById('mIntervalEnd').value   = '';
    document.getElementById('mInterval').value      = 2;
    document.getElementById('mDeadline').value      = '';
    selectedDays = new Set();
    setRecurType(defaultType || 'once');
  }

  renderDayPicker();
  document.getElementById('taskModal').classList.add('open');
  document.getElementById('mTaskTitle').focus();
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
  modalEditId = null;
  hideSuggestions();
}

function setRecurType(type) {
  modalRecurType = type;
  ['once', 'daily', 'weekly', 'interval'].forEach(rt => {
    document.getElementById('rtype-' + rt).classList.toggle('active', rt === type);
    document.getElementById('panel-' + rt).classList.toggle('active', rt === type);
  });
  document.getElementById('deadlineSection').style.display = type !== 'once' ? 'block' : 'none';
}

function toggleDay(d) {
  if (selectedDays.has(d)) selectedDays.delete(d);
  else selectedDays.add(d);
  renderDayPicker();
}

function renderDayPicker() {
  document.querySelectorAll('.day-pill').forEach(el => {
    el.classList.toggle('selected', selectedDays.has(parseInt(el.dataset.day)));
  });
}

function saveTaskFromModal() {
  const title = document.getElementById('mTaskTitle').value.trim();
  if (!title) { document.getElementById('mTaskTitle').focus(); return; }

  // Guard: weekly tasks require at least one day selected
  if (modalRecurType === 'weekly' && selectedDays.size === 0) {
    const picker = document.querySelector('.day-picker');
    if (picker) {
      picker.classList.add('day-picker--error');
      let errMsg = picker.nextElementSibling;
      if (!errMsg || !errMsg.classList.contains('day-picker-error-msg')) {
        errMsg = document.createElement('div');
        errMsg.className = 'day-picker-error-msg';
        errMsg.style.cssText = 'color:var(--danger,#e05);font-size:12px;margin-top:4px';
        picker.insertAdjacentElement('afterend', errMsg);
      }
      errMsg.textContent = t('modal.weekly_no_days');
      setTimeout(() => {
        picker.classList.remove('day-picker--error');
        errMsg.textContent = '';
      }, 2000);
    }
    return;
  }

  const today = todayStr();
  let task;

  if (modalEditId) {
    task = state.tasks.find(x => x.id === modalEditId);
    if (!task) return;
  } else {
    task = {
      id:            'task_' + ts(),
      done:          false,
      doneAt:        null,
      reportCount:   0,
      reportHistory: [],
      history:       {},
      createdAt:     ts(),
    };
    state.tasks.push(task);
  }

  task.title      = title;
  task.desc       = document.getElementById('mTaskDesc').value.trim();
  task.cat        = document.getElementById('mTaskCat').value;
  task.deadline   = document.getElementById('mDeadline').value || null;
  task.recurType  = modalRecurType;
  task.updatedAt  = ts();

  switch (modalRecurType) {
    case 'once':
      task.dueDate       = document.getElementById('mTaskDate').value || today;
      task.recurDays     = [];
      task.recurStart    = task.dueDate;
      task.recurEnd      = null;
      task.recurInterval = null;
      break;
    case 'daily':
      task.recurStart    = document.getElementById('mDailyStart').value  || today;
      task.recurEnd      = document.getElementById('mDailyEnd').value    || null;
      task.dueDate       = task.recurStart;
      task.recurDays     = [0, 1, 2, 3, 4, 5, 6];
      task.recurInterval = null;
      break;
    case 'weekly':
      task.recurDays     = [...selectedDays];
      task.recurStart    = document.getElementById('mWeeklyStart').value || today;
      task.recurEnd      = document.getElementById('mWeeklyEnd').value   || null;
      task.dueDate       = task.recurStart;
      task.recurInterval = null;
      break;
    case 'interval':
      task.recurInterval = parseInt(document.getElementById('mInterval').value) || 2;
      task.recurStart    = document.getElementById('mIntervalStart').value || today;
      task.recurEnd      = document.getElementById('mIntervalEnd').value   || null;
      task.dueDate       = task.recurStart;
      task.recurDays     = [];
      break;
  }

  save();
  closeTaskModal();
  autoReportTasks();
  renderTasks();
  updateTaskStats();
}

// ── Task stats ────────────────────────────────────────────────

function updateTaskStats() {
  const today = todayStr();

  const doneTodayCount = state.tasks.filter(task => {
    if (task.recurType === 'once') return task.done && task.doneAt && fmtDay(task.doneAt) === today;
    return task.history[today] === 'done';
  }).length;

  // FIX: the previous logic counted recurring tasks that were active-today-but-not-yet-done
  // as "late", which was wrong — those are simply pending for the current day.
  // "Late" for a once task = past due date and not done.
  // "Late" for a recurring task = has missed entries in history (i.e. past days marked missed).
  const lateCount = state.tasks.filter(task => {
    if (task.recurType === 'once') {
      return !task.done && task.dueDate < today;
    }
    return Object.entries(task.history || {}).some(([d, v]) => d < today && v === 'missed');
  }).length;

  const recurActive = state.tasks.filter(task =>
    task.recurType !== 'once'
    && (!task.recurEnd  || task.recurEnd  >= today)
    && (!task.deadline  || task.deadline  >= today)
  ).length;

  const allDue  = state.tasks.reduce((a, task) => a + getPastDueDates(task).length, 0);
  const allDone = state.tasks.reduce((a, task) => {
    if (task.recurType === 'once') return a + (task.done ? 1 : 0);
    return a + Object.values(task.history).filter(v => v === 'done').length;
  }, 0);
  const pct = allDue > 0 ? Math.round(allDone / allDue * 100) : 0;

  document.getElementById('taskStatDone').textContent  = doneTodayCount;
  document.getElementById('taskStatLate').textContent  = lateCount;
  document.getElementById('taskStatRecur').textContent = recurActive;
  document.getElementById('taskStatPct').textContent   = pct + '%';
}

// ── Task rendering ────────────────────────────────────────────

function renderTaskFilters() {
  const opts = [
    { f: 'all',   l: t('tasks.filter_all')  },
    { f: 'today', l: t('tasks.filter_today') },
    { f: 'recur', l: t('tasks.filter_recur') },
    { f: 'late',  l: t('tasks.filter_late')  },
    { f: 'done',  l: t('tasks.filter_done')  },
    { f: 'perso', l: t('cats.perso') },
    { f: 'pro',   l: t('cats.pro')   },
    { f: 'etude', l: t('cats.etude') },
    { f: 'sport', l: t('cats.sport') },
  ];
  document.getElementById('taskFilterRow').innerHTML = opts.map(({ f, l }) =>
    `<button class="filter-btn ${activeTaskFilter === f ? 'active' : ''} ${f === 'recur' ? 'recur-filter' : ''}"
      onclick="setTaskFilter('${f}')">${escHtml(l)}</button>`
  ).join('');
}

function setTaskFilter(f) {
  activeTaskFilter = f;
  renderTaskFilters();
  renderTasks();
}

function renderTasks() {
  renderTaskFilters();
  const today = todayStr();
  const list  = document.getElementById('taskList');

  let items = buildTaskItems(today).filter(item => {
    const { task } = item;
    if (activeTaskFilter === 'all')   return true;
    if (activeTaskFilter === 'today') return item.date === today && !item.done;
    if (activeTaskFilter === 'recur') return task.recurType !== 'once';
    if (activeTaskFilter === 'late')  return item.isLate;
    if (activeTaskFilter === 'done')  return item.done;
    return task.cat === activeTaskFilter;
  });

  items.sort((a, b) => {
    if (a.done !== b.done)     return a.done ? 1 : -1;
    if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
    return a.date.localeCompare(b.date);
  });

  if (!items.length) {
    list.innerHTML = `<div class="empty"><span class="empty-icon">✦</span>${t('tasks.no_tasks')}</div>`;
    return;
  }
  list.innerHTML = items.map(item => renderTaskCard(item, today)).join('');
}

function buildTaskItems(today) {
  const items    = [];
  const lookback = 30; // aligne avec la fenêtre "en retard" de updateTaskStats

  state.tasks.forEach(task => {
    if (task.recurType === 'once') {
      items.push({
        task, id: task.id, date: task.dueDate, done: task.done,
        isLate: !task.done && task.dueDate < today, occurrence: null,
      });
    } else {
      for (let i = -lookback; i <= 0; i++) {
        const d   = addDays(today, i);
        if (!isTaskActiveOnDate(task, d)) continue;
        const occ  = task.history[d] || null;
        const done = occ === 'done';
        // N'affiche les anciennes occurrences que si elles sont en retard (missed)
        // Pour les occurrences terminées dans le passé, on les cache après 7 jours
        if (i < -7 && done) continue;
        if (i < 0 && !done && occ !== 'missed') continue;
        items.push({
          task, id: task.id + '_' + d, date: d,
          done, isLate: !done && d < today, occurrence: occ,
        });
      }
    }
  });
  return items;
}

function renderTaskCard(item, today) {
  const { task, date, done, isLate } = item;
  const isRecur  = task.recurType !== 'once';
  const isToday  = date === today;
  const col      = TASK_CAT_COLORS[task.cat] || TASK_CAT_COLORS['autre'];
  const catLabel = getTaskCatLabel(task.cat);

  const catBadge     = task.cat
    ? `<span class="task-badge cat-b" style="background:${col.bg};color:${col.color};border-color:${col.border}">${escHtml(catLabel)}</span>` : '';
  const lateText     = isToday && isLate ? t('tasks.late_badge')
    : isLate  ? `⚠ ${date}`
    : isToday ? t('tasks.today')
    : `📅 ${date}`;
  const dateBadge    = `<span class="task-badge ${isLate ? 'late-b' : 'date-b'}">${lateText}</span>`;
  const recurBadge   = isRecur ? `<span class="task-badge recur-b">${recurTypeLabel(task)}</span>` : '';
  const reportBadge  = (task.reportCount || 0) > 0
    ? `<span class="task-badge report-b">↩ ${task.reportCount}</span>` : '';
  const deadlineBadge = task.deadline && !done
    ? `<span class="task-badge deadline-b">${t('tasks.deadline')} ${task.deadline}</span>` : '';
  const doneBadge    = done ? `<span class="task-badge done-b">✓</span>` : '';

  let streakBadge = '';
  if (isRecur) {
    const streak = getStreak(task, date);
    if (streak > 1) streakBadge = `<span class="task-badge streak-b">🔥 ×${streak}</span>`;
  }

  const checkFn    = isRecur ? `toggleTaskDone('${task.id}','${date}')` : `toggleTaskDone('${task.id}')`;
  const checkState = done ? ' checked' : '';

  let historyHtml = '';
  if (isRecur) {
    const past = getPastDueDates(task, today).slice(-14);
    const dots = past.map(d => {
      const v   = task.history[d];
      const cls = v === 'done' ? 'hd-done' : v === 'missed' ? 'hd-missed' : 'hd-pending';
      return `<div class="history-dot ${cls}" title="${d}">${d.slice(8)}</div>`;
    }).join('');
    if (dots) {
      historyHtml = `<div class="task-history" id="hist_${item.id}">
        <div class="task-history-title">${t('history.last14')}</div>
        <div class="history-grid">${dots}</div>
      </div>`;
    }
  }

  const expandBtn = isRecur
    ? `<button class="task-expand-btn" onclick="toggleTaskHistory('hist_${item.id}')" title="Historique">▾</button>` : '';

  return `<div class="task-card${done ? ' task-done' : ''}${isLate && !done ? ' task-late' : ''}${isRecur ? ' task-recur' : ''}">
    <div class="task-card-top">
      <div class="task-checkbox${checkState}" onclick="${checkFn}"></div>
      <div class="task-info">
        <div class="task-title">${escHtml(task.title)}</div>
        ${task.desc ? `<div class="task-desc">${escHtml(task.desc)}</div>` : ''}
        <div class="task-meta">${catBadge}${dateBadge}${recurBadge}${reportBadge}${deadlineBadge}${streakBadge}${doneBadge}</div>
      </div>
      <div class="task-actions">
        ${expandBtn}
        <button class="task-expand-btn" onclick="openTaskModal('${task.id}')" title="Modifier">✎</button>
        <button class="btn btn-danger" onclick="deleteTask('${task.id}')">×</button>
      </div>
    </div>
    ${historyHtml}
  </div>`;
}

function toggleTaskHistory(id) {
  document.getElementById(id)?.classList.toggle('open');
}

// ── Label helpers ─────────────────────────────────────────────

function recurTypeLabel(task) {
  if (task.recurType === 'daily') {
    return '↻ ' + t('recur.daily_label');
  }
  if (task.recurType === 'weekly') {
    return '↻ ' + (task.recurDays || []).sort().map(d => t('day.' + d)).join('/');
  }
  if (task.recurType === 'interval') {
    return `↻ /${task.recurInterval}${t('modal.days').slice(0, 1)}`;
  }
  return '';
}

function getTaskCatLabel(cat) {
  const key = TASK_CAT_LABELS_KEY[cat] || '';
  return key ? t(key) : '';
}

// ── Midnight scheduler ────────────────────────────────────────

/**
 * Planifie un auto-report à minuit pile, sans rechargement.
 * Si l'app reste ouverte pendant la nuit, les tâches de la veille
 * passent automatiquement à "missed" dès le changement de jour.
 */
(function scheduleMidnightAutoReport() {
  function msUntilMidnight() {
    const now   = new Date();
    const next  = new Date(now);
    next.setHours(24, 0, 0, 0); // minuit suivant
    return next.getTime() - now.getTime();
  }

  function tick() {
    autoReportTasks();
    renderTasks();
    updateTaskStats();
    // Re-planifie pour le prochain minuit
    setTimeout(tick, msUntilMidnight());
  }

  setTimeout(tick, msUntilMidnight());
})();
