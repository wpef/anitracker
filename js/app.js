import { saveEntry, deleteEntry, getStats, getAllEntries } from './db.js';

// ===== State =====
let currentType     = 'walk';             // 'walk' | 'bathroom'
let currentAction   = 'walk_from_start';  // 'walk_from_start'|'walk_from_end'|'pipi'|'caca'
let currentLocation = 'outside';          // 'outside' | 'inside'
let charts          = {};

// ===== DOM helpers =====
const $ = id => document.getElementById(id);
const setActive = (group, value) => {
  document.querySelectorAll(`[data-${group}]`).forEach(el => {
    el.classList.toggle('active', el.dataset[group] === value);
  });
};

// ===== Navigation =====
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  $(`page-${id}`).classList.add('active');
  $(`nav-${id}`).classList.add('active');

  if (id === 'stats') renderStats();
  if (id === 'history') renderHistory();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ===== New Entry Page =====
function initNewEntry() {
  // Type selector
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      setActive('type', currentType);
      updateActionPanel();
    });
  });

  // Action selector (delegated – panel swaps)
  $('action-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    currentAction = btn.dataset.action;
    setActive('action', currentAction);
    updateLocationVisibility();
  });

  // Location selector
  document.querySelectorAll('[data-loc]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLocation = btn.dataset.loc;
      setActive('loc', currentLocation);
    });
  });

  // Time shortcuts
  document.querySelector('.time-shortcuts').addEventListener('click', e => {
    const btn = e.target.closest('[data-offset]');
    if (!btn) return;
    const offsetMin = parseInt(btn.dataset.offset, 10);
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(now.getMinutes() + offsetMin);
    $('entry-time').value = now.toISOString().slice(0, 16);
  });

  // Duration presets
  document.querySelector('.duration-presets').addEventListener('click', e => {
    const btn = e.target.closest('[data-min]');
    if (!btn) return;
    $('entry-duration').value = btn.dataset.min;
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // Submit
  $('btn-add').addEventListener('click', handleAdd);

  // Init datetime
  const now = new Date();
  now.setSeconds(0, 0);
  $('entry-time').value = now.toISOString().slice(0, 16);

  updateActionPanel();
  setActive('type', currentType);
  setActive('loc', currentLocation);
}

function updateActionPanel() {
  const panel = $('action-panel');
  if (currentType === 'walk') {
    panel.innerHTML = `
      <button class="seg-btn active" data-action="walk_from_start">🚶 Par le début</button>
      <button class="seg-btn" data-action="walk_from_end">🏠 Par la fin</button>
    `;
    currentAction = 'walk_from_start';
  } else {
    panel.innerHTML = `
      <button class="seg-btn active" data-action="pipi">💧 Pipi</button>
      <button class="seg-btn" data-action="caca">💩 Caca</button>
    `;
    currentAction = 'pipi';
  }
  setActive('action', currentAction);
  updateLocationVisibility();
  updateDurationVisibility();
}

function updateLocationVisibility() {
  $('location-section').style.display = currentType === 'bathroom' ? 'block' : 'none';
}

function updateDurationVisibility() {
  $('duration-section').style.display = currentType === 'walk' ? 'block' : 'none';
}

function handleAdd() {
  const timeVal = $('entry-time').value;
  const anchorTime = timeVal ? new Date(timeVal) : new Date();
  const note = $('entry-note').value.trim();
  let entry;

  if (currentType === 'walk') {
    const durationMin = parseInt($('entry-duration').value, 10) || 0;
    if (durationMin <= 0) {
      showToast('⚠️ Renseigne une durée pour la balade');
      return;
    }
    let startTime, endTime;
    if (currentAction === 'walk_from_start') {
      startTime = new Date(anchorTime);
      endTime   = new Date(anchorTime.getTime() + durationMin * 60000);
    } else {
      endTime   = new Date(anchorTime);
      startTime = new Date(anchorTime.getTime() - durationMin * 60000);
    }
    entry = {
      type:        'walk',
      anchor:      currentAction === 'walk_from_start' ? 'start' : 'end',
      start_time:  startTime.toISOString(),
      end_time:    endTime.toISOString(),
      duration_min: durationMin,
      timestamp:   startTime.toISOString(),
      note,
    };
  } else {
    entry = {
      type:      'bathroom',
      action:    currentAction,
      location:  currentLocation,
      timestamp: anchorTime.toISOString(),
      note,
    };
  }

  saveEntry(entry);
  showToast(entryLabel(entry) + ' enregistré ✓');

  // Reset form
  const now = new Date();
  now.setSeconds(0, 0);
  $('entry-time').value = now.toISOString().slice(0, 16);
  $('entry-note').value = '';
}

function entryLabel(entry) {
  if (entry.type === 'walk') {
    const dur = entry.duration_min ? ` (${formatDuration(entry.duration_min)})` : '';
    return `🐾 Balade${dur}`;
  }
  const actions = { pipi: 'Pipi', caca: 'Caca' };
  const locs    = { outside: 'dehors', inside: 'dedans' };
  let label = '🚽 ' + (actions[entry.action] || entry.action);
  if (entry.location) label += ' ' + (locs[entry.location] || '');
  return label;
}

// ===== Utilities =====
function formatDuration(totalMin) {
  if (totalMin === null || totalMin === undefined) return '';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// ===== Toast =====
let toastTimer;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== History Page (Timeline) =====
function renderHistory() {
  // Entries sorted newest-first (from db.js unshift)
  const allEntries = getAllEntries()
    .filter(e => !(e.type === 'walk' && e.action === 'end')); // skip obsolete old walk_end
  const container = $('entry-list');

  if (!allEntries.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🐶</div>
      <p>Aucune entrée pour l'instant.<br>Ajoutez la première !</p>
    </div>`;
    return;
  }

  // Group by local calendar day
  const groups = new Map();
  for (const e of allEntries) {
    const key = new Date(e.timestamp).toLocaleDateString('fr-FR',
      { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const todayKey = new Date().toLocaleDateString('fr-FR',
    { year: 'numeric', month: '2-digit', day: '2-digit' });
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = yest.toLocaleDateString('fr-FR',
    { year: 'numeric', month: '2-digit', day: '2-digit' });

  const locLabels = { outside: 'Dehors', inside: 'Dedans' };

  function dayLabel(key, sample) {
    if (key === todayKey)     return "Aujourd'hui";
    if (key === yesterdayKey) return 'Hier';
    return new Date(sample.timestamp).toLocaleDateString('fr-FR',
      { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function entryIcon(e) {
    if (e.type === 'walk') return '🐾';
    return e.action === 'pipi' ? '💧' : '💩';
  }

  function entryTitle(e) {
    if (e.type === 'walk') return 'Balade';
    return e.action === 'pipi' ? 'Pipi' : 'Caca';
  }

  function entryMeta(e) {
    if (e.type === 'walk' && e.duration_min) {
      const start = new Date(e.start_time || e.timestamp);
      const end   = new Date(e.end_time   || (start.getTime() + e.duration_min * 60000));
      const fmt   = t => t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `${fmt(start)} → ${fmt(end)} · ${formatDuration(e.duration_min)}`;
    }
    return '';
  }

  let html = '';
  for (const [key, dayEntries] of groups) {
    html += `<div class="tl-day-header">${dayLabel(key, dayEntries[0])}</div>
             <div class="tl-group">`;

    for (let i = 0; i < dayEntries.length; i++) {
      const e = dayEntries[i];
      const timeStr = new Date(e.timestamp).toLocaleTimeString('fr-FR',
        { hour: '2-digit', minute: '2-digit' });
      const isLast = i === dayEntries.length - 1;

      const durBadge = e.type === 'walk' && e.duration_min
        ? `<span class="tl-duration">${formatDuration(e.duration_min)}</span>` : '';

      const locBadge = e.type === 'bathroom'
        ? `<span class="entry-badge badge-${e.location}">${locLabels[e.location] || ''}</span>` : '';

      const meta = entryMeta(e);

      html += `
        <div class="tl-item ${isLast ? 'tl-item-last' : ''}" data-id="${e.id}">
          <div class="tl-time">${timeStr}</div>
          <div class="tl-line-col">
            <div class="tl-dot tl-dot-${e.type}"></div>
            ${!isLast ? '<div class="tl-connector"></div>' : ''}
          </div>
          <div class="tl-card">
            <div class="tl-card-icon ${e.type}">${entryIcon(e)}</div>
            <div class="tl-card-body">
              <div class="tl-card-title">${entryTitle(e)}</div>
              ${meta ? `<div class="tl-card-note">${meta}</div>` : ''}
              ${e.note ? `<div class="tl-card-note">${e.note}</div>` : ''}
            </div>
            ${durBadge}${locBadge}
            <button class="entry-delete" data-del="${e.id}" title="Supprimer">✕</button>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEntry(Number(btn.dataset.del));
      renderHistory();
    });
  });
}

