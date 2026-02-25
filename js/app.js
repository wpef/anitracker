import { saveEntry, deleteEntry, getStats, getAllEntries } from './db.js';

// ===== State =====
let currentType     = 'walk';      // 'walk' | 'bathroom'
let currentAction   = 'start';     // 'start'|'end' | 'pipi'|'caca'
let currentLocation = 'outside';   // 'outside' | 'inside'
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
      <button class="seg-btn active" data-action="start">🚶 Début de balade</button>
      <button class="seg-btn" data-action="end">🏠 Fin de balade</button>
    `;
    currentAction = 'start';
  } else {
    panel.innerHTML = `
      <button class="seg-btn active" data-action="pipi">💧 Pipi</button>
      <button class="seg-btn" data-action="caca">💩 Caca</button>
    `;
    currentAction = 'pipi';
  }
  setActive('action', currentAction);
  updateLocationVisibility();
}

function updateLocationVisibility() {
  const loc = $('location-section');
  // Location makes sense for bathroom (where did they go?) and walk end
  const show = currentType === 'bathroom' || currentAction === 'end';
  loc.style.display = show ? 'block' : 'none';
}

function handleAdd() {
  const timeVal = $('entry-time').value;
  const entry = {
    type:      currentType,
    action:    currentAction,
    location:  currentLocation,
    timestamp: timeVal ? new Date(timeVal).toISOString() : new Date().toISOString(),
    note:      $('entry-note').value.trim(),
  };
  saveEntry(entry);
  showToast(entryLabel(entry) + ' enregistré ✓');

  // Reset time to now
  const now = new Date();
  now.setSeconds(0, 0);
  $('entry-time').value = now.toISOString().slice(0, 16);
  $('entry-note').value = '';
}

function entryLabel(entry) {
  const icons = { walk: '🐾', bathroom: '🚽' };
  const actions = { start: 'Début balade', end: 'Fin balade', pipi: 'Pipi', caca: 'Caca' };
  const locs = { outside: 'dehors', inside: 'dedans' };
  let label = (icons[entry.type] || '') + ' ' + (actions[entry.action] || '');
  if (entry.location && (entry.type === 'bathroom' || entry.action === 'end')) {
    label += ' ' + locs[entry.location];
  }
  return label;
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

// ===== History Page =====
function renderHistory() {
  const entries = getAllEntries();
  const list = $('entry-list');
  if (!entries.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🐶</div>
      <p>Aucune entrée pour l'instant.<br>Ajoutez la première !</p>
    </div>`;
    return;
  }

  const actionLabels = { start: 'Début balade', end: 'Fin balade', pipi: 'Pipi', caca: 'Caca' };
  const actionIcons  = { start: '🚶', end: '🏠', pipi: '💧', caca: '💩' };
  const locLabels    = { outside: 'Dehors', inside: 'Dedans' };

  list.innerHTML = entries.map(e => {
    const d = new Date(e.timestamp);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' });
    const timeStr = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const showLoc = e.type === 'bathroom' || e.action === 'end';
    const badge   = showLoc
      ? `<span class="entry-badge badge-${e.location}">${locLabels[e.location] || ''}</span>`
      : '';
    return `
      <div class="entry-item" data-id="${e.id}">
        <div class="entry-icon ${e.type}">${actionIcons[e.action] || '📋'}</div>
        <div class="entry-body">
          <div class="entry-type">${actionLabels[e.action] || e.action}</div>
          <div class="entry-meta">${dateStr} · ${timeStr}${e.note ? ' · ' + e.note : ''}</div>
        </div>
        ${badge}
        <button class="entry-delete" data-del="${e.id}" title="Supprimer">✕</button>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEntry(Number(btn.dataset.del));
      renderHistory();
    });
  });
}

// ===== Stats Page =====
function renderStats() {
  const s = getStats();

  // Quick stats
  $('qs-walks').textContent  = s.walkStarts;
  $('qs-pipi').textContent   = s.pipi;
  $('qs-caca').textContent   = s.caca;

  // Score propreté
  renderScoreRing(s.propretScore);
  $('si-pipi-out').textContent = s.pipiDehors;
  $('si-pipi-in').textContent  = s.pipiDedans;
  $('si-caca-out').textContent = s.cacaDehors;
  $('si-caca-in').textContent  = s.cacaDedans;

  // Charts
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

// ===== Boot =====
initNewEntry();
showPage('new');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
