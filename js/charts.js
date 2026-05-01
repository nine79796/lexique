'use strict';

// ════════════════════════════════════════════════════════════════
//  CHARTS (Chart.js)
// ════════════════════════════════════════════════════════════════

function renderCharts() {
  renderTimeline();
  renderCatChart();
  renderTopWords();
  renderRecurHeatmap();
  renderRecurConsistTable();
  renderTasksBarChart();
  renderAnkiPie();
  renderWorkChart();
}

/** Returns theme-aware colours for Chart.js axes and grid lines. */
function chartColors() {
  const light = document.body.classList.contains('light');
  return {
    text: light ? '#666660' : '#555550',
    grid: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)',
    bg:   light ? '#ffffff'  : '#1a1a17',
  };
}

// ── Timeline (word occurrences — last 30 days) ────────────────

function renderTimeline() {
  const days   = 30;
  const labels = [];
  const data   = [];
  const now    = new Date();
  const { text, grid } = chartColors();

  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(now);
    d.setDate(d.getDate() - i);
    const key = fmtDay(d.getTime());
    labels.push(
      String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
    );
    let cnt = 0;
    Object.values(state.words).forEach(w =>
      w.occurrences.forEach(occ => { if (fmtDay(occ) === key) cnt++; })
    );
    data.push(cnt);
  }

  const ctx = document.getElementById('chartTimeline').getContext('2d');
  chartTimeline?.destroy();
  chartTimeline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(200,169,110,0.5)',
        borderColor: '#c8a96e',
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: text, font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: grid } },
        y: { ticks: { color: text, font: { size: 10 }, stepSize: 1 },       grid: { color: grid } },
      },
    },
  });
}

// ── Category doughnut ─────────────────────────────────────────

function renderCatChart() {
  const labels = [], data = [], colors = [];
  const { text, bg } = chartColors();

  Object.keys(state.categories).forEach(key => {
    const col = getCatColor(key);
    labels.push(state.categories[key].label);
    data.push(Object.values(state.words).filter(w => w.catKey === key).length);
    colors.push(col.color);
  });

  const uncat = Object.values(state.words).filter(w => !w.catKey).length;
  if (uncat > 0) { labels.push(t('words.cat_none')); data.push(uncat); colors.push('#555550'); }

  const ctx = document.getElementById('chartCats').getContext('2d');
  chartCats?.destroy();
  if (!data.length || data.every(d => d === 0)) return;

  chartCats = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: bg, borderWidth: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: text, font: { size: 12 }, padding: 14 } },
      },
    },
  });
}

// ── Top 10 words ──────────────────────────────────────────────

function renderTopWords() {
  const container = document.getElementById('topWords');
  const sorted    = Object.values(state.words)
    .sort((a, b) => b.occurrences.length - a.occurrences.length)
    .slice(0, 10);

  if (!sorted.length) {
    container.innerHTML = `<span style="font-size:13px;color:var(--text-dim)">${t('words.no_words')}</span>`;
    return;
  }

  const max = sorted[0].occurrences.length;
  container.innerHTML = sorted.map(w => `
    <div class="top-word-row">
      <span class="top-word-label${isAnkiReady(w) ? ' is-anki' : ''}">${escHtml(w.label)}</span>
      <div class="top-word-bar-wrap">
        <div class="top-word-bar${isAnkiReady(w) ? ' is-anki' : ''}"
             style="width:${Math.round(w.occurrences.length / max * 100)}%"></div>
      </div>
      <span class="top-word-count">${w.occurrences.length}</span>
    </div>`).join('');
}

// ── Recurring tasks heatmap (12 weeks) ────────────────────────

function renderRecurHeatmap() {
  const weeks  = 12;
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = weeks * 7;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - totalDays + 1);

  // Aggregate done-counts per day across all recurring tasks
  const doneCounts = {};
  state.tasks.forEach(task => {
    if (task.recurType === 'once') return;
    Object.entries(task.history || {}).forEach(([d, v]) => {
      if (v === 'done') doneCounts[d] = (doneCounts[d] || 0) + 1;
    });
  });

  const locale   = DateUtils.getLocale();
  const weekCols = [];

  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date  = new Date(startDate);
      date.setDate(date.getDate() + w * 7 + d);
      const key   = fmtDay(date.getTime());
      const count = doneCounts[key] || 0;
      col.push({
        key, count,
        v:     Math.min(count, 4),
        label: date.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      });
    }
    weekCols.push(col);
  }

  document.getElementById('recurHeatmap').innerHTML =
    '<div class="heatmap-grid">'
    + weekCols.map(col =>
        '<div class="heatmap-week">'
        + col.map(day => `<div class="heatmap-day" data-v="${day.v}" title="${day.label} : ${day.count}"></div>`).join('')
        + '</div>'
      ).join('')
    + '</div>';
}

// ── Recurring consistency table ───────────────────────────────