// ===== Stats Page =====
function renderStats() {
  const s = getStats();

  // Quick stats (24h)
  $('qs-walks').textContent  = s.last24hWalks;
  $('qs-pipi').textContent   = s.last24hPipi;
  $('qs-caca').textContent   = s.last24hCaca;

  // Balades aujourd'hui
  const walkCount = s.todayWalks.length;
  const totalTodayMin = s.todayWalks.reduce((sum, w) => sum + (w.durationMin || 0), 0);
  let todaySummary;
  if (walkCount === 0) {
    todaySummary = '<span class="today-walks-empty">Pas encore de balade aujourd\'hui</span>';
  } else {
    const countLabel = walkCount === 1 ? '1 balade' : `${walkCount} balades`;
    const durLabel = totalTodayMin > 0 ? ` · ${formatDuration(totalTodayMin)} au total` : '';
    todaySummary = `<span class="today-walks-count">${countLabel}</span><span class="today-walks-dur">${durLabel}</span>`;
  }
  $('today-walks-summary').innerHTML = todaySummary;

  // Score propreté
  renderScoreRing(s.propretScore);
  $('si-pipi-out').textContent = s.pipiDehors;
  $('si-pipi-in').textContent  = s.pipiDedans;
  $('si-caca-out').textContent = s.cacaDehors;
  $('si-caca-in').textContent  = s.cacaDedans;

  // Charts
  renderLineChart('chart-propret', s.dailyLabels, s.dailyPropretScore, '#4caf50');
  renderBarChart('chart-needs', s.dailyLabels, [
    { label: 'Pipi',  data: s.dailyPipi,   color: '#90caf9' },
    { label: 'Caca',  data: s.dailyCaca,   color: '#ffcc80' },
  ]);
  renderBarChart('chart-walks', s.dailyLabels, [
    { label: 'Balades', data: s.dailyWalks,  color: '#4cc9f0' },
    { label: 'Dedans',  data: s.dailyInside, color: '#e94560' },
  ]);
}

