/**
 * db.js – Couche de données Firebase Realtime Database
 *
 * Maintient un cache mémoire local pour des lectures synchrones (getAllEntries).
 * Toutes les écritures sont asynchrones et se propagent en temps réel via onValue.
 *
 * Interface publique : initDB, getAllEntries, saveEntry, deleteEntry, updateEntry
 */

import { initializeApp }                            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, set, remove, update,
         onValue, get }                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getFirebaseConfig }                        from './firebase-config.js';

// ── Firebase init (config lue depuis localStorage) ─────────────────────────
const firebaseConfig = getFirebaseConfig();
if (!firebaseConfig) throw new Error('FIREBASE_NOT_CONFIGURED');
const fbApp  = initializeApp(firebaseConfig);
const fbDb   = getDatabase(fbApp);
const ENTRIES_PATH = 'entries';

// ── Debounce utilitaire (regroupe les updates rapides) ────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Cache mémoire (reste synchrone pour getAllEntries/renderHistory) ───────
let entriesCache = [];

// ── Dernière synchronisation réussie ─────────────────────────────────────
let lastSyncAt = null;
export function getLastSync() { return lastSyncAt; }

// ── Migration localStorage → Firebase (one-time) ──────────────────────────
const LS_KEY = 'anitracker_entries';

async function migrateFromLocalStorage() {
  try {
    const local = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (!local.length) return;
    const snap = await get(ref(fbDb, ENTRIES_PATH));
    if (snap.exists()) return; // Firebase already has data, skip
    const writes = {};
    local.forEach(e => { writes[e.id] = e; });
    await set(ref(fbDb, ENTRIES_PATH), writes);
    localStorage.removeItem(LS_KEY);
  } catch {
    // Migration silently fails if offline – will retry next time
  }
}

// ── Initialisation + listener temps réel ──────────────────────────────────
/**
 * Initialise la connexion Firebase, migre les données localStorage existantes,
 * puis établit un listener temps réel sur le nœud "entries".
 *
 * @param {() => void} onUpdate  Appelé à chaque mise à jour distante (ajout/modif/suppression)
 * @returns {Promise<void>}
 */
export async function initDB(onUpdate) {
  await migrateFromLocalStorage();

  const debouncedUpdate = typeof onUpdate === 'function'
    ? debounce(onUpdate, 300)
    : null;

  onValue(ref(fbDb, ENTRIES_PATH), snapshot => {
    const data = snapshot.val() || {};
    entriesCache = Object.values(data)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    lastSyncAt = new Date();
    if (debouncedUpdate) debouncedUpdate();
  });
}

// ── Lecture synchrone depuis le cache ─────────────────────────────────────
/**
 * Retourne une copie du cache local (trié par timestamp décroissant).
 * Lecture synchrone — ne déclenche pas de requête réseau.
 *
 * @returns {object[]}
 */
export function getAllEntries() {
  return [...entriesCache];
}

// ── Écriture ──────────────────────────────────────────────────────────────
/**
 * Sauvegarde une nouvelle entrée (mise à jour optimiste du cache puis écriture Firebase).
 *
 * @param {object} entry  Entrée à sauvegarder (sans id — l'id est généré ici)
 * @returns {Promise<object>}  L'entrée avec son id assigné
 */
export async function saveEntry(entry) {
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  entry.id        = id;
  entry.timestamp = entry.timestamp || new Date().toISOString();
  // Optimistic local update
  entriesCache.unshift(entry);
  entriesCache.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  // Persist to Firebase
  await set(ref(fbDb, `${ENTRIES_PATH}/${id}`), entry);
  return entry;
}

/**
 * Supprime une entrée du cache local et de Firebase.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
  entriesCache = entriesCache.filter(e => e.id !== id);
  await remove(ref(fbDb, `${ENTRIES_PATH}/${id}`));
}

/**
 * Met à jour les champs d'une entrée existante.
 *
 * @param {string} id
 * @param {object} data  Champs à écraser (merge partiel)
 * @returns {Promise<void>}
 */
export async function updateEntry(id, data) {
  entriesCache = entriesCache.map(e => e.id === id ? { ...e, ...data } : e);
  await update(ref(fbDb, `${ENTRIES_PATH}/${id}`), data);
}
