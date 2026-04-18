'use strict';

// ════════════════════════════════════════════════════════════════
//  REVISION TAB
// ════════════════════════════════════════════════════════════════

function renderRevision() {
  autoReportTasks();
  const today     = todayStr();
  const container = document.getElementById('reviewContent');

  const todayWords = Object.entries(state.words).filter(
    ([, w]) => w.occurrences.some(occ => fmtDay(occ) === today)
  );
  const allItems  = buildTaskItems(today);
  const todayItems = allItems.filter(item => item.date === today && !item.done);
  const lateItems  = todayItems.filter(i => i.isLate);
  const recurItems = todayItems.filter(i => i.task.recurType !== 'once');

  document.getElementById('revStatWords').textContent = todayWords.length;
  document.getElementById('revStatTasks').textContent = todayItems.filter(i => i.task.recurType === 'once').length;
  document.getElementById('revStatRecur').textContent = recurItems.length;
  document.getElementById('revStatLate').textContent  = lateItems.length;

  if (!todayWords.length && !todayItems.length) {
    container.innerHTML = `<div class="empty"><span class="empty-icon">✦</span>${t('review.nothing')}</div>`;
    return;
  }

  const dateDisp = new Date().toLocaleDateString(DateUtils.getLocale(), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  let html = `<div class="review-header">
    <span>${t('review.today')}</span>
    <span class="review-date">${dateDisp}</span>
  </div>`;

  if (todayItems.length) {
    html += `<div class="section-divider" style="margin-bottom:8px">${t('review.tasks_section')}</div>
      <div class="review-table">`;
    todayItems.forEach(item => {
      html += renderRevisionTaskRow(item, today);
    });
    html += '</div>';
  }

  if (todayWords.length) {
    html += `<div class="section-divider" style="margin:14px 0 8px">${t('review.words_section')}</div>
      <div class="review-table">`;
    todayWords.forEach(([key, w]) => {
      html += renderRevisionWordRow(key, w);
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

function renderRevisionTaskRow(item, today) {
  const { task }  = item;
  const isRecur   = task.recurType !== 'once';
  const col       = TASK_CAT_COLORS[task.cat] || TASK_CAT_COLORS['autre'];
  const catLabel  = getTaskCatLabel(task.cat);
  const checkFn   = isRecur
    ? `toggleRevTask('${task.id}','${today}')`
    : `toggleRevTask('${task.id}')`;

  return `<div class="review-row${item.isLate ? ' late-row' : ''}${isRecur ? ' recur-row' : ''}">
    <span class="review-type ${isRecur ? 'type-recur' : 'type-task'}">${isRecur ? t('tasks.recur_badge') : t('tasks.task_badge')}</span>
    <span class="review-label">${escHtml(task.title)}</span>
    <div class="review-badges">
      ${task.cat ? `<span class="task-badge cat-b" style="background:${col.bg};color:${col.color};border-color:${col.border}">${escHtml(catLabel)}</span>` : ''}
      ${item.isLate  ? `<span class="task-badge late-b">⚠ ${t('revision.late')}</span>` : ''}
      ${isRecur      ? `<span class="task-badge recur-b">${recurTypeLabel(task)}</span>` : ''}
      ${task.deadline ? `<span class="task-badge deadline-b">📅 ${task.deadline}</span>` : ''}
    </div>
    <div class="review-check" onclick="${checkFn}"></div>
  </div>`;
}

function renderRevisionWordRow(key, w) {
  const maxed    = isMaxReached(w);
  const noAnki   = !w.ankiDone && !isAnkiReady(w);
  const col      = w.catKey ? getCatColor(w.catKey) : null;
  const catLabel = w.catKey && state.categories[w.catKey] ? state.categories[w.catKey].label : '';
  const validBadge = w.validity === 'valid'
    ? `<span class="val-badge valid"   style="font-size:9px">✓</span>`
    : w.validity === 'invalid'
    ? `<span class="val-badge invalid" style="font-size:9px">✗</span>` : '';
  const wordLabel = t('revision.word_badge');

  return `<div class="review-row word-row">
    <span class="review-type type-word">${wordLabel}</span>
    <span class="review-label${noAnki ? ' no-anki' : ''}">${escHtml(w.label)}</span>
    <div class="review-badges">
      ${col ? `<span class="cat-badge" style="background:${col.bg};color:${col.color};border:0.5px solid ${col.border}">${escHtml(catLabel)}</span>` : ''}
      <span class="count-badge" style="font-size:10px;padding:2px 8px">${w.occurrences.length}×</span>
      ${isAnkiReady(w) ? `<span class="anki-badge" style="font-size:9px">Anki</span>` : ''}
      ${validBadge}
    </div>
    <button class="review-add-btn" onclick="clickWordFromRevision('${key}')" ${maxed ? 'disabled' : ''}>
      ${maxed ? 'Max' : '+ clic'}
    </button>
  </div>`;
}

function toggleRevTask(id, dateStr)  { toggleTaskDone(id, dateStr); renderRevision(); }
function clickWordFromRevision(key)  { clickWord(key); renderRevision(); }