function renderScoreRing(score) {
  const pct    = score !== null ? score : 0;
  const radius = 54;
  const circum = 2 * Math.PI * radius;
  const offset = circum - (pct / 100) * circum;

  const fill = document.querySelector('.ring-fill');
  fill.setAttribute('stroke-dasharray', circum);
  fill.setAttribute('stroke-dashoffset', circum);   // start at 0
  setTimeout(() => fill.setAttribute('stroke-dashoffset', offset), 50);

  $('ring-pct').textContent   = score !== null ? pct + '%' : '—';
  $('ring-label').textContent = score !== null
    ? (pct >= 80 ? '🌟 Excellent !' : pct >= 50 ? '👍 Bien !' : '💪 En progrès')
    : 'Pas encore de données';
}

function renderBarChart(canvasId, labels, datasets) {
  const ctx = $(canvasId);
  if (!ctx) return;

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const colors = datasets.map(d => d.color);

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        backgroundColor: colors[i] + '99',
        borderColor: colors[i],
        borderWidth: 2,
        borderRadius: 6,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9a9ab0', font: { size: 11 }, boxWidth: 12, padding: 10 }
        },
      },
      scales: {
        x: {
          ticks: { color: '#9a9ab0', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#9a9ab0', precision: 0, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.06)' },
        },
      },
    },
  });
}

function renderLineChart(canvasId, labels, data, color) {
  const ctx = $(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) charts[canvasId].destroy();

  const cleaned = data.map(v => (v === null ? NaN : v));

  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Score (%)',
        data: cleaned,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointBackgroundColor: color,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35,
        spanGaps: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => isNaN(ctx.parsed.y) ? 'Pas de données' : ctx.parsed.y + '%',
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#9a9ab0', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#9a9ab0', font: { size: 10 }, callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,.06)' },
        },
      },
    },
  });
}

// ===== Quick Entry (raccourcis rapides Android) =====
function handleQuickEntry() {
  const params = new URLSearchParams(location.search);
  const quick  = params.get('quick');
  if (!quick) return;

  const now = new Date().toISOString();
  let entry;

  if (quick === 'walk') {
    const durationMin = parseInt(params.get('dur'), 10) || 30;
    const start = new Date();
    const end   = new Date(start.getTime() + durationMin * 60000);
    entry = {
      type: 'walk', anchor: 'start',
      start_time: start.toISOString(), end_time: end.toISOString(),
      duration_min: durationMin, timestamp: start.toISOString(), note: '',
    };
  } else if (quick === 'pipi' || quick === 'caca') {
    entry = {
      type: 'bathroom', action: quick,
      location: params.get('loc') || 'outside',
      timestamp: now, note: '',
    };
  } else {
    return;
  }

  saveEntry(entry);
  showToast(entryLabel(entry) + ' enregistré ✓');
  history.replaceState({}, '', '/');
}

// ===== Boot =====
initNewEntry();
handleQuickEntry();
showPage('new');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
