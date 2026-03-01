/**
 * quick.js – Saisie rapide (page standalone pour raccourci Android)
 */

// ── Paliers (cohérents avec app.js) ────────────────────────────────────────
const TAILLE_LABELS   = ['Gouttes', 'Petit', 'Normal', 'Gros', 'Énorme'];  // index 0-4
const FIRMNESS_LABELS = ['Liquide', 'Mou', 'Ferme', 'Dur'];                // index 0-3

// ── State ──────────────────────────────────────────────────────────────────
let action   = 'pipi';     // 'pipi' | 'caca'
let location = 'outside';  // 'outside' | 'inside'  ← valeurs Firebase (pas FR)

// ── Elements ───────────────────────────────────────────────────────────────
const btnPipi     = document.getElementById('btn-pipi');
const btnCaca     = document.getElementById('btn-caca');
const btnDehors   = document.getElementById('btn-dehors');
const btnDedans   = document.getElementById('btn-dedans');
const gauge       = document.getElementById('quick-gauge');
const gaugeVal    = document.getElementById('gauge-val');
const gaugeLabel  = document.getElementById('gauge-label');
const gaugeEndL   = document.getElementById('gauge-end-left');
const gaugeEndR   = document.getElementById('gauge-end-right');
const btnSave     = document.getElementById('btn-save');
const errorBanner = document.getElementById('error-banner');

// ── Gauge update ───────────────────────────────────────────────────────────
function updateGauge() {
  if (action === 'pipi') {
    gauge.min = 0; gauge.max = 4; gauge.step = 1;
    gauge.className          = 'taille';
    gaugeLabel.textContent   = '💧 Quantité';
    gaugeEndL.textContent    = 'Gouttes';
    gaugeEndR.textContent    = 'Énorme';
    gaugeVal.textContent     = TAILLE_LABELS[+gauge.value] || '';
  } else {
    gauge.min = 0; gauge.max = 3; gauge.step = 1;
    gauge.className          = 'fermete';
    gaugeLabel.textContent   = '💩 Fermeté';
    gaugeEndL.textContent    = 'Liquide';
    gaugeEndR.textContent    = 'Dur';
    gaugeVal.textContent     = FIRMNESS_LABELS[+gauge.value] || '';
  }
}

gauge.addEventListener('input', updateGauge);

// ── Action buttons ─────────────────────────────────────────────────────────
btnPipi.addEventListener('click', () => {
  action = 'pipi';
  btnPipi.className = 'btn-toggle active-pipi';
  btnCaca.className = 'btn-toggle';
  gauge.value = 2; // Normal
  updateGauge();
});

btnCaca.addEventListener('click', () => {
  action = 'caca';
  btnCaca.className = 'btn-toggle active-caca';
  btnPipi.className = 'btn-toggle';
  gauge.value = 1; // Mou
  updateGauge();
});

// ── Location buttons ───────────────────────────────────────────────────────
btnDehors.addEventListener('click', () => {
  location = 'outside';                            // ← 'outside', pas 'dehors'
  btnDehors.className = 'btn-toggle active-dehors';
  btnDedans.className = 'btn-toggle';
});

btnDedans.addEventListener('click', () => {
  location = 'inside';                             // ← 'inside', pas 'dedans'
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
    type:      'bathroom',   // ← champ manquant dans l'ancienne version
    action,
    location,                // 'outside' | 'inside'
    timestamp: new Date().toISOString(),
  };

  if (action === 'pipi') {
    entry.taille   = parseInt(gauge.value, 10);  // index 0-4
  } else {
    entry.firmness = parseInt(gauge.value, 10);  // index 0-3
  }

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
      action   = 'pipi';
      location = 'outside';
      btnPipi.className   = 'btn-toggle active-pipi';
      btnCaca.className   = 'btn-toggle';
      btnDehors.className = 'btn-toggle active-dehors';
      btnDedans.className = 'btn-toggle';
      gauge.value = 2; // Normal
      updateGauge();
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
updateGauge();
initFirebase();
