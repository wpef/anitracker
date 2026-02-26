import { getFirebaseConfig, saveFirebaseConfig,
         clearFirebaseConfig, parseConfigInput } from './firebase-config.js';

// ===== State =====
let currentType     = 'bathroom';
let currentAction   = 'pipi';
let currentLocation = 'outside';
let charts          = {};
let editingId       = null;
let walkAnchor      = 'start'; // 'start' | 'end'

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
  // Bouton flottant uniquement sur la page "new"
  $('btn-add').style.display = id === 'new' ? 'block' : 'none';

  if (id === 'stats')   renderStats();
  if (id === 'history') renderHistory();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ===== Utilities =====
function formatDuration(totalMin) {
  if (totalMin === null || totalMin === undefined || isNaN(totalMin)) return '';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatWalkTime(isoStr) {
  if (!isoStr) return '—';
  const d     = new Date(isoStr);
  const today = new Date();
  const time  = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return time;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) + ' ' + time;
}

function toLocalISO(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function localNow() {
  return toLocalISO(new Date());
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

// ===== Sync indicator =====
function setSyncState(state) {
  // state: 'ok' | 'pending' | 'error'
  const dot = $('sync-indicator');
  if (!dot) return;
  dot.className = `sync-dot sync-${state}`;
  dot.title = state === 'ok' ? 'Synchronisé' : state === 'pending' ? 'Synchronisation…' : 'Erreur de sync';
}

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

  // Action selector (delegated)
  $('action-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    currentAction = btn.dataset.action;
    setActive('action', currentAction);
    updateLocationVisibility();
    updateFirmnessVisibility();
  });

  // Location selector
  document.querySelectorAll('[data-loc]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLocation = btn.dataset.loc;
      setActive('loc', currentLocation);
    });
  });

  // Time shortcuts → update entry-time (bathroom only)
  document.querySelector('.time-shortcuts').addEventListener('click', e => {
    const btn = e.target.closest('[data-offset]');
    if (!btn) return;
    const offsetMin = parseInt(btn.dataset.offset, 10);
    const t = new Date();
    t.setSeconds(0, 0);
    t.setMinutes(t.getMinutes() + offsetMin);
    $('entry-time').value = toLocalISO(t);
  });

  // Firmness slider
  $('entry-firmness').addEventListener('input', () => {
    $('firmness-value').textContent = $('entry-firmness').value + '%';
  });

  // Walk: focus → switch active anchor
  $('walk-start').addEventListener('focus', () => {
    walkAnchor = 'start';
    updateWalkAnchorUI();
  });
  $('walk-end').addEventListener('focus', () => {
    walkAnchor = 'end';
    updateWalkAnchorUI();
  });

  // Walk: start changes → update display + recalculate duration
  $('walk-start').addEventListener('change', () => {
    $('anchor-start-time').textContent = formatWalkTime($('walk-start').value);
    updateWalkDurationDisplay();
  });

  // Walk: end changes → update display + recalculate duration
  $('walk-end').addEventListener('change', () => {
    $('anchor-end-time').textContent = formatWalkTime($('walk-end').value);
    updateWalkDurationDisplay();
  });

  // Walk: duration presets → compute the NON-anchor side
  document.querySelector('.duration-presets').addEventListener('click', e => {
    const btn = e.target.closest('[data-min]');
    if (!btn) return;
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const min = parseInt(btn.dataset.min, 10);
    if (walkAnchor === 'start') {
      const start = $('walk-start').value;
      if (!start) return;
      $('walk-end').value = toLocalISO(new Date(new Date(start).getTime() + min * 60000));
      $('anchor-end-time').textContent = formatWalkTime($('walk-end').value);
    } else {
      const end = $('walk-end').value;
      if (!end) return;
      $('walk-start').value = toLocalISO(new Date(new Date(end).getTime() - min * 60000));
      $('anchor-start-time').textContent = formatWalkTime($('walk-start').value);
    }
    updateWalkDurationDisplay();
  });

  // Submit
  $('btn-add').addEventListener('click', handleAdd);

  // Init datetime
  $('entry-time').value = localNow();
  $('walk-start').value = localNow();
  $('anchor-start-time').textContent = formatWalkTime($('walk-start').value);
  walkAnchor = 'start';

  updateActionPanel();
  setActive('type', currentType);
  setActive('loc', currentLocation);
}

