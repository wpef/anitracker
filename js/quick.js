/**
 * quick.js – Saisie rapide (page standalone pour raccourci Android)
 *
 * Entièrement piloté par TYPE_DEF (needTypes) — même logique que ui-quick.js.
 * Pour ajouter un nouveau type besoin : une entrée dans TYPE_DEF, rien ici.
 */

import { initGauge } from './ui-gauge.js';
import { TYPE_DEF, needTypes } from './utils.js';

// ── État local ─────────────────────────────────────────────────────────────
let currentAction  = null;
let currentTextVal = null;

// ── Elements ───────────────────────────────────────────────────────────────
const actionRow   = document.getElementById('row-action');
const textRow     = document.getElementById('row-text');
const gaugeInput  = document.getElementById('quick-gauge');
const gaugeVal    = document.getElementById('gauge-val');
const gaugeLabel  = document.getElementById('gauge-label');
const gaugeEndL   = document.getElementById('gauge-end-left');
const gaugeEndR   = document.getElementById('gauge-end-right');
const btnSave     = document.getElementById('btn-save');
const errorBanner = document.getElementById('error-banner');
const timeInput   = document.getElementById('time-gauge');
const timeVal     = document.getElementById('time-val');

// ── Composant jauge ────────────────────────────────────────────────────────
const gauge = initGauge(gaugeInput, gaugeVal, 'pipi');

// ── Helpers ────────────────────────────────────────────────────────────────
function _alpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Génération dynamique des boutons ───────────────────────────────────────
function _buildActionButtons() {
  actionRow.innerHTML = needTypes().map(([key, def]) =>
    `<button class="btn-toggle" data-action="${key}">
      <span class="emoji">${def.icon}</span>${def.label.toUpperCase()}
    </button>`
  ).join('');
}

function _buildTextButtons() {
  const def = TYPE_DEF[currentAction];
  if (!def?.textOptions?.length) {
    textRow.style.display = 'none';
    return;
  }
  textRow.style.display = '';
  currentTextVal = def.defaultTextVal || def.textOptions[0].value;
  textRow.innerHTML = def.textOptions.map(o =>
    `<button class="btn-toggle" data-text="${o.value}">
      <span class="emoji">${o.icon || ''}</span>${o.label.toUpperCase()}
    </button>`
  ).join('');
  _highlightTextButton();
}

function _highlightActionButton() {
  actionRow.querySelectorAll('[data-action]').forEach(btn => {
    const key = btn.dataset.action;
    const def = TYPE_DEF[key];
    if (key === currentAction) {
      btn.style.borderColor = def.color;
      btn.style.color       = def.color;
      btn.style.background  = _alpha(def.color, 0.18);
    } else {
      btn.style.borderColor = '';
      btn.style.color       = '';
      btn.style.background  = '';
    }
  });
}

function _highlightTextButton() {
  const def = TYPE_DEF[currentAction];
  textRow.querySelectorAll('[data-text]').forEach(btn => {
    const val = btn.dataset.text;
    if (val === currentTextVal) {
      const opt = def?.textOptions?.find(o => o.value === val);
      const color = opt?.color || '#4caf50';
      btn.style.borderColor = color;
      btn.style.color       = color;
      btn.style.background  = _alpha(color, 0.18);
    } else {
      btn.style.borderColor = '';
      btn.style.color       = '';
      btn.style.background  = '';
    }
  });
}

// ── Jauge ──────────────────────────────────────────────────────────────────
function setupGauge() {
  const def = TYPE_DEF[currentAction];
  const cfg = def?.gauge;
  if (!cfg) return;
  gaugeEndL.textContent  = cfg.ends[0];
  gaugeEndR.textContent  = cfg.ends[1];
  gaugeLabel.textContent = def.icon + ' ' + cfg.title;
  gauge.setType(currentAction);
}

// ── Time scrubber ───────────────────────────────────────────────────────────
function updateTimeGauge() {
  const steps = parseInt(timeInput.value, 10);
  const pct   = (steps / 30) * 100;
  timeInput.style.background =
    `linear-gradient(to right, #4cc9f0 ${pct}%, rgba(255,255,255,.1) ${pct}%)`;
  timeVal.textContent = steps === 30 ? 'Maintenant' : `il y a ${30 - steps} min`;
}

// ── Reset après enregistrement ─────────────────────────────────────────────
function reset() {
  const types = needTypes();
  currentAction = types[0]?.[0] || 'pipi';
  _highlightActionButton();
  _buildTextButtons();
  const def = TYPE_DEF[currentAction];
  gauge.setValue(def?.gauge?.def ?? 50);
  setupGauge();
  timeInput.value = 30;
  updateTimeGauge();
}

// ── Listeners ──────────────────────────────────────────────────────────────
actionRow.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  currentAction = btn.dataset.action;
  _highlightActionButton();
  _buildTextButtons();
  const def = TYPE_DEF[currentAction];
  gauge.setValue(def?.gauge?.def ?? 50);
  setupGauge();
});

textRow.addEventListener('click', e => {
  const btn = e.target.closest('[data-text]');
  if (!btn) return;
  currentTextVal = btn.dataset.text;
  _highlightTextButton();
});

timeInput.addEventListener('input', updateTimeGauge);

// ── Firebase init ──────────────────────────────────────────────────────────
let saveEntryFn = null;

async function initFirebase() {
  try {
    const { getFirebaseConfig } = await import('./firebase-config.js');
    const config = getFirebaseConfig();
    if (!config) throw new Error('not configured');
    const { saveEntry } = await import('./db.js');
    saveEntryFn = saveEntry;
  } catch {
    errorBanner.style.display = 'block';
    btnSave.disabled = true;
  }
}

// ── Save ───────────────────────────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  if (!saveEntryFn || btnSave.disabled) return;

  btnSave.disabled = true;

  const def   = TYPE_DEF[currentAction];
  const entry = {
    type:      currentAction,
    timestamp: new Date(Date.now() - (30 - parseInt(timeInput.value, 10)) * 60_000).toISOString(),
  };
  if (currentTextVal !== null) entry.text_val = currentTextVal;
  if (def?.gauge)              entry.num_val  = gauge.getValue();

  try {
    await saveEntryFn(entry);

    const orig = btnSave.textContent;
    btnSave.classList.add('success');
    btnSave.textContent = '✓ Enregistré !';

    setTimeout(() => {
      btnSave.classList.remove('success');
      btnSave.textContent = orig;
      btnSave.disabled = false;
      reset();
    }, 1200);
  } catch {
    btnSave.textContent = '✗ Erreur';
    setTimeout(() => {
      btnSave.textContent = 'Enregistrer ✓';
      btnSave.disabled = false;
    }, 2000);
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────
_buildActionButtons();
currentAction = needTypes()[0]?.[0] || 'pipi';
_highlightActionButton();
_buildTextButtons();
setupGauge();
updateTimeGauge();
initFirebase();
