/**
 * ui-new-entry.js – Page de saisie d'une nouvelle entrée.
 *
 * Entièrement piloté par TYPE_DEF : les types, jauges, options textuelles
 * et sections sont générés dynamiquement. Pour ajouter un nouveau type,
 * il suffit d'ajouter une entrée dans TYPE_DEF (utils.js).
 */

import { $, setActive, setVisible, buildSegment, toLocalISO, localNow,
         formatDuration, formatWalkTime, formatDateTimeFriendly,
         getTypeDef, allTypes, getTextLabel, validateEntry } from './utils.js';
import { initGauge } from './ui-gauge.js';
import { showToast, setSyncState } from './toast.js';
import { db } from './db-context.js';
import { canUseType } from './permissions.js';
import { showPremiumCTA } from './ui-premium.js';

// ── État local ─────────────────────────────────────────────────────────────

let gauge = null;       // jauge unique (re-configurée selon le type courant)
let currentType     = null;   // clé TYPE_DEF courante (ex: 'walk', 'pipi', 'caca')
let currentTextVal  = null;   // text_val courant (ex: 'outside')
let walkAnchor      = 'start';

// ── Initialisation ─────────────────────────────────────────────────────────

/**
 * Attache tous les event listeners de la page "Nouvelle entrée".
 * À appeler une seule fois depuis boot().
 */
export function initNewEntry() {
  // Générer les boutons de type depuis TYPE_DEF
  _buildTypeSelector();

  // Délégation click sur le sélecteur de type
  $('type-selector').addEventListener('click', e => {
    // "+" button to add custom type
    if (e.target.closest('#btn-add-type')) {
      import('./ui-custom-type.js').then(m => m.openCustomTypePage());
      return;
    }
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    if (btn.classList.contains('locked')) {
      showPremiumCTA('Passez en Premium pour débloquer ce type');
      return;
    }
    _selectType(btn.dataset.type);
  });

  // Délégation click sur les options textuelles (lieu, etc.)
  $('text-options-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-loc]');
    if (!btn) return;
    currentTextVal = btn.dataset.loc;
    setActive('loc', currentTextVal);
    _applyTextOptionColors(getTypeDef()[currentType]);
  });

  // Raccourcis temporels
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
    _updateFriendlyDate();
  });

  // Click on datetime row opens native picker
  document.querySelector('#datetime-card .datetime-row').addEventListener('click', () => {
    const input = $('entry-time');
    if (input.showPicker) input.showPicker();
    else input.focus();
  });

  // Persistance du temps saisi en session
  $('entry-time').addEventListener('change', () => {
    sessionStorage.setItem('lastEntryTime', $('entry-time').value);
    _updateFriendlyDate();
  });
  $('walk-start').addEventListener('change', () => {
    sessionStorage.setItem('lastWalkStart', $('walk-start').value);
  });

  // Jauge unique
  gauge = initGauge($('entry-gauge'), $('gauge-value'), 'pipi');

  // Ancre de la balade
  $('walk-start').addEventListener('focus', () => { walkAnchor = 'start'; _updateWalkAnchorUI(); });
  $('walk-end').addEventListener('focus',   () => { walkAnchor = 'end';   _updateWalkAnchorUI(); });

  $('walk-start').addEventListener('change', () => {
    $('anchor-start-time').textContent = formatWalkTime($('walk-start').value);
    _updateWalkDurationDisplay();
  });
  $('walk-end').addEventListener('change', () => {
    $('anchor-end-time').textContent = formatWalkTime($('walk-end').value);
    _updateWalkDurationDisplay();
  });

  // Presets de durée
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

  // Sélectionner le premier type (walk par défaut, ou le premier de la liste)
  const firstType = allTypes()[0]?.[0] || 'walk';
  _selectType(firstType);
  _resetDefaults();
}

// ── Construction dynamique ──────────────────────────────────────────────────

function _buildTypeSelector() {
  const container = $('type-selector');
  container.innerHTML = allTypes().map(([key, def]) => {
    const locked = !canUseType(key);
    return `<button class="seg-btn${locked ? ' locked' : ''}" data-type="${key}">${def.icon} ${def.label}${locked ? ' \uD83D\uDD12' : ''}</button>`;
  }).join('') + '<button class="seg-btn seg-btn-add" id="btn-add-type">+</button>';
}

