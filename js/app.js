/**
 * app.js – Point d'entrée de l'application.
 *
 * Responsabilités :
 *  - Chargement dynamique de la couche DB (Firebase ou démo)
 *  - Authentification Firebase (email/password + Google)
 *  - Gestion des households (foyers) multi-utilisateurs
 *  - Écran de configuration Firebase
 *  - Saisie rapide via URL (?quick=pipi&loc=outside)
 *  - Enregistrement du Service Worker
 *  - Orchestration du démarrage (boot)
 *
 * La logique métier et l'affichage sont délégués aux modules ui-*.js.
 */

import { getFirebaseConfig, saveFirebaseConfig,
         clearFirebaseConfig, parseConfigInput } from './firebase-config.js';
import { $, normalizeEntry, getTypeDef, validateEntry, registerCustomTypes } from './utils.js';
import { showToast, setSyncState } from './toast.js';
import { showPage, onShowPage, setNavVisible } from './navigation.js';
import { db } from './db-context.js';
import { initNewEntry, entryLabel } from './ui-new-entry.js';
import { initQuick } from './ui-quick.js';
import { renderHistory } from './ui-history.js';
import { openEditPage } from './ui-edit.js';
import { renderStats } from './ui-stats.js';
import { setPremiumStatus, setDemoMode } from './permissions.js';

// ── Auth state ────────────────────────────────────────────────────────────
let _authModule = null;
let _householdModule = null;
let _customTypeModule = null;
let _appInitialized = false;  // prevents double-init on rapid auth changes
let _isDemo = false;
let _currentHouseholdId = null;

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

// ── Mode démo (pas d'auth) ──────────────────────────────────────────────

async function startDemo() {
  _isDemo = true;
  setDemoMode(true);
  $('setup-overlay').style.display = 'none';
  await loadDemoDb();
  db.initDB(() => {
    const active = document.querySelector('.page.active');
    if (active?.id === 'page-stats')   renderStats();
    if (active?.id === 'page-history') renderHistory();
  });
  $('demo-banner').style.display = 'flex';
  setNavVisible(true);
  setSyncState('ok');
  initNewEntry();
  initQuick();
  showPage('quick');
}

// ── Auth UI ───────────────────────────────────────────────────────────────

let _isSignup = false;

function showAuthPage() {
  setNavVisible(false);
  $('header-logout-btn').style.display = 'none';
  showPage('auth');
}

function showAuthError(msg) {
  const el = $('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAuthError() {
  $('auth-error').style.display = 'none';
}

function authErrorMessage(code) {
  const map = {
    'auth/invalid-email':            'Adresse email invalide',
    'auth/user-disabled':            'Compte désactivé',
    'auth/user-not-found':           'Aucun compte avec cet email',
    'auth/wrong-password':           'Mot de passe incorrect',
    'auth/invalid-credential':       'Email ou mot de passe incorrect',
    'auth/email-already-in-use':     'Un compte existe déjà avec cet email',
    'auth/weak-password':            'Le mot de passe doit avoir au moins 6 caractères',
    'auth/too-many-requests':        'Trop de tentatives. Réessayez plus tard.',
    'auth/popup-closed-by-user':     'Connexion Google annulée',
    'auth/network-request-failed':   'Erreur réseau. Vérifiez votre connexion.',
  };
  return map[code] || 'Erreur de connexion';
}

// Auth form: toggle between login/signup
$('auth-toggle-btn')?.addEventListener('click', () => {
  _isSignup = !_isSignup;
  $('auth-submit-btn').textContent = _isSignup ? 'Créer un compte' : 'Se connecter';
  $('auth-toggle-btn').textContent = _isSignup
    ? 'Déjà un compte ? Se connecter'
    : 'Pas encore de compte ? Créer un compte';
  $('auth-password').autocomplete = _isSignup ? 'new-password' : 'current-password';
  hideAuthError();
});

// Auth form: submit
$('auth-submit-btn')?.addEventListener('click', async () => {
  hideAuthError();
  const email    = $('auth-email').value.trim();
  const password = $('auth-password').value;
  if (!email || !password) {
    showAuthError('Veuillez remplir tous les champs');
    return;
  }
  try {
    if (_isSignup) {
      await _authModule.signup(email, password);
    } else {
      await _authModule.login(email, password);
    }
    // onAuthStateChanged will handle the rest
  } catch (err) {
    showAuthError(authErrorMessage(err.code));
  }
});

// Auth form: Google sign-in
$('auth-google-btn')?.addEventListener('click', async () => {
  hideAuthError();
  try {
    await _authModule.loginWithGoogle();
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showAuthError(authErrorMessage(err.code));
    }
  }
});