function updateActionPanel() {
  const panel     = $('action-panel');
  const actionCard = $('action-card');

  if (currentType === 'walk') {
    actionCard.style.display = 'none';
    currentAction = 'walk';
  } else {
    actionCard.style.display = 'block';
    panel.innerHTML = `
      <button class="seg-btn" data-action="pipi">💧 Pipi</button>
      <button class="seg-btn" data-action="caca">💩 Caca</button>
    `;
    // keep currentAction if already pipi/caca, else default to pipi
    if (currentAction !== 'pipi' && currentAction !== 'caca') currentAction = 'pipi';
    setActive('action', currentAction);
  }

  updateLocationVisibility();
  updateWalkSectionVisibility();
  updateFirmnessVisibility();
}

function updateLocationVisibility() {
  $('location-section').style.display = currentType === 'bathroom' ? 'block' : 'none';
}

function updateWalkSectionVisibility() {
  const show = currentType === 'walk';
  $('walk-section').style.display  = show ? 'block' : 'none';
  $('datetime-card').style.display = show ? 'none'  : 'block';
}

function updateFirmnessVisibility() {
  $('firmness-section').style.display =
    (currentType === 'bathroom' && currentAction === 'caca') ? 'block' : 'none';
}

function getWalkDurationMin() {
  const start = $('walk-start').value;
  const end   = $('walk-end').value;
  if (!start || !end) return 0;
  return Math.round((new Date(end) - new Date(start)) / 60000);
}

function updateWalkAnchorUI() {
  $('anchor-start-btn').classList.toggle('active', walkAnchor === 'start');
  $('anchor-end-btn').classList.toggle('active', walkAnchor === 'end');
}

function updateWalkDurationDisplay() {
  const dur = getWalkDurationMin();
  $('walk-duration-display').textContent = dur > 0 ? formatDuration(dur) : '—';
}