function _selectType(type) {
  const def = getTypeDef()[type];
  if (!def) return;
  currentType = type;
  setActive('type', currentType);
  // Inject inline background color for the active type button (generic fallback)
  $('type-selector').querySelectorAll('[data-type]').forEach(btn => {
    btn.style.backgroundColor = btn.dataset.type === type && def.color ? def.color : '';
  });

  // Jauge
  if (def.gauge) {
    setVisible('gauge-section', true);
    $('gauge-title').textContent = def.icon + ' ' + def.gauge.title;
    $('gauge-end-left').textContent  = def.gauge.ends[0];
    $('gauge-end-right').textContent = def.gauge.ends[1];
    gauge.setConfig(def.gauge);
    gauge.setValue(def.gauge.def);
  } else {
    setVisible('gauge-section', false);
  }

  // Options textuelles (lieu, etc.)
  if (def.textOptions && def.textOptions.length > 0) {
    setVisible('text-options-section', true);
    $('text-options-title').textContent = def.textTitle || 'Options';
    currentTextVal = def.defaultTextVal || def.textOptions[0].value;
    $('text-options-panel').innerHTML = buildSegment('loc',
      def.textOptions.map(o => ({ value: o.value, label: (o.icon || '') + ' ' + o.label })),
      currentTextVal
    );
    _applyTextOptionColors(def);
  } else {
    setVisible('text-options-section', false);
    currentTextVal = null;
  }

  // Sections durée vs datetime ponctuel
  setVisible('walk-section',  !!def.hasDuration);
  setVisible('datetime-card', !def.hasDuration);
  if (def.hasDuration) {
    $('walk-section-title').textContent = `⏱ ${def.label}`;
  }
}

// ── Couleurs dynamiques des options textuelles ──────────────────────────────

function _applyTextOptionColors(def) {
  if (!def?.textOptions?.length) return;
  $('text-options-panel').querySelectorAll('[data-loc]').forEach(btn => {
    const opt = def.textOptions.find(o => o.value === btn.dataset.loc);
    const isActive = btn.classList.contains('active');
    if (isActive && opt?.color) {
      btn.style.backgroundColor = opt.color;
      btn.style.color = '#fff';
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = '';
    }
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _updateFriendlyDate() {
  const el = $('entry-time-friendly');
  if (el) el.textContent = formatDateTimeFriendly($('entry-time').value);
}

function _resetDefaults() {
  const firstType = allTypes()[0]?.[0] || 'walk';
  _selectType(firstType);
  $('entry-time').value = localNow();
  _updateFriendlyDate();
  $('walk-start').value = localNow();
  $('walk-end').value   = '';
  $('anchor-start-time').textContent = formatWalkTime($('walk-start').value);
  walkAnchor = 'start';
  _updateWalkDurationDisplay();
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
  const btn = $('btn-add');
  if (btn.disabled) return;
  btn.disabled = true;

  const def  = getTypeDef()[currentType];
  const note = $('entry-note').value.trim();
  let entry;

  if (def?.hasDuration) {
    const startVal    = $('walk-start').value;
    const endVal      = $('walk-end').value;
    const durationMin = _getWalkDurationMin();
    if (!startVal || durationMin <= 0) {
      showToast('⚠️ Renseigne un début et une fin');
      btn.disabled = false;
      return;
    }
    entry = {
      type:         currentType,
      timestamp:    new Date(startVal).toISOString(),
      end_time:     endVal ? new Date(endVal).toISOString() : null,
      duration_min: durationMin,
      note,
    };
  } else {
    const timeVal = $('entry-time').value;
    entry = {
      type:      currentType,
      timestamp: timeVal ? new Date(timeVal).toISOString() : new Date().toISOString(),
      note,
    };
    if (currentTextVal !== null) entry.text_val = currentTextVal;
    if (def?.gauge)              entry.num_val  = gauge.getValue();
  }

  const error = validateEntry(entry, def);
  if (error) {
    showToast(error);
    btn.disabled = false;
    return;
  }

  setSyncState('pending');
  try {
    await db.saveEntry(entry);
    setSyncState('ok');
    showToast(entryLabel(entry) + ' enregistré ✓');
  } catch {
    // Retry once after 2s
    try {
      await new Promise(r => setTimeout(r, 2000));
      await db.saveEntry(entry);
      showToast('Enregistré (2e tentative)');
      setSyncState('ok');
    } catch {
      showToast('Échec de sauvegarde — vérifiez votre connexion');
      setSyncState('error');
    }
  } finally {
    btn.disabled = false;
  }

  // Réinitialise le formulaire
  $('walk-end').value   = '';
  $('entry-note').value = '';
  if (def?.gauge) gauge.setValue(def.gauge.def);
  _updateWalkDurationDisplay();
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
}

// ── Utilitaire partagé ─────────────────────────────────────────────────────

/**
 * Retourne le libellé d'affichage d'une entrée (pour le toast et l'historique).
 * Entièrement piloté par TYPE_DEF.
 */
export function entryLabel(entry) {
  const def = getTypeDef()[entry.type];
  if (!def) return entry.type || '?';

  if (def.hasDuration) {
    const dur = entry.duration_min ? ` (${formatDuration(entry.duration_min)})` : '';
    return `${def.icon} ${def.label}${dur}`;
  }

  let label = `${def.icon} ${def.label}`;
  if (entry.text_val) {
    const textLabel = getTextLabel(entry.type, entry.text_val);
    if (textLabel) label += ' ' + textLabel.toLowerCase();
  }
  return label;
}
