/**
 * quick.js – Saisie rapide (page standalone pour raccourci Android)
 */

// ── Paliers (cohérents avec app.js) ────────────────────────────────────────
const TAILLE_LABELS   = ['Gouttes', 'Petit', 'Normal', 'Gros', 'Énorme'];  // index 0-4
const FIRMNESS_LABELS = ['Liquide', 'Mou', 'Pateux', 'Ferme', 'Solide'];  // index 0-4

// ── State ──────────────────────────────────────────────────────────────────
// NOTE: on n'utilise pas 'location' (conflits avec window.location dans certains navigateurs)
let selectedAction   = 'pipi';    // 'pipi' | 'caca'
let selectedLocation = 'outside'; // 'outside' | 'inside'  ← valeurs Firebase

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

// ── Gauge setup (appelée lors du changement d'action) ──────────────────────
function setupGauge() {
  if (selectedAction === 'pipi') {
    gauge.min = 0; gauge.max = 4; gauge.step = 1;
    gauge.className        = 'taille';
    gaugeLabel.textContent = '💧 Quantité';
    gaugeEndL.textContent  = 'Gouttes';
    gaugeEndR.textContent  = 'Énorme';
  } else {
    gauge.min = 0; gauge.max = 4; gauge.step = 1;
    gauge.className        = 'fermete';
    gaugeLabel.textContent = '💩 Fermeté';
    gaugeEndL.textContent  = 'Liquide';
    gaugeEndR.textContent  = 'Solide';
  }
  updateGaugeLabel();
}

// ── Mise à jour du label seulement (appelée lors du drag) ──────────────────
function updateGaugeLabel() {
  const v = parseInt(gauge.value, 10);
  if (selectedAction === 'pipi') {
    gaugeVal.textContent = TAILLE_LABELS[v] || String(v);
  } else {
    gaugeVal.textContent = FIRMNESS_LABELS[v] || String(v);
  }
}

gauge.addEventListener('input', updateGaugeLabel);

// ── Action buttons ─────────────────────────────────────────────────────────
btnPipi.addEventListener('click', () => {
  selectedAction = 'pipi';
  btnPipi.className = 'btn-toggle active-pipi';
  btnCaca.className = 'btn-toggle';
  gauge.value = 2; // Normal
  setupGauge();
});

btnCaca.addEventListener('click', () => {
  selectedAction = 'caca';
  btnCaca.className = 'btn-toggle active-caca';
  btnPipi.className = 'btn-toggle';
  gauge.value = 1; // Mou
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

  // Lire la valeur de la jauge AVANT tout reset
  const gaugeIndex = parseInt(gauge.value, 10);

  const entry = {
    type:      selectedAction,
    text_val:  selectedLocation,
    num_val:   parseInt(gauge.value),
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
      gauge.value = 2; // Normal
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