async function handleAdd() {
  const note = $('entry-note').value.trim();
  let entry;

  if (currentType === 'walk') {
    const startVal = $('walk-start').value;
    const endVal   = $('walk-end').value;
    const durationMin = getWalkDurationMin();
    if (!startVal || durationMin <= 0) {
      showToast('⚠️ Renseigne un début et une fin pour la balade');
      return;
    }
    entry = {
      type:         'walk',
      anchor:       'start',
      start_time:   new Date(startVal).toISOString(),
      end_time:     endVal ? new Date(endVal).toISOString() : null,
      duration_min: durationMin,
      timestamp:    new Date(startVal).toISOString(),
      note,
    };
  } else {
    const timeVal = $('entry-time').value;
    const firmness = currentAction === 'caca'
      ? parseInt($('entry-firmness').value, 10) : undefined;
    entry = {
      type:      'bathroom',
      action:    currentAction,
      location:  currentLocation,
      timestamp: timeVal ? new Date(timeVal).toISOString() : new Date().toISOString(),
      note,
      ...(firmness !== undefined ? { firmness } : {}),
    };
  }

  setSyncState('pending');
  try {
    await saveEntry(entry);
    setSyncState('ok');
  } catch {
    setSyncState('error');
  }
  showToast(entryLabel(entry) + ' enregistré ✓');

  // Reset form
  $('entry-time').value  = localNow();
  $('walk-start').value  = localNow();
  $('walk-end').value    = '';
  $('entry-note').value  = '';
  $('entry-firmness').value = '80';
  $('firmness-value').textContent = '80%';
  updateWalkDurationDisplay();
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
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

// ===== History Page (Timeline) =====
function renderHistory() {
  const allEntries = getAllEntries()
    .filter(e => !(e.type === 'walk' && e.action === 'end'));
  const container = $('entry-list');

  if (!allEntries.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🐶</div>
      <p>Aucune entrée pour l'instant.<br>Ajoutez la première !</p>
    </div>`;
    return;
  }

  // Group by local calendar day (newest day first, entries ascending within day)
  const groups = new Map();
  for (const e of allEntries) {
    const key = new Date(e.timestamp).toLocaleDateString('fr-FR',
      { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  // Sort within each group: chronological (oldest first)
  for (const [, dayEntries] of groups) {
    dayEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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
    if (e.type === 'walk') {
      const start = new Date(e.start_time || e.timestamp);
      const end   = e.end_time
        ? new Date(e.end_time)
        : (e.duration_min ? new Date(start.getTime() + e.duration_min * 60000) : null);
      const fmt = t => t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const timeRange = end ? `${fmt(start)} → ${fmt(end)}` : fmt(start);
      const durStr    = e.duration_min ? ` · ${formatDuration(e.duration_min)}` : '';
      return timeRange + durStr;
    }
    if (e.type === 'bathroom' && e.action === 'caca' && e.firmness !== undefined) {
      return `Fermeté : ${e.firmness}%`;
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
            <button class="entry-edit"   data-edit="${e.id}" title="Modifier">✏️</button>
            <button class="entry-delete" data-del="${e.id}"  title="Supprimer">✕</button>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;

  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      setSyncState('pending');
      try {
        await deleteEntry(btn.dataset.del);
        setSyncState('ok');
      } catch {
        setSyncState('error');
      }
      renderHistory();
    });
  });

  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = getAllEntries().find(e => e.id === btn.dataset.edit);
      if (entry) openEditModal(entry);
    });
  });
}

// ===== Edit Modal =====
function openEditModal(entry) {
  editingId = entry.id;
  let html = '';

  if (entry.type === 'walk') {
    const startVal = toLocalISO(entry.start_time || entry.timestamp);
    const endVal   = entry.end_time ? toLocalISO(entry.end_time) : '';
    const dur      = entry.duration_min || 0;
    html = `
      <div class="modal-field-group">
        <div class="modal-field">
          <label class="modal-label">🚶 Début</label>
          <input type="datetime-local" id="edit-walk-start" value="${startVal}" class="modal-input" />
        </div>
        <div class="modal-field">
          <label class="modal-label">🏠 Fin</label>
          <input type="datetime-local" id="edit-walk-end" value="${endVal}" class="modal-input" />
        </div>
      </div>
      <div id="edit-dur-display" class="walk-duration-display">${dur > 0 ? formatDuration(dur) : '— min'}</div>
      <div class="modal-field">
        <label class="modal-label">📝 Note</label>
        <input type="text" id="edit-note" value="${entry.note || ''}" class="modal-input" placeholder="Note…" />
      </div>`;
  } else {
    const timeVal = toLocalISO(entry.timestamp);
    const isIn    = entry.location === 'inside';
    const isCaca  = entry.action === 'caca';
    const firmness = entry.firmness !== undefined ? entry.firmness : 80;
    html = `
      <div class="segment modal-segment">
        <button class="seg-btn ${!isCaca ? 'active' : ''}" data-edit-action="pipi">💧 Pipi</button>
        <button class="seg-btn ${isCaca  ? 'active' : ''}" data-edit-action="caca">💩 Caca</button>
      </div>
      <div class="segment modal-segment" style="margin-top:10px">
        <button class="seg-btn ${!isIn ? 'active' : ''}" data-edit-loc="outside">🌿 Dehors</button>
        <button class="seg-btn ${isIn  ? 'active' : ''}" data-edit-loc="inside">🏠 Dedans</button>
      </div>
      <div id="edit-firmness-section" style="display:${isCaca ? 'block' : 'none'};margin-top:14px">
        <label class="modal-label">💩 Fermeté</label>
        <input type="range" id="edit-firmness" min="0" max="100" value="${firmness}" step="5" />
        <div class="firmness-row">
          <span class="firmness-end">Liquide</span>
          <span id="edit-firmness-value" class="firmness-current">${firmness}%</span>
          <span class="firmness-end">Ferme</span>
        </div>
      </div>
      <div class="modal-field" style="margin-top:14px">
        <label class="modal-label">🕐 Date &amp; heure</label>
        <input type="datetime-local" id="edit-time" value="${timeVal}" class="modal-input" />
      </div>
      <div class="modal-field" style="margin-top:10px">
        <label class="modal-label">📝 Note</label>
        <input type="text" id="edit-note" value="${entry.note || ''}" class="modal-input" placeholder="Note…" />
      </div>`;
  }

  $('modal-body').innerHTML = html;
  $('edit-modal').style.display = 'flex';

  // Walk: link start ↔ end ↔ duration
  if (entry.type === 'walk') {
    $('edit-walk-start').addEventListener('change', () => {
      const dur = Math.round((new Date($('edit-walk-end').value) - new Date($('edit-walk-start').value)) / 60000);
      if ($('edit-walk-end').value && dur > 0) {
        $('edit-dur-display').textContent = formatDuration(dur);
      }
    });
    $('edit-walk-end').addEventListener('change', () => {
      const dur = Math.round((new Date($('edit-walk-end').value) - new Date($('edit-walk-start').value)) / 60000);
      $('edit-dur-display').textContent = dur > 0 ? formatDuration(dur) : '— min';
    });
  }

  // Bathroom: action toggle
  if (entry.type === 'bathroom') {
    $('modal-body').addEventListener('click', e => {
      const aBtn = e.target.closest('[data-edit-action]');
      if (aBtn) {
        $('modal-body').querySelectorAll('[data-edit-action]').forEach(b => b.classList.remove('active'));
        aBtn.classList.add('active');
        const isCaca = aBtn.dataset.editAction === 'caca';
        $('edit-firmness-section').style.display = isCaca ? 'block' : 'none';
      }
      const lBtn = e.target.closest('[data-edit-loc]');
      if (lBtn) {
        $('modal-body').querySelectorAll('[data-edit-loc]').forEach(b => b.classList.remove('active'));
        lBtn.classList.add('active');
      }
    });
    // Firmness live update
    const efInput = $('edit-firmness');
    if (efInput) {
      efInput.addEventListener('input', () => {
        $('edit-firmness-value').textContent = efInput.value + '%';
      });
    }
  }
}

function closeEditModal() {
  $('edit-modal').style.display = 'none';
  editingId = null;
}

async function saveEdit() {
  if (!editingId) return;
  const entry = getAllEntries().find(e => e.id === editingId);
  if (!entry) return;

  let updated = {};

  if (entry.type === 'walk') {
    const startVal = $('edit-walk-start').value;
    const endVal   = $('edit-walk-end').value;
    const dur      = endVal
      ? Math.round((new Date(endVal) - new Date(startVal)) / 60000) : (entry.duration_min || 0);
    updated = {
      start_time:   new Date(startVal).toISOString(),
      end_time:     endVal ? new Date(endVal).toISOString() : null,
      duration_min: dur,
      timestamp:    new Date(startVal).toISOString(),
      note:         $('edit-note').value.trim(),
    };
  } else {
    const activeAction = $('modal-body').querySelector('[data-edit-action].active')?.dataset.editAction || entry.action;
    const activeLoc    = $('modal-body').querySelector('[data-edit-loc].active')?.dataset.editLoc    || entry.location;
    const firmInput    = $('edit-firmness');
    const firmness     = (activeAction === 'caca' && firmInput) ? parseInt(firmInput.value, 10) : undefined;
    updated = {
      action:    activeAction,
      location:  activeLoc,
      timestamp: new Date($('edit-time').value).toISOString(),
      note:      $('edit-note').value.trim(),
      ...(firmness !== undefined ? { firmness } : {}),
    };
  }

  setSyncState('pending');
  try {
    await updateEntry(editingId, updated);
    setSyncState('ok');
  } catch {
    setSyncState('error');
  }
  closeEditModal();
  renderHistory();
  showToast('Entrée modifiée ✓');
}

// Modal bindings
$('modal-close').addEventListener('click', closeEditModal);
$('modal-cancel').addEventListener('click', closeEditModal);
$('modal-save').addEventListener('click', saveEdit);
$('edit-modal').addEventListener('click', e => {
  if (e.target === $('edit-modal')) closeEditModal(); // tap outside
});

// ===== Stats Page =====
function renderStats() {
  const s = getStats();

  // Quick-stats
  $('qs-pipi-in').textContent    = s.todayPipiDedans;
  $('qs-pipi-total').textContent = s.todayPipiTotal;
  $('qs-walk-time').textContent  = s.todayWalkMinSince7am > 0
    ? formatDuration(s.todayWalkMinSince7am) : '0';

  // Score propreté
  renderScoreRing(s.propretScore);
  $('si-pipi-out').textContent = s.pipiDehors;
  $('si-pipi-in').textContent  = s.pipiDedans;
  $('si-caca-out').textContent = s.cacaDehors;
  $('si-caca-in').textContent  = s.cacaDedans;

  // Balades aujourd'hui
  const walkCount     = s.todayWalks.length;
  const totalTodayMin = s.todayWalks.reduce((sum, w) => sum + (w.durationMin || 0), 0);
  let todaySummary;
  if (walkCount === 0) {
    todaySummary = '<span class="today-walks-empty">Pas encore de balade aujourd\'hui</span>';
  } else {
    const countLabel = walkCount === 1 ? '1 balade' : `${walkCount} balades`;
    const durLabel   = totalTodayMin > 0 ? ` · ${formatDuration(totalTodayMin)} au total` : '';
    todaySummary = `<span class="today-walks-count">${countLabel}</span><span class="today-walks-dur">${durLabel}</span>`;
  }
  $('today-walks-summary').innerHTML = todaySummary;

  // Graphique propreté → barres par jour
  renderBarChart('chart-propret', s.dailyLabels, [
    { label: 'Propreté (%)', data: s.dailyPropretScore, color: '#4caf50' },
  ], { yMax: 100, yUnit: '%' });

  // Graphique fermeté caca → courbe
  renderLineChart('chart-firmness', s.dailyLabels, s.dailyAvgFirmness, '#ffcc80');
}

function renderScoreRing(score) {
  const pct    = score !== null ? score : 0;
  const radius = 54;
  const circum = 2 * Math.PI * radius;
  const offset = circum - (pct / 100) * circum;

  const fill = document.querySelector('.ring-fill');
  fill.setAttribute('stroke-dasharray', circum);
  fill.setAttribute('stroke-dashoffset', circum);
  setTimeout(() => fill.setAttribute('stroke-dashoffset', offset), 50);

  $('ring-pct').textContent   = score !== null ? pct + '%' : '—';
  $('ring-label').textContent = score !== null
    ? (pct >= 80 ? '🌟 Excellent !' : pct >= 50 ? '👍 Bien !' : '💪 En progrès')
    : 'Pas encore de données';
}

function renderBarChart(canvasId, labels, datasets, opts = {}) {
  const ctx = $(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) { charts[canvasId].destroy(); }

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label:           d.label,
        data:            d.data.map(v => v === null ? NaN : v),
        backgroundColor: d.color + '99',
        borderColor:     d.color,
        borderWidth:     2,
        borderRadius:    6,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: { color: '#9a9ab0', font: { size: 11 }, boxWidth: 12, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: ctx => isNaN(ctx.parsed.y)
              ? 'Pas de données'
              : ctx.parsed.y + (opts.yUnit || ''),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#9a9ab0', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        y: {
          beginAtZero: true,
          ...(opts.yMax ? { max: opts.yMax } : {}),
          ticks: {
            color:     '#9a9ab0',
            precision: 0,
            font:      { size: 10 },
            callback:  v => v + (opts.yUnit || ''),
          },
          grid: { color: 'rgba(255,255,255,.06)' },
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
        label:              'Fermeté (%)',
        data:               cleaned,
        borderColor:        color,
        backgroundColor:    color + '22',
        borderWidth:        2,
        pointBackgroundColor: color,
        pointRadius:        4,
        pointHoverRadius:   6,
        fill:               true,
        tension:            0.35,
        spanGaps:           false,
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
          grid:  { color: 'rgba(255,255,255,.06)' },
        },
      },
    },
  });
}

// ===== Chargement dynamique de db.js (après config Firebase) =====
// Ces variables sont initialisées par loadDb()
let initDB, saveEntry, deleteEntry, updateEntry, getStats, getAllEntries;

async function loadDb() {
  const db = await import('./db.js');
  initDB       = db.initDB;
  saveEntry    = db.saveEntry;
  deleteEntry  = db.deleteEntry;
  updateEntry  = db.updateEntry;
  getStats     = db.getStats;
  getAllEntries = db.getAllEntries;
}

// ===== Écran de configuration Firebase =====
function showSetupScreen() {
  $('setup-overlay').style.display = 'flex';
  if (getFirebaseConfig()) {
    $('setup-reset').style.display = 'block';
  }
}

$('setup-save').addEventListener('click', () => {
  const text = $('setup-input').value.trim();
  const config = parseConfigInput(text);
  $('setup-error').style.display = config ? 'none' : 'block';
  if (!config) return;
  saveFirebaseConfig(config);
  location.reload();
});

$('setup-reset').addEventListener('click', () => {
  clearFirebaseConfig();
  location.reload();
});

// ===== Quick Entry (raccourcis URL) =====
async function handleQuickEntry() {
  const params = new URLSearchParams(location.search);
  const quick  = params.get('quick');
  if (!quick) return;

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
      timestamp: new Date().toISOString(), note: '',
    };
  } else {
    return;
  }

  await saveEntry(entry);
  showToast(entryLabel(entry) + ' enregistré ✓');
  history.replaceState({}, '', '/');
}

// ===== Boot =====
async function boot() {
  // Vérifie si Firebase est configuré
  if (!getFirebaseConfig()) {
    showSetupScreen();
    return;
  }

  // Charge db.js dynamiquement (échoue si config invalide)
  try {
    await loadDb();
  } catch {
    showSetupScreen();
    return;
  }

  setSyncState('pending');

  initDB(() => {
    const active = document.querySelector('.page.active');
    if (active?.id === 'page-stats')   renderStats();
    if (active?.id === 'page-history') renderHistory();
    setSyncState('ok');
  });

  initNewEntry();
  await handleQuickEntry();
  showPage('new');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

boot();