function renderRecurConsistTable() {
  const container = document.getElementById('recurConsistTable');
  const recurring = state.tasks.filter(task => task.recurType !== 'once');

  if (!recurring.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--text-dim)">${t('recur.no_recur')}</p>`;
    return;
  }

  const today = todayStr();
  const rows  = recurring.map(task => {
    const past   = getPastDueDates(task, today);
    const total  = past.length;
    const done   = past.filter(d => task.history[d] === 'done').length;
    const missed = past.filter(d => task.history[d] !== 'done' && d < today).length;
    const pct    = total > 0 ? Math.round(done / total * 100) : 0;
    const pctClass = pct >= 80 ? 'pct-good' : pct >= 50 ? 'pct-mid' : 'pct-low';
    return { task, total, done, missed, pct, pctClass };
  }).sort((a, b) => b.pct - a.pct);

  const th = [
    t('recur.table.task'), t('recur.table.type'), t('recur.table.done'),
    t('recur.table.missed'), t('recur.table.pct'),
  ];

  container.innerHTML = `<table class="recur-stats-table">
    <thead><tr>${th.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(({ task, total, done, missed, pct, pctClass }) => `
        <tr>
          <td>${escHtml(task.title)}</td>
          <td><span class="task-badge recur-b">${recurTypeLabel(task)}</span></td>
          <td>${done}/${total}</td>
          <td>${missed}</td>
          <td class="${pctClass}">${pct}%</td>
        </tr>`
      ).join('')}
    </tbody>
  </table>`;
}

// ── Tasks bar chart (done vs missed — 30 days) ────────────────

function renderTasksBarChart() {
  const days       = 30;
  const labels     = [];
  const doneData   = [];
  const reportData = [];
  const now        = new Date();
  const { text, grid } = chartColors();

  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(now);
    d.setDate(d.getDate() - i);
    const key = fmtDay(d.getTime());
    labels.push(
      String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
    );
    let done = 0, reps = 0;
    state.tasks.forEach(task => {
      if (task.recurType === 'once') {
        if (task.done && fmtDay(task.doneAt || 0) === key) done++;
        if ((task.reportHistory || []).includes(key)) reps++;
      } else {
        if (task.history[key] === 'done')   done++;
        if (task.history[key] === 'missed') reps++;
      }
    });
    doneData.push(done);
    reportData.push(reps);
  }

  const doneLabel   = t('chart.done');
  const missedLabel = t('chart.missed');

  const ctx = document.getElementById('chartTasksBar').getContext('2d');
  chartTasksBar?.destroy();
  chartTasksBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: doneLabel,   data: doneData,   backgroundColor: 'rgba(110,200,122,0.55)', borderColor: '#6ec87a', borderWidth: 1, borderRadius: 2 },
        { label: missedLabel, data: reportData, backgroundColor: 'rgba(232,160,80,0.5)',   borderColor: '#e8a050', borderWidth: 1, borderRadius: 2 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: text, font: { size: 11 }, padding: 12 } } },
      scales: {
        x: { ticks: { color: text, font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: grid }, stacked: true },
        y: { ticks: { color: text, font: { size: 10 }, stepSize: 1 },       grid: { color: grid }, stacked: true },
      },
    },
  });
}

// ── Anki progress + pie chart ─────────────────────────────────

function renderAnkiPie() {
  const words  = Object.values(state.words);
  const total  = words.length;
  const onAnki = words.filter(w => w.ankiDone).length;
  const ready  = words.filter(w => isAnkiReady(w)).length;
  const notYet = Math.max(total - onAnki - ready, 0);
  const pct    = total > 0 ? Math.round(onAnki / total * 100) : 0;
  const { text, bg } = chartColors();

  const ankiLabel   = t('chart.on_anki');
  const readyLabel  = t('chart.ready');
  const notYetLabel = t('chart.not_yet');

  document.getElementById('ankiProgress').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--text-muted)">${onAnki} / ${total} ${ankiLabel.toLowerCase()}</span>
      <span style="font-size:13px;font-weight:500;color:var(--anki)">${pct}%</span>
    </div>
    <div class="anki-progress-bar-wrap"><div class="anki-progress-bar" style="width:${pct}%"></div></div>
    <div class="anki-progress-labels">
      <span class="anki-progress-label" style="color:var(--anki)">✓ ${ankiLabel} : ${onAnki}</span>
      <span class="anki-progress-label" style="color:var(--accent)">${readyLabel} : ${ready}</span>
      <span class="anki-progress-label">${notYetLabel} : ${notYet}</span>
    </div>`;

  const ctx = document.getElementById('chartAnkiPie').getContext('2d');
  chartAnkiPie?.destroy();
  if (!total) return;

  chartAnkiPie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [ankiLabel, readyLabel, notYetLabel],
      datasets: [{
        data: [onAnki, ready, notYet],
        backgroundColor: ['#6eb4c8', 'rgba(200,169,110,0.7)', 'rgba(85,85,80,0.5)'],
        borderColor: bg,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: text, font: { size: 11 }, padding: 12 } },
      },
    },
  });
}

// ── Work time bar chart (30 days) ─────────────────────────────

function renderWorkChart() {
  const days   = 30;
  const now    = new Date();
  const labels = [];
  const data   = [];
  const { text, grid } = chartColors();

  const workData = getWorkDataByDay(days);

  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(now);
    d.setDate(d.getDate() - i);
    const key = fmtDay(d.getTime());
    labels.push(
      String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
    );
    data.push(Math.round((workData[key] || 0) / 60)); // secondes → minutes
  }

  const ctx = document.getElementById('chartWorkTime')?.getContext('2d');
  if (!ctx) return;
  if (typeof chartWorkTime !== 'undefined' && chartWorkTime) chartWorkTime.destroy();
  chartWorkTime = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(110,180,200,0.45)',
        borderColor: '#6eb4c8',
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: text, font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: grid } },
        y: {
          ticks: { color: text, font: { size: 10 }, callback: v => v + ' min' },
          grid: { color: grid },
        },
      },
    },
  });
}
