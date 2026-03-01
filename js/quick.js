/**
 * quick.js – Saisie rapide (page standalone pour raccourci Android)
 */

// ── State ──────────────────────────────────────────────────────────────────
let action   = 'pipi';    // 'pipi' | 'caca'
let location = 'outside'; // 'outside' | 'inside'

// ── Elements ───────────────────────────────────────────────────────────────
const btnPipi   = document.getElementById('btn-pipi');
const btnCaca   = document.getElementById('btn-caca');
const btnDehors = document.getElementById('btn-dehors');
const btnDedans = document.getElementById('btn-dedans');
const gauge     = document.getElementById('quick-gauge');
const gaugeVal  = document.getElementById('gauge-val');
const gaugeLabel = document.getElementById('gauge-label');
const gaugeEndL = document.getElementById('gauge-end-left');
const gaugeEndR = document.getElementById('gauge-end-right');
const btnSave   = document.getElementById('btn-save');
const errorBanner = document.getElementById('error-banner');

// ── Gauge update ───────────────────────────────────────────────────────────
function updateGauge() {
  if (action === 'pipi') {
    gauge.className = 'taille';
    gaugeLabel.textContent = '💧 Quantité';
    gaugeEndL.textContent  = 'Peu';
    gaugeEndR.textContent  = 'Beaucoup';
    gaugeVal.textContent   = gauge.value + '%';
  } else {
    gauge.className = 'fermete';
    gaugeLabel.textContent = '💩 Fermeté';
    gaugeEndL.textContent  = 'Mou';
    gaugeEndR.textContent  = 'Dur';
    const v = parseInt(gauge.value);
    const labels = ['', 'Très mou', 'Mou', 'Normal', 'Dur', 'Très dur'];
    const idx = Math.round(v / 25); // 0-4
    gaugeVal.textContent = labels[Math.min(idx + 1, 5)] || v + '%';
  }
}

gauge.addEventListener('input', updateGauge);

// ── Action buttons ─────────────────────────────────────────────────────────
btnPipi.addEventListener('click', () => {
  action = 'pipi';
  btnPipi.className = 'btn-toggle active-pipi';
  btnCaca.className = 'btn-toggle';
  gauge.value = 50;
  updateGauge();
});

btnCaca.addEventListener('click', () => {
  action = 'caca';
  btnCaca.className = 'btn-toggle active-caca';
  btnPipi.className = 'btn-toggle';
  gauge.value = 50;
  updateGauge();
});

// ── Location buttons ───────────────────────────────────────────────────────
btnDehors.addEventListener('click', () => {
  location = 'outside';
  btnDehors.className = 'btn-toggle active-dehors';
  btnDedans.className = 'btn-toggle';
});

btnDedans.addEventListener('click', () => {
  location = 'inside';
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
    type: 'bathroom',
    action,
    location,
    timestamp: new Date().toISOString(),
  };

  if (action === 'pipi') {
    entry.taille = parseInt(gauge.value);
  } else {
    entry.firmness = parseInt(gauge.value);
  }

  try {
    await saveEntryFn(entry);

    // Success feedback
    const orig = btnSave.textContent;
    btnSave.classList.add('success');
    btnSave.textContent = '✓ Enregistré !';

    setTimeout(() => {
      btnSave.classList.remove('success');
      btnSave.textContent = orig;
      btnSave.disabled = false;
      // Reset to defaults
      action   = 'pipi';
      location = 'outside';
      btnPipi.className   = 'btn-toggle active-pipi';
      btnCaca.className   = 'btn-toggle';
      btnDehors.className = 'btn-toggle active-dehors';
      btnDedans.className = 'btn-toggle';
      gauge.value = 50;
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
