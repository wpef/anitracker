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
  $(`page-${id}`).classList.add('active');
  // Nav bar : pas de mise à jour pour la page edit (on reste sur "historique")
  if (id !== 'edit') {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navBtn = $(`nav-${id}`);
    if (navBtn) navBtn.classList.add('active');
  }
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
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    let t;
    if (offsetMin === 0) {
      // "Maintenant" → heure courante réelle
      t = new Date();
    } else {
      // Relatif à la valeur actuellement affichée
      t = $('entry-time').value ? new Date($('entry-time').value) : new Date();
      t.setMinutes(t.getMinutes() + offsetMin);
    }
    t.setSeconds(0, 0);
    $('entry-time').value = toLocalISO(t);
    sessionStorage.setItem('lastEntryTime', $('entry-time').value);
  });

  // Persistance du temps saisi
  $('entry-time').addEventListener('change', () => {
    sessionStorage.setItem('lastEntryTime', $('entry-time').value);
  });
  $('walk-start').addEventListener('change', () => {
    sessionStorage.setItem('lastWalkStart', $('walk-start').value);
  });

  // Firmness slider (caca)
  $('entry-firmness').addEventListener('input', () => {
    $('firmness-value').textContent = $('entry-firmness').value + '%';
  });

  // Taille slider (pipi)
  $('entry-taille').addEventListener('input', () => {
    $('taille-value').textContent = $('entry-taille').value + '%';
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

  // Init datetime — restaure la dernière valeur ou heure courante
  $('entry-time').value = sessionStorage.getItem('lastEntryTime') || localNow();
  $('walk-start').value = sessionStorage.getItem('lastWalkStart') || localNow();
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
  updateTailleVisibility();
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

function updateTailleVisibility() {
  $('taille-section').style.display =
    (currentType === 'bathroom' && currentAction === 'pipi') ? 'block' : 'none';
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
    const taille = currentAction === 'pipi'
      ? parseInt($('entry-taille').value, 10) : undefined;
    entry = {
      type:      'bathroom',
      action:    currentAction,
      location:  currentLocation,
      timestamp: timeVal ? new Date(timeVal).toISOString() : new Date().toISOString(),
      note,
      ...(firmness !== undefined ? { firmness } : {}),
      ...(taille   !== undefined ? { taille }   : {}),
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

  // Reset form — le temps reste inchangé, seuls les champs non-temporels se réinitialisent
  $('walk-end').value    = '';
  $('entry-note').value  = '';
  $('entry-firmness').value = '80';
  $('firmness-value').textContent = '80%';
  $('entry-taille').value = '50';
  $('taille-value').textContent = '50%';
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

// ===== History Page (liste simple, plus récent en tête) =====
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

  // Grouper par jour local (jours les plus récents déjà en tête car allEntries est trié desc)
  const groups = new Map();
  for (const e of allEntries) {
    const key = new Date(e.timestamp).toLocaleDateString('fr-FR',
      { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  // Au sein de chaque jour : plus récent en premier (déjà trié desc par getAllEntries)

  const todayKey = new Date().toLocaleDateString('fr-FR',
    { year: 'numeric', month: '2-digit', day: '2-digit' });
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterdayKey = yest.toLocaleDateString('fr-FR',
    { year: 'numeric', month: '2-digit', day: '2-digit' });

  function dayLabel(key, sample) {
    if (key === todayKey)     return "Aujourd'hui";
    if (key === yesterdayKey) return 'Hier';
    return new Date(sample.timestamp).toLocaleDateString('fr-FR',
      { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const fmt = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  let html = '';

  for (const [key, dayEntries] of groups) {
    html += `<div class="tl-day-header">${dayLabel(key, dayEntries[0])}</div>
             <div class="tl-list">`;

    for (const e of dayEntries) {
      if (e.type === 'walk') {
        const dur      = e.duration_min ? formatDuration(e.duration_min) : '';
        const startStr = fmt(e.start_time || e.timestamp);
        const endStr   = e.end_time ? fmt(e.end_time) : '';
        const range    = endStr ? `${startStr} → ${endStr}` : startStr;
        const meta     = [range, e.note].filter(Boolean).join(' · ');
        html += `<div class="tl-entry tl-entry-walk" data-id="${e.id}">
                   <div class="tl-entry-time">${startStr}</div>
                   <div class="tl-entry-icon">🐾</div>
                   <div class="tl-entry-body">
                     <div class="tl-entry-title">Balade${dur ? ' · ' + dur : ''}</div>
                     ${meta ? `<div class="tl-entry-meta">${meta}</div>` : ''}
                   </div>
                 </div>`;
      } else {
        const icon     = e.action === 'pipi' ? '💧' : '💩';
        const title    = e.action === 'pipi' ? 'Pipi' : 'Caca';
        const locClass = e.location === 'inside' ? 'inside' : 'outside';
        const locLabel = e.location === 'inside' ? 'Dedans' : 'Dehors';
        const parts    = [];
        if (e.action === 'caca' && e.firmness !== undefined) parts.push(`Fermeté ${e.firmness}%`);
        if (e.action === 'pipi' && e.taille   !== undefined) parts.push(`Quantité ${e.taille}%`);
        if (e.note) parts.push(e.note);
        const meta = parts.join(' · ');
        html += `<div class="tl-entry tl-entry-bathroom tl-entry-${locClass}" data-id="${e.id}">
                   <div class="tl-entry-time">${fmt(e.timestamp)}</div>
                   <div class="tl-entry-icon">${icon}</div>
                   <div class="tl-entry-body">
                     <div class="tl-entry-title">${title}</div>
                     ${meta ? `<div class="tl-entry-meta">${meta}</div>` : ''}
                   </div>
                   <span class="entry-badge badge-${e.location}">${locLabel}</span>
                 </div>`;
      }
    }
    html += '</div>';
  }

  container.innerHTML = html;

  container.querySelectorAll('.tl-entry[data-id]').forEach(el => {
    el.addEventListener('click', () => openEditPage(el.dataset.id));
  });
}

// ===== Page d'édition =====
function openEditPage(id) {
  const entry = getAllEntries().find(e => e.id === id);
  if (!entry) return;
  editingId = id;

  const body = $('edit-page-body');
  let html = '';

  if (entry.type === 'walk') {
    const startVal = toLocalISO(entry.start_time || entry.timestamp);
    const endVal   = entry.end_time ? toLocalISO(entry.end_time) : '';
    const dur      = entry.duration_min || 0;
    html = `
      <div class="card">
        <div class="card-title">🚶 Début</div>
        <input type="datetime-local" id="edit-walk-start" value="${startVal}" class="modal-input" />
      </div>
      <div class="card">
        <div class="card-title">🏠 Fin</div>
        <input type="datetime-local" id="edit-walk-end" value="${endVal}" class="modal-input" />
      </div>
      <div id="edit-dur-display" class="walk-duration-display">${dur > 0 ? formatDuration(dur) : '—'}</div>
      <div class="card">
        <div class="card-title">📝 Note</div>
        <input type="text" id="edit-note" value="${entry.note || ''}" class="modal-input" placeholder="Note…" />
      </div>`;
  } else {
    const timeVal  = toLocalISO(entry.timestamp);
    const isIn     = entry.location === 'inside';
    const isCaca   = entry.action === 'caca';
    const firmness = entry.firmness !== undefined ? entry.firmness : 80;
    const taille   = entry.taille   !== undefined ? entry.taille   : 50;
    html = `
      <div class="card">
        <div class="card-title">Action</div>
        <div class="segment">
          <button class="seg-btn ${!isCaca ? 'active' : ''}" data-edit-action="pipi">💧 Pipi</button>
          <button class="seg-btn ${isCaca  ? 'active' : ''}" data-edit-action="caca">💩 Caca</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Lieu</div>
        <div class="segment">
          <button class="seg-btn ${!isIn ? 'active' : ''}" data-edit-loc="outside">🌿 Dehors</button>
          <button class="seg-btn ${isIn  ? 'active' : ''}" data-edit-loc="inside">🏠 Dedans</button>
        </div>
      </div>
      <div class="card" id="edit-firmness-section" style="display:${isCaca ? 'block' : 'none'}">
        <div class="card-title">💩 Fermeté</div>
        <input type="range" id="edit-firmness" min="0" max="100" value="${firmness}" step="5" />
        <div class="firmness-row">
          <span class="firmness-end">Liquide</span>
          <span id="edit-firmness-value" class="firmness-current">${firmness}%</span>
          <span class="firmness-end">Ferme</span>
        </div>
      </div>
      <div class="card" id="edit-taille-section" style="display:${!isCaca ? 'block' : 'none'}">
        <div class="card-title">💧 Quantité</div>
        <input type="range" id="edit-taille" min="0" max="100" value="${taille}" step="5" />
        <div class="firmness-row">
          <span class="firmness-end">Peu</span>
          <span id="edit-taille-value" class="firmness-current">${taille}%</span>
          <span class="firmness-end">Beaucoup</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🕐 Date &amp; heure</div>
        <input type="datetime-local" id="edit-time" value="${timeVal}" class="modal-input" />
      </div>
      <div class="card">
        <div class="card-title">📝 Note</div>
        <input type="text" id="edit-note" value="${entry.note || ''}" class="modal-input" placeholder="Note…" />
      </div>`;
  }

  body.innerHTML = html;
  showPage('edit');

  if (entry.type === 'walk') {
    const recalcDur = () => {
      const dur = Math.round((new Date($('edit-walk-end').value) - new Date($('edit-walk-start').value)) / 60000);
      $('edit-dur-display').textContent = (dur > 0 && $('edit-walk-end').value) ? formatDuration(dur) : '—';
    };
    $('edit-walk-start').addEventListener('change', recalcDur);
    $('edit-walk-end').addEventListener('change', recalcDur);
  } else {
    body.addEventListener('click', ev => {
      const aBtn = ev.target.closest('[data-edit-action]');
      if (aBtn) {
        body.querySelectorAll('[data-edit-action]').forEach(b => b.classList.remove('active'));
        aBtn.classList.add('active');
        const isCaca = aBtn.dataset.editAction === 'caca';
        $('edit-firmness-section').style.display = isCaca  ? 'block' : 'none';
        $('edit-taille-section').style.display   = !isCaca ? 'block' : 'none';
      }
      const lBtn = ev.target.closest('[data-edit-loc]');
      if (lBtn) {
        body.querySelectorAll('[data-edit-loc]').forEach(b => b.classList.remove('active'));
        lBtn.classList.add('active');
      }
    });
    const efInput = $('edit-firmness');
    if (efInput) efInput.addEventListener('input', () => { $('edit-firmness-value').textContent = efInput.value + '%'; });
    const etInput = $('edit-taille');
    if (etInput) etInput.addEventListener('input', () => { $('edit-taille-value').textContent = etInput.value + '%'; });
  }
}

// Bindings de la page edit (persistent, pas recréés à chaque ouverture)
$('edit-back-btn').addEventListener('click', () => {
  editingId = null;
  showPage('history');
});

$('edit-delete-btn').addEventListener('click', async () => {
  if (!editingId) return;
  if (!confirm('Supprimer cette entrée ?')) return;
  setSyncState('pending');
  try { await deleteEntry(editingId); setSyncState('ok'); }
  catch { setSyncState('error'); }
  editingId = null;
  showPage('history');
  showToast('Entrée supprimée');
});

$('edit-page-save-btn').addEventListener('click', async () => {
  if (!editingId) return;
  const entry = getAllEntries().find(e => e.id === editingId);
  if (!entry) return;

  const body = $('edit-page-body');
  let updated = {};

  if (entry.type === 'walk') {
    const startVal = $('edit-walk-start').value;
    const endVal   = $('edit-walk-end').value;
    const dur      = endVal ? Math.round((new Date(endVal) - new Date(startVal)) / 60000) : (entry.duration_min || 0);
    updated = {
      start_time: new Date(startVal).toISOString(), end_time: endVal ? new Date(endVal).toISOString() : null,
      duration_min: dur, timestamp: new Date(startVal).toISOString(), note: $('edit-note').value.trim(),
    };
  } else {
    const activeAction = body.querySelector('[data-edit-action].active')?.dataset.editAction || entry.action;
    const activeLoc    = body.querySelector('[data-edit-loc].active')?.dataset.editLoc       || entry.location;
    const firmInput    = $('edit-firmness');
    const tailleInput  = $('edit-taille');
    const firmness     = (activeAction === 'caca' && firmInput)   ? parseInt(firmInput.value, 10)   : undefined;
    const taille       = (activeAction === 'pipi' && tailleInput) ? parseInt(tailleInput.value, 10) : undefined;
    updated = {
      action: activeAction, location: activeLoc,
      timestamp: new Date($('edit-time').value).toISOString(),
      note: $('edit-note').value.trim(),
      ...(firmness !== undefined ? { firmness } : {}),
      ...(taille   !== undefined ? { taille }   : {}),
    };
  }

  setSyncState('pending');
  try { await updateEntry(editingId, updated); setSyncState('ok'); }
  catch { setSyncState('error'); }
  editingId = null;
  showPage('history');
  showToast('Entrée modifiée ✓');
});

// ===== Stats Page =====
function renderStats() {
  const s = getStats();

  // Quick-stats
  $('qs-pipi-in').textContent    = s.todayPipiDedans;
  $('qs-pipi-total').textContent = s.todayPipiTotal;
  $('qs-walk-time').textContent  = s.todayWalkMinSince7am > 0
    ? formatDuration(s.todayWalkMinSince7am) : '0';

  // Score propreté du jour
  renderScoreRing(s.todayScore);
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

  // Graphique fermeté caca → entrées individuelles sur 3 jours
  renderLineChart('chart-firmness', s.firmnessLabels, s.firmnessData, '#ffcc80');
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

// ===== Chargement dynamique de db.js / demo-db.js =====
let initDB, saveEntry, deleteEntry, updateEntry, getAllEntries;

async function loadDb() {
  const db = await import('./db.js');
  initDB       = db.initDB;
  saveEntry    = db.saveEntry;
  deleteEntry  = db.deleteEntry;
  updateEntry  = db.updateEntry;
  getAllEntries = db.getAllEntries;
}

async function loadDemoDb() {
  const db = await import('./demo-db.js');
  initDB       = db.initDB;
  saveEntry    = db.saveEntry;
  deleteEntry  = db.deleteEntry;
  updateEntry  = db.updateEntry;
  getAllEntries = db.getAllEntries;
}

// ===== getStats (utilise getAllEntries assigné par loadDb/loadDemoDb) =====
function getStats() {
  const entries = getAllEntries();
  const now     = new Date();
  const isWalk  = e => e.type === 'walk' && e.action !== 'end';

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const recent = entries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);

  const walkStarts = recent.filter(isWalk);
  const pipi       = recent.filter(e => e.type === 'bathroom' && e.action === 'pipi');
  const caca       = recent.filter(e => e.type === 'bathroom' && e.action === 'caca');
  const pipiDehors = pipi.filter(e => e.location === 'outside').length;
  const pipiDedans = pipi.filter(e => e.location === 'inside').length;
  const cacaDehors = caca.filter(e => e.location === 'outside').length;
  const cacaDedans = caca.filter(e => e.location === 'inside').length;

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = entries.filter(e => new Date(e.timestamp) >= todayStart);

  const todayPipi         = todayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi');
  const todayCacaDedans   = todayEntries.filter(e => e.type === 'bathroom' && e.action === 'caca' && e.location === 'inside').length;
  const todayPipiDedans_s = todayPipi.filter(e => e.location === 'inside').length;
  const todayBad          = todayPipiDedans_s + todayCacaDedans;
  const todayScore        = todayPipi.length > 0
    ? Math.max(0, Math.round(100 - (todayBad / todayPipi.length * 100))) : null;

  const statsFrom7am = new Date(now);
  if (now.getHours() < 7) statsFrom7am.setDate(statsFrom7am.getDate() - 1);
  statsFrom7am.setHours(7, 0, 0, 0);
  const quickEntries = entries.filter(e => new Date(e.timestamp) >= statsFrom7am);

  const todayPipiTotal       = quickEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi').length;
  const todayPipiDedans      = quickEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi' && e.location === 'inside').length;
  const todayWalkMinSince7am = quickEntries.filter(isWalk).reduce((s, e) => s + (e.duration_min || 0), 0);

  const todayWalks = todayEntries
    .filter(isWalk)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(e => ({ id: e.id, startTime: e.start_time || e.timestamp, endTime: e.end_time || null, durationMin: e.duration_min || null }));

  const dailyLabels = [], dailyWalks = [], dailyPipi = [], dailyCaca = [], dailyInside = [], dailyPropretScore = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now); day.setDate(day.getDate() - i); day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    const dayEntries = entries.filter(e => { const t = new Date(e.timestamp); return t >= day && t <= dayEnd; });
    dailyLabels.push(day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }));
    dailyWalks.push(dayEntries.filter(isWalk).length);
    const dayPipi = dayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi');
    const dayCaca = dayEntries.filter(e => e.type === 'bathroom' && e.action === 'caca');
    dailyPipi.push(dayPipi.length);
    dailyCaca.push(dayCaca.length);
    dailyInside.push(dayEntries.filter(e => e.location === 'inside').length);
    const dayBad = dayPipi.filter(e => e.location === 'inside').length + dayCaca.filter(e => e.location === 'inside').length;
    dailyPropretScore.push(dayPipi.length > 0 ? Math.max(0, Math.round(100 - (dayBad / dayPipi.length * 100))) : null);
  }

  const threeDaysAgo = new Date(now); threeDaysAgo.setDate(threeDaysAgo.getDate() - 2); threeDaysAgo.setHours(0, 0, 0, 0);
  const recentCacas = entries
    .filter(e => e.type === 'bathroom' && e.action === 'caca' && e.firmness !== undefined)
    .filter(e => new Date(e.timestamp) >= threeDaysAgo)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const todayStr       = now.toDateString();
  const firmnessLabels = recentCacas.map(e => {
    const d = new Date(e.timestamp);
    const s = d.toDateString() === todayStr ? 'Auj.' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    return s + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  });
  const firmnessData = recentCacas.map(e => e.firmness);

  return { total: entries.length, recent: recent.length, walkStarts: walkStarts.length, pipi: pipi.length, caca: caca.length,
    pipiDehors, pipiDedans, cacaDehors, cacaDedans, todayScore, todayWalks, todayPipiTotal, todayPipiDedans,
    todayWalkMinSince7am, dailyLabels, dailyWalks, dailyPipi, dailyCaca, dailyInside, dailyPropretScore, firmnessLabels, firmnessData };
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

$('exit-demo-btn').addEventListener('click', () => {
  showSetupScreen();
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

    // Bouton mode démo
    $('btn-demo').addEventListener('click', async () => {
      $('setup-overlay').style.display = 'none';
      await loadDemoDb();
      initDB(() => {
        const active = document.querySelector('.page.active');
        if (active?.id === 'page-stats')   renderStats();
        if (active?.id === 'page-history') renderHistory();
      });
      $('demo-banner').style.display = 'flex';
      setSyncState('ok');
      initNewEntry();
      showPage('new');
    });
    return;
  }

  // Charge db.js dynamiquement (échoue si config invalide)
  try {
    await loadDb();
  } catch {
    showSetupScreen();
    $('btn-demo').addEventListener('click', async () => {
      $('setup-overlay').style.display = 'none';
      await loadDemoDb();
      initDB(() => {
        const active = document.querySelector('.page.active');
        if (active?.id === 'page-stats')   renderStats();
        if (active?.id === 'page-history') renderHistory();
      });
      $('demo-banner').style.display = 'flex';
      setSyncState('ok');
      initNewEntry();
      showPage('new');
    });
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
