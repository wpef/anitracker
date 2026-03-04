/**
 * app.js – Point d'entrée de l'application.
 *
 * Responsabilités :
 *  - Chargement dynamique de la couche DB (Firebase ou démo)
 *  - Écran de configuration Firebase
 *  - Saisie rapide via URL (?quick=pipi&loc=outside)
 *  - Enregistrement du Service Worker
 *  - Orchestration du démarrage (boot)
 *
 * La logique métier et l'affichage sont délégués aux modules ui-*.js.
 */

import { getFirebaseConfig, saveFirebaseConfig,
         clearFirebaseConfig, parseConfigInput } from './firebase-config.js';
import { $, normalizeEntry } from './utils.js';
import { showToast, setSyncState } from './toast.js';
import { showPage, onShowPage } from './navigation.js';
import { db } from './db-context.js';
import { initNewEntry, resetNewEntryDefaults, entryLabel } from './ui-new-entry.js';
import { initQuick } from './ui-quick.js';
import { renderHistory } from './ui-history.js';
import { openEditPage } from './ui-edit.js';
import { renderStats } from './ui-stats.js';

// ── Chargement DB ──────────────────────────────────────────────────────────

async function loadDb() {
  const module = await import('./db.js');
  Object.assign(db, module);
  const rawGetAll = db.getAllEntries;
  db.getAllEntries = () => rawGetAll().map(normalizeEntry).filter(Boolean);
}

async function loadDemoDb() {
  const module = await import('./demo-db.js');
  Object.assign(db, module);
  const rawGetAll = db.getAllEntries;
  db.getAllEntries = () => rawGetAll().map(normalizeEntry).filter(Boolean);
}

// ── Renderers de navigation ────────────────────────────────────────────────

onShowPage('new',     resetNewEntryDefaults);
onShowPage('stats',   renderStats);
onShowPage('history', renderHistory);

// ── Écran de configuration Firebase ───────────────────────────────────────

function showSetupScreen() {
  $('setup-overlay').style.display = 'flex';
  if (getFirebaseConfig()) $('setup-reset').style.display = 'block';
}

$('setup-save')?.addEventListener('click', () => {
  const text   = $('setup-input').value.trim();
  const config = parseConfigInput(text);
  $('setup-error').style.display = config ? 'none' : 'block';
  if (!config) return;
  saveFirebaseConfig(config);
  location.reload();
});

$('setup-reset')?.addEventListener('click', () => {
  clearFirebaseConfig();
  location.reload();
});

$('exit-demo-btn')?.addEventListener('click', () => showSetupScreen());

// ── Mode démo ─────────────────────────────────────────────────────────────

async function startDemo() {
  $('setup-overlay').style.display = 'none';
  await loadDemoDb();
  db.initDB(() => {
    const active = document.querySelector('.page.active');
    if (active?.id === 'page-stats')   renderStats();
    if (active?.id === 'page-history') renderHistory();
  });
  $('demo-banner').style.display = 'flex';
  setSyncState('ok');
  initNewEntry();
  initQuick();
  showPage('quick');
}

// ── Saisie rapide (?quick=pipi|caca|walk) ─────────────────────────────────

async function handleQuickEntry() {
  const params = new URLSearchParams(location.search);
  const quick  = params.get('quick');
  if (!quick) return;

  let entry;
  if (quick === 'walk') {
    const durationMin = parseInt(params.get('dur'), 10) || 30;
    const start = new Date();
    const end   = new Date(start.getTime() + durationMin * 60000);
    entry = {
      type: 'walk',
      timestamp: start.toISOString(), end_time: end.toISOString(),
      duration_min: durationMin, note: '',
    };
  } else if (quick === 'pipi' || quick === 'caca') {
    entry = {
      type: quick,
      text_val: params.get('loc') || 'outside',
      timestamp: new Date().toISOString(), note: '',
    };
  } else {
    return;
  }

  await db.saveEntry(entry);
  showToast(entryLabel(entry) + ' enregistré ✓');
  history.replaceState({}, '', '/');
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function boot() {
  if (!getFirebaseConfig()) {
    showSetupScreen();
    $('btn-demo').addEventListener('click', startDemo);
    return;
  }

  try {
    await loadDb();
  } catch {
    showSetupScreen();
    $('btn-demo').addEventListener('click', startDemo);
    return;
  }

  setSyncState('pending');

  db.initDB(() => {
    const active = document.querySelector('.page.active');
    if (active?.id === 'page-stats')   renderStats();
    if (active?.id === 'page-history') renderHistory();
    setSyncState('ok');
  });

  initNewEntry();
  initQuick();
  await handleQuickEntry();
  showPage('quick');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => reg.update())
      .catch(() => {});
  }
}

// ── Service Worker : listener de mise à jour ───────────────────────────────
// Enregistré au niveau module (pas dans boot()) pour survivre aux crashes de boot()
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SW_UPDATED') location.reload();
  });
}

boot();
