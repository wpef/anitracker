/**
 * ui-quick.js – Page "Rapide" intégrée dans l'app principale.
 *
 * Logique identique à quick.js mais utilise db depuis db-context.js
 * et des IDs préfixés `qp-` pour éviter les conflits avec page-new.
 */

import { initGauge } from './ui-gauge.js';
import { TYPE_DEF } from './utils.js';
import { db } from './db-context.js';

// ── État local ──────────────────────────────────────────────────────────────
let currentAction   = 'pipi';    // 'pipi' | 'caca'
let currentLocation = 'outside'; // 'outside' | 'inside'

// ── Elements ────────────────────────────────────────────────────────────────
const btnPipi    = document.getElementById('qp-pipi');
const btnCaca    = document.getElementById('qp-caca');
const btnDehors  = document.getElementById('qp-dehors');
const btnDedans  = document.getElementById('qp-dedans');
const gaugeInput = document.getElementById('qp-gauge');
const gaugeValEl = document.getElementById('qp-gauge-val');
const gaugeLabel = document.getElementById('qp-gauge-label');
const gaugeEndL  = document.getElementById('qp-gauge-end-left');
const gaugeEndR  = document.getElementById('qp-gauge-end-right');
const timeInput  = document.getElementById('qp-time-gauge');
const timeValEl  = document.getElementById('qp-time-val');
const btnSave    = document.getElementById('qp-save');

// ── Composant jauge ─────────────────────────────────────────────────────────
const gauge = initGauge(gaugeInput, gaugeValEl, 'pipi');

// ── Time scrubber ───────────────────────────────────────────────────────────
function updateTimeGauge() {
  const steps = parseInt(timeInput.value, 10); // 30 = maintenant, 0 = −30 min
  const pct   = (steps / 30) * 100;
  timeInput.style.background =
    `linear-gradient(to right, #4cc9f0 ${pct}%, rgba(255,255,255,.1) ${pct}%)`;
  timeValEl.textContent = steps === 30 ? 'Maintenant' : `il y a ${30 - steps} min`;
}

// ── Jauge action ────────────────────────────────────────────────────────────
function setupGauge() {
  const cfg = TYPE_DEF[currentAction].gauge;
  gaugeEndL.textContent  = cfg.ends[0];
  gaugeEndR.textContent  = cfg.ends[1];
  gaugeLabel.textContent = TYPE_DEF[currentAction].icon + ' ' + cfg.title;
  gauge.setType(currentAction);
}

// ── Reset après enregistrement ──────────────────────────────────────────────
function reset() {
  currentAction   = 'pipi';
  currentLocation = 'outside';
  btnPipi.className   = 'btn-toggle active-pipi';
  btnCaca.className   = 'btn-toggle';
  btnDehors.className = 'btn-toggle active-dehors';
  btnDedans.className = 'btn-toggle';
  gauge.setValue(50);
  setupGauge();
  timeInput.value = 30;
  updateTimeGauge();
}

// ── Listeners ────────────────────────────────────────────────────────────────
btnPipi.addEventListener('click', () => {
  currentAction = 'pipi';
  btnPipi.className = 'btn-toggle active-pipi';
  btnCaca.className = 'btn-toggle';
  gauge.setValue(50);
  setupGauge();
});

btnCaca.addEventListener('click', () => {
  currentAction = 'caca';
  btnCaca.className = 'btn-toggle active-caca';
  btnPipi.className = 'btn-toggle';
  gauge.setValue(25);
  setupGauge();
});

btnDehors.addEventListener('click', () => {
  currentLocation = 'outside';
  btnDehors.className = 'btn-toggle active-dehors';
  btnDedans.className = 'btn-toggle';
});

btnDedans.addEventListener('click', () => {
  currentLocation = 'inside';
  btnDedans.className = 'btn-toggle active-dedans';
  btnDehors.className = 'btn-toggle';
});

timeInput.addEventListener('input', updateTimeGauge);

btnSave.addEventListener('click', async () => {
  if (!db.saveEntry || btnSave.disabled) return;

  btnSave.disabled = true;

  const entry = {
    type:      currentAction,
    text_val:  currentLocation,
    num_val:   gauge.getValue(),
    timestamp: new Date(Date.now() - (30 - parseInt(timeInput.value, 10)) * 60_000).toISOString(),
  };

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
  setupGauge();
  updateTimeGauge();
}
