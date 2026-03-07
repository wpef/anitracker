/**
 * ui-quick.js – Page "Rapide" intégrée dans l'app principale.
 *
 * Entièrement piloté par TYPE_DEF : les boutons d'action (types sans durée),
 * les options textuelles et la jauge sont générés dynamiquement.
 */

import { initGauge } from './ui-gauge.js';
import { TYPE_DEF, allTypes } from './utils.js';
import { db } from './db-context.js';

// ── État local ──────────────────────────────────────────────────────────────
let currentAction   = null;
let currentTextVal  = null;

// ── Elements ────────────────────────────────────────────────────────────────
const actionRow    = document.getElementById('qp-action-row');
const textRow      = document.getElementById('qp-text-row');
const gaugeSection = document.getElementById('qp-gauge-section');
const gaugeInput   = document.getElementById('qp-gauge');
const gaugeValEl   = document.getElementById('qp-gauge-val');
const gaugeLabel   = document.getElementById('qp-gauge-label');
const gaugeEndL    = document.getElementById('qp-gauge-end-left');
const gaugeEndR    = document.getElementById('qp-gauge-end-right');
const timeInput    = document.getElementById('qp-time-gauge');
const timeValEl    = document.getElementById('qp-time-val');
const btnSave      = document.getElementById('qp-save');

// ── Composant jauge ─────────────────────────────────────────────────────────
const gauge = initGauge(gaugeInput, gaugeValEl, 'pipi');

// ── Types éligibles à la page rapide (sans durée) ──────────────────────────
function quickTypes() {
  return allTypes().filter(([, def]) => !def.hasDuration);
}

// ── Génération dynamique des boutons ────────────────────────────────────────

function _buildActionButtons() {
  const types = quickTypes();
  actionRow.innerHTML = types.map(([key, def]) =>
    `<button class="btn-toggle" data-qp-action="${key}">
      <span class="qp-emoji">${def.icon}</span>${def.label.toUpperCase()}
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
    `<button class="btn-toggle" data-qp-text="${o.value}">
      <span class="qp-emoji">${o.icon || ''}</span>${o.label.toUpperCase()}
    </button>`
  ).join('');
  _highlightTextButton();
}

function _highlightActionButton() {
  actionRow.querySelectorAll('[data-qp-action]').forEach(btn => {
    const key = btn.dataset.qpAction;
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
  textRow.querySelectorAll('[data-qp-text]').forEach(btn => {
    const val = btn.dataset.qpText;
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

function _alpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Time scrubber ───────────────────────────────────────────────────────────
function updateTimeGauge() {
  const steps = parseInt(timeInput.value, 10);
  const pct   = (steps / 30) * 100;
  timeInput.style.background =
    `linear-gradient(to right, #4cc9f0 ${pct}%, rgba(255,255,255,.1) ${pct}%)`;
  timeValEl.textContent = steps === 30 ? 'Maintenant' : `il y a ${30 - steps} min`;
}

// ── Jauge action ────────────────────────────────────────────────────────────
function setupGauge() {
  const def = TYPE_DEF[currentAction];
  if (!def?.gauge) {
    gaugeSection.style.display = 'none';
    return;
  }
  gaugeSection.style.display = '';
  const cfg = def.gauge;
  gaugeEndL.textContent  = cfg.ends[0];
  gaugeEndR.textContent  = cfg.ends[1];
  gaugeLabel.textContent = def.icon + ' ' + cfg.title;
  gauge.setType(currentAction);
}

// ── Reset après enregistrement ──────────────────────────────────────────────
function reset() {
  const types = quickTypes();
  currentAction = types[0]?.[0] || 'pipi';
  const def = TYPE_DEF[currentAction];
  currentTextVal = def?.defaultTextVal || def?.textOptions?.[0]?.value || null;
  _highlightActionButton();
  _buildTextButtons();
  gauge.setValue(def?.gauge?.def ?? 50);
  setupGauge();
  timeInput.value = 30;
  updateTimeGauge();
}

// ── Listeners ────────────────────────────────────────────────────────────────
actionRow.addEventListener('click', e => {
  const btn = e.target.closest('[data-qp-action]');
  if (!btn) return;
  currentAction = btn.dataset.qpAction;
  const def = TYPE_DEF[currentAction];
  _highlightActionButton();
  _buildTextButtons();
  gauge.setValue(def?.gauge?.def ?? 50);
  setupGauge();
});

textRow.addEventListener('click', e => {
  const btn = e.target.closest('[data-qp-text]');
  if (!btn) return;
  currentTextVal = btn.dataset.qpText;
  _highlightTextButton();
});

timeInput.addEventListener('input', updateTimeGauge);

btnSave.addEventListener('click', async () => {
  if (!db.saveEntry || btnSave.disabled) return;

  btnSave.disabled = true;

  const def   = TYPE_DEF[currentAction];
  const entry = {
    type:      currentAction,
    timestamp: new Date(Date.now() - (30 - parseInt(timeInput.value, 10)) * 60_000).toISOString(),
  };
  if (currentTextVal !== null) entry.text_val = currentTextVal;
  if (def?.gauge)              entry.num_val  = gauge.getValue();

  try {
    await db.saveEntry(entry);
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

// ── Export ───────────────────────────────────────────────────────────────────
export function initQuick() {
  _buildActionButtons();
  const types = quickTypes();
  currentAction = types[0]?.[0] || 'pipi';
  _highlightActionButton();
  _buildTextButtons();
  setupGauge();
  updateTimeGauge();
}
