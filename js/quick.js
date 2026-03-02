/**
 * quick.js – Saisie rapide (page standalone pour raccourci Android)
 */

import { initGauge } from './ui-gauge.js';
import { TYPE_DEF } from './utils.js';

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

// ── Composant jauge (partagé avec l'app principale) ────────────────────────
const gauge = initGauge(gaugeInput, gaugeVal, 'pipi');

// ── Mise à jour apparence de la jauge lors du changement de type ───────────
function setupGauge() {
  const cfg = TYPE_DEF[currentAction].gauge;
  gaugeEndL.textContent  = cfg.ends[0];
  gaugeEndR.textContent  = cfg.ends[1];
  gaugeLabel.textContent = TYPE_DEF[currentAction].icon + ' ' + cfg.title;
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
    timestamp: new Date().toISOString(),
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
initFirebase();
