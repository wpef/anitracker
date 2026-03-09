/**
 * quick.js – Saisie rapide (page standalone pour raccourci Android)
 */

import { initGauge } from './ui-gauge.js';
import { getTypeDef } from './utils.js';

// ── État local ─────────────────────────────────────────────────────────────
// Nommage aligné avec ui-new-entry.js. Note : ne pas nommer la variable 'location'
// (conflit avec window.location dans certains navigateurs).
let currentAction   = 'pipi';    // 'pipi' | 'caca'
let currentLocation = 'outside'; // 'outside' | 'inside'

// ── Elements ───────────────────────────────────────────────────────────────
const btnPipi     = document.getElementById('btn-pipi');
const btnCaca     = document.getElementById('btn-caca');
const btnDehors   = document.getElementById('btn-dehors');
const btnDedans   = document.getElementById('btn-dedans');
const gaugeInput  = document.getElementById('quick-gauge');
const gaugeVal    = document.getElementById('gauge-val');
const gaugeLabel  = document.getElementById('gauge-label');
const gaugeEndL   = document.getElementById('gauge-end-left');
const gaugeEndR   = document.getElementById('gauge-end-right');
const btnSave     = document.getElementById('btn-save');
const errorBanner = document.getElementById('error-banner');
const timeInput   = document.getElementById('time-gauge');
const timeVal     = document.getElementById('time-val');

// ── Composant jauge (partagé avec l'app principale) ────────────────────────
const gauge = initGauge(gaugeInput, gaugeVal, 'pipi');

// ── Time scrubber ───────────────────────────────────────────────────────────
function updateTimeGauge() {
  const steps = parseInt(timeInput.value, 10); // 30 = maintenant, 0 = −30 min
  const pct   = (steps / 30) * 100;
  timeInput.style.background =
    `linear-gradient(to right, #4cc9f0 ${pct}%, rgba(255,255,255,.1) ${pct}%)`;
  timeVal.textContent = steps === 30 ? 'Maintenant' : `il y a ${30 - steps} min`;
}

timeInput.addEventListener('input', updateTimeGauge);

// ── Mise à jour apparence de la jauge lors du changement de type ───────────
function setupGauge() {
  const cfg = getTypeDef()[currentAction].gauge;
  gaugeEndL.textContent  = cfg.ends[0];
  gaugeEndR.textContent  = cfg.ends[1];
  gaugeLabel.textContent = getTypeDef()[currentAction].icon + ' ' + cfg.title;
  gaugeInput.className   = currentAction === 'pipi' ? 'taille' : 'fermete';
  gauge.setType(currentAction);
}

// ── Action buttons ─────────────────────────────────────────────────────────
btnPipi.addEventListener('click', () => {
  currentAction = 'pipi';
  btnPipi.className = 'btn-toggle active-pipi';
  btnCaca.className = 'btn-toggle';
  gauge.setValue(50); // Normal
  setupGauge();
});

btnCaca.addEventListener('click', () => {
  currentAction = 'caca';
  btnCaca.className = 'btn-toggle active-caca';
  btnPipi.className = 'btn-toggle';
  gauge.setValue(25); // Mou
  setupGauge();
});

// ── Location buttons ───────────────────────────────────────────────────────
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

  const entry = {
    type:      currentAction,
    text_val:  currentLocation,
    num_val:   gauge.getValue(),
    timestamp: new Date(Date.now() - (30 - parseInt(timeInput.value, 10)) * 60_000).toISOString(),
  };

  try {
    await saveEntryFn(entry);

    const orig = btnSave.textContent;
    btnSave.classList.add('success');
    btnSave.textContent = '✓ Enregistré !';

    setTimeout(() => {
      btnSave.classList.remove('success');
      btnSave.textContent = orig;
      btnSave.disabled = false;
      // Reset aux défauts
      currentAction   = 'pipi';
      currentLocation = 'outside';
      btnPipi.className   = 'btn-toggle active-pipi';
      btnCaca.className   = 'btn-toggle';
      btnDehors.className = 'btn-toggle active-dehors';
      btnDedans.className = 'btn-toggle';
      gauge.setValue(50); // Normal
      setupGauge();
      timeInput.value = 30;
      updateTimeGauge();
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
setupGauge();
updateTimeGauge();
initFirebase();
