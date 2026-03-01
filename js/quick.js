/**
 * quick.js – Saisie rapide (page standalone pour raccourci Android)
 */

import { initGauge, GAUGE_CONFIG } from './ui-gauge.js';

// ── State ──────────────────────────────────────────────────────────────────
// NOTE: on n'utilise pas 'location' (conflits avec window.location dans certains navigateurs)
let selectedAction   = 'pipi';    // 'pipi' | 'caca'
let selectedLocation = 'outside'; // 'outside' | 'inside'  ← valeurs Firebase

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
  const cfg = GAUGE_CONFIG[selectedAction];
  gaugeEndL.textContent  = cfg.ends[0];
  gaugeEndR.textContent  = cfg.ends[1];
  gaugeLabel.textContent = selectedAction === 'pipi' ? '💧 ' + cfg.title : '💩 ' + cfg.title;
  gaugeInput.className   = selectedAction === 'pipi' ? 'taille' : 'fermete';
  gauge.setType(selectedAction);
}

// ── Action buttons ─────────────────────────────────────────────────────────
btnPipi.addEventListener('click', () => {
  selectedAction = 'pipi';
  btnPipi.className = 'btn-toggle active-pipi';
  btnCaca.className = 'btn-toggle';
  gauge.setValue(50); // Normal
  setupGauge();
});

btnCaca.addEventListener('click', () => {
  selectedAction = 'caca';
  btnCaca.className = 'btn-toggle active-caca';
  btnPipi.className = 'btn-toggle';
  gauge.setValue(25); // Mou
  setupGauge();
});

// ── Location buttons ───────────────────────────────────────────────────────
btnDehors.addEventListener('click', () => {
  selectedLocation = 'outside';
  btnDehors.className = 'btn-toggle active-dehors';
  btnDedans.className = 'btn-toggle';
});

btnDedans.addEventListener('click', () => {
  selectedLocation = 'inside';
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
    type:      selectedAction,
    text_val:  selectedLocation,
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
      selectedAction   = 'pipi';
      selectedLocation = 'outside';
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
