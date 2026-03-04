/**
 * ui-new-entry.js – Page de saisie d'une nouvelle entrée (balade ou pipi/caca).
 *
 * Gère le formulaire dynamique : sélecteurs de type/action/lieu, curseurs,
 * raccourcis temporels, et soumission vers la base de données.
 */

import { $, setActive, setVisible, buildSegment, toLocalISO, localNow, formatDuration, formatWalkTime } from './utils.js';
import { initGauge } from './ui-gauge.js';
import { showToast, setSyncState } from './toast.js';
import { db } from './db-context.js';

// ── État local ─────────────────────────────────────────────────────────────

let gaugeF = null; // jauge fermeté caca
let gaugeT = null; // jauge quantité pipi

let currentType     = 'walk';     // 'bathroom' | 'walk'
let currentAction   = 'pipi';     // 'pipi' | 'caca'
let currentLocation = 'outside';  // 'outside' | 'inside'
// walkAnchor détermine quel côté de la balade reste fixe quand on applique un preset de durée.
//   'start' → le départ est connu, on calcule end = start + durée  (ex: je pars maintenant)
//   'end'   → le retour est connu, on remonte start = end − durée  (ex: je viens de rentrer)
// L'ancre bascule automatiquement sur le champ <input> focalisé en dernier par l'utilisateur.
let walkAnchor = 'start';

// ── Initialisation ─────────────────────────────────────────────────────────

/**
 * Attache tous les event listeners de la page "Nouvelle entrée".
 * À appeler une seule fois depuis boot().
 */
export function initNewEntry() {
  // Sélecteur de type (balade / pipi-caca)
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      setActive('type', currentType);
      updateActionPanel();
    });
  });

  // Sélecteur d'action (pipi / caca) — délégation sur le panel
  $('action-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    currentAction = btn.dataset.action;
    setActive('action', currentAction);
    _updateSections();
  });

  // Sélecteur de lieu
  document.querySelectorAll('[data-loc]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLocation = btn.dataset.loc;
      setActive('loc', currentLocation);
    });
  });

  // Raccourcis temporels (pipi/caca uniquement)
  document.querySelector('.time-shortcuts').addEventListener('click', e => {
    const btn = e.target.closest('[data-offset]');
    if (!btn) return;
    const offsetMin = parseInt(btn.dataset.offset, 10);
    let t;
    if (offsetMin === 0) {
      t = new Date();
    } else {
      t = $('entry-time').value ? new Date($('entry-time').value) : new Date();
      t.setMinutes(t.getMinutes() + offsetMin);
    }
    t.setSeconds(0, 0);
    $('entry-time').value = toLocalISO(t);
    sessionStorage.setItem('lastEntryTime', $('entry-time').value);
  });

  // Persistance du temps saisi en session
  $('entry-time').addEventListener('change', () => {
    sessionStorage.setItem('lastEntryTime', $('entry-time').value);
  });
  $('walk-start').addEventListener('change', () => {
    sessionStorage.setItem('lastWalkStart', $('walk-start').value);
  });

  // Jauges (composant partagé)
  gaugeF = initGauge($('entry-firmness'), $('firmness-value'), 'caca');
  gaugeT = initGauge($('entry-taille'),   $('taille-value'),   'pipi');

  // Ancre de la balade : le champ focalisé en dernier est l'ancre fixe
  $('walk-start').addEventListener('focus', () => { walkAnchor = 'start'; _updateWalkAnchorUI(); });
  $('walk-end').addEventListener('focus',   () => { walkAnchor = 'end';   _updateWalkAnchorUI(); });

  // Mise à jour de l'affichage quand les horaires changent
  $('walk-start').addEventListener('change', () => {
    $('anchor-start-time').textContent = formatWalkTime($('walk-start').value);
    _updateWalkDurationDisplay();
  });
  $('walk-end').addEventListener('change', () => {
    $('anchor-end-time').textContent = formatWalkTime($('walk-end').value);
    _updateWalkDurationDisplay();
  });

  // Presets de durée : calcule le côté NON-ancre
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
    _updateWalkDurationDisplay();
  });

  // Bouton de soumission
  $('btn-add').addEventListener('click', _handleAdd);

  // Valeurs initiales
  _resetDefaults();

  updateActionPanel();
  setActive('type', currentType);
  setActive('loc',  currentLocation);
}

/**
 * Réinitialise le formulaire aux valeurs par défaut :
 * type = walk, dates = maintenant.
 * Appelé à l'init et à chaque navigation vers la page "Complet".
 */