// Auth form: password reset
$('auth-forgot-btn')?.addEventListener('click', async () => {
  hideAuthError();
  const email = $('auth-email').value.trim();
  if (!email) {
    showAuthError('Entrez votre email pour réinitialiser le mot de passe');
    return;
  }
  try {
    await _authModule.resetPassword(email);
    showToast('Email de réinitialisation envoyé');
  } catch (err) {
    showAuthError(authErrorMessage(err.code));
  }
});

// Auth form: demo mode button
$('auth-demo-btn')?.addEventListener('click', startDemo);

// Header: logout
$('header-logout-btn')?.addEventListener('click', async () => {
  if (_authModule) {
    await _authModule.logout();
    // onAuthStateChanged will redirect to auth page
  }
});

// ── App initialization after successful auth ─────────────────────────────

async function initApp(user) {
  if (_appInitialized) return;
  _appInitialized = true;

  setSyncState('pending');

  // Resolve household
  let householdId = await _householdModule.getUserHouseholdId(user.uid);

  if (!householdId) {
    // First login: check for legacy data and migrate
    householdId = await _householdModule.createHousehold(
      user.uid, user.email, user.displayName
    );

    try {
      const migrated = await _householdModule.migrateLegacyEntries(householdId, user.uid);
      if (migrated > 0) {
        showToast(`${migrated} entrées migrées vers votre foyer`);
      }
    } catch {
      // Migration failure is non-fatal
    }
  }

  // Point DB at household entries
  db.setEntriesPath(_householdModule.getEntriesPath(householdId));

  _currentHouseholdId = householdId;

  // Listen for premium subscription changes
  _householdModule.onSubscriptionChange(householdId, (isPremium) => {
    setPremiumStatus(isPremium);
  });

  // Listen for custom types changes
  _householdModule.onCustomTypesChange(householdId, (customTypes) => {
    registerCustomTypes(customTypes);
    // Rebuild UI if already initialized
    if (_customTypeModule) {
      initNewEntry();
      initQuick();
    }
  });

  db.initDB(() => {
    const active = document.querySelector('.page.active');
    if (active?.id === 'page-stats')   renderStats();
    if (active?.id === 'page-history') renderHistory();
    setSyncState('ok');
  });

  setNavVisible(true);
  $('header-logout-btn').style.display = 'block';
  initNewEntry();
  initQuick();

  // Lazy-load custom type module
  _customTypeModule = await import('./ui-custom-type.js');
  _customTypeModule.initCustomType(() => _currentHouseholdId, _householdModule);

  await handleQuickEntry();
  showPage('quick');
}

function resetApp() {
  _appInitialized = false;
  setNavVisible(false);
  $('header-logout-btn').style.display = 'none';
}

// ── Saisie rapide (?quick=pipi|caca|walk) ─────────────────────────────────

async function handleQuickEntry() {
  const params = new URLSearchParams(location.search);
  const quick  = params.get('quick');
  if (!quick || !getTypeDef()[quick]) return;

  const def = getTypeDef()[quick];
  let entry;

  if (def.hasDuration) {
    const durationMin = parseInt(params.get('dur'), 10) || 30;
    const start = new Date();
    const end   = new Date(start.getTime() + durationMin * 60000);
    entry = {
      type: quick,
      timestamp: start.toISOString(), end_time: end.toISOString(),
      duration_min: durationMin, note: '',
    };
  } else {
    entry = {
      type: quick,
      timestamp: new Date().toISOString(), note: '',
    };
    if (def.textOptions) {
      const loc = params.get('loc');
      if (loc) {
        const validValues = def.textOptions.map(o => o.value);
        if (!validValues.includes(loc)) {
          showToast('Option invalide');
          return;
        }
        entry.text_val = loc;
      } else {
        entry.text_val = def.defaultTextVal || def.textOptions[0]?.value;
      }
    }
  }

  const error = validateEntry(entry, def);
  if (error) {
    showToast(error);
    return;
  }

  await db.saveEntry(entry);
  showToast(entryLabel(entry) + ' enregistré ✓');
  history.replaceState({}, '', '/');
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function boot() {
  // No Firebase config → show setup screen (config-first flow)
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

  // Load auth + household modules
  _authModule = await import('./auth.js');
  _householdModule = await import('./household.js');

  // Init household module with the Firebase database
  _householdModule.initHousehold(db.getFirebaseDb());

  // Init auth — onAuthStateChanged drives the app lifecycle
  _authModule.initAuth(db.getFirebaseApp(), async (user) => {
    if (_isDemo) return; // ignore auth changes in demo mode

    if (user) {
      await initApp(user);
    } else {
      resetApp();
      showAuthPage();
    }
  });

  // ── Online/offline feedback ──
  window.addEventListener('offline', () => {
    setSyncState('error');
    showToast('Hors ligne');
  });
  window.addEventListener('online', () => {
    setSyncState('ok');
    showToast('Reconnecté');
  });

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