export function resetNewEntryDefaults() {
  _resetDefaults();
  updateActionPanel();
  setActive('type', currentType);
  setActive('loc',  currentLocation);
}

function _resetDefaults() {
  currentType = 'walk';
  $('entry-time').value = localNow();
  $('walk-start').value = localNow();
  $('walk-end').value   = '';
  $('anchor-start-time').textContent = formatWalkTime($('walk-start').value);
  walkAnchor = 'start';
  _updateWalkDurationDisplay();
}

// ── Mise à jour dynamique du formulaire ────────────────────────────────────

/** Met à jour le panel d'action et les sections selon le type courant. */
export function updateActionPanel() {
  const panel      = $('action-panel');
  const actionCard = $('action-card');

  if (currentType === 'walk') {
    actionCard.style.display = 'none';
    currentAction = 'walk';
  } else {
    actionCard.style.display = 'block';
    panel.innerHTML = buildSegment('action', [
      { value: 'pipi', label: '💧 Pipi' },
      { value: 'caca', label: '💩 Caca' },
    ], currentAction);
    if (currentAction !== 'pipi' && currentAction !== 'caca') currentAction = 'pipi';
  }

  _updateSections();
}

/** Met à jour la visibilité de toutes les sections selon le type et l'action courants. */
function _updateSections() {
  const isBath = currentType === 'bathroom';
  setVisible('location-section', isBath);
  setVisible('firmness-section', isBath && currentAction === 'caca');
  setVisible('taille-section',   isBath && currentAction === 'pipi');
  setVisible('walk-section',     currentType === 'walk');
  setVisible('datetime-card',    currentType !== 'walk');
}

function _getWalkDurationMin() {
  const start = $('walk-start').value;
  const end   = $('walk-end').value;
  if (!start || !end) return 0;
  return Math.round((new Date(end) - new Date(start)) / 60000);
}

function _updateWalkAnchorUI() {
  $('anchor-start-btn').classList.toggle('active', walkAnchor === 'start');
  $('anchor-end-btn').classList.toggle('active',   walkAnchor === 'end');
}

function _updateWalkDurationDisplay() {
  const dur = _getWalkDurationMin();
  $('walk-duration-display').textContent = dur > 0 ? formatDuration(dur) : '—';
}

// ── Soumission ─────────────────────────────────────────────────────────────

async function _handleAdd() {
  const note = $('entry-note').value.trim();
  let entry;

  if (currentType === 'walk') {
    const startVal    = $('walk-start').value;
    const endVal      = $('walk-end').value;
    const durationMin = _getWalkDurationMin();
    if (!startVal || durationMin <= 0) {
      showToast('⚠️ Renseigne un début et une fin pour la balade');
      return;
    }
    entry = {
      type:         'walk',
      timestamp:    new Date(startVal).toISOString(),
      end_time:     endVal ? new Date(endVal).toISOString() : null,
      duration_min: durationMin,
      note,
    };
  } else {
    const timeVal = $('entry-time').value;
    const numVal  = currentAction === 'caca' ? gaugeF.getValue() : gaugeT.getValue();
    entry = {
      type:      currentAction,
      text_val:  currentLocation,
      num_val:   numVal,
      timestamp: timeVal ? new Date(timeVal).toISOString() : new Date().toISOString(),
      note,
    };
  }

  setSyncState('pending');
  try {
    await db.saveEntry(entry);
    setSyncState('ok');
  } catch {
    setSyncState('error');
  }
  showToast(entryLabel(entry) + ' enregistré ✓');

  // Réinitialise le formulaire sans toucher aux champs temporels
  $('walk-end').value   = '';
  $('entry-note').value = '';
  gaugeF.setValue(25); // Mou
  gaugeT.setValue(50); // Normal
  _updateWalkDurationDisplay();
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
}

// ── Utilitaire partagé ─────────────────────────────────────────────────────

/**
 * Retourne le libellé d'affichage d'une entrée (pour le toast et l'historique).
 *
 * @param {object} entry
 * @returns {string}
 */
export function entryLabel(entry) {
  if (entry.type === 'walk') {
    const dur = entry.duration_min ? ` (${formatDuration(entry.duration_min)})` : '';
    return `🐾 Balade${dur}`;
  }
  const actions = { pipi: 'Pipi', caca: 'Caca' };
  const locs    = { outside: 'dehors', inside: 'dedans' };
  let label = '🚽 ' + (actions[entry.type] || entry.type);
  if (entry.text_val) label += ' ' + (locs[entry.text_val] || '');
  return label;
}
