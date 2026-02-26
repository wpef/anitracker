/**
 * db.js – Données via Firebase Realtime Database
 * Cache mémoire local pour des lectures synchrones.
 * Toutes les écritures sont async et se propagent en temps réel.
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

// ── Cache mémoire (reste synchrone pour getStats/renderHistory) ────────────
let entriesCache = [];

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
 * @param {Function} onUpdate  Callback appelé à chaque changement distant
 */
export async function initDB(onUpdate) {
  await migrateFromLocalStorage();

  onValue(ref(fbDb, ENTRIES_PATH), snapshot => {
    const data = snapshot.val() || {};
    entriesCache = Object.values(data)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (typeof onUpdate === 'function') onUpdate();
  });
}

// ── Lecture synchrone depuis le cache ─────────────────────────────────────
export function getAllEntries() {
  return [...entriesCache];
}

// ── Écriture ──────────────────────────────────────────────────────────────
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

export async function deleteEntry(id) {
  entriesCache = entriesCache.filter(e => e.id !== id);
  await remove(ref(fbDb, `${ENTRIES_PATH}/${id}`));
}

export async function updateEntry(id, data) {
  entriesCache = entriesCache.map(e => e.id === id ? { ...e, ...data } : e);
  await update(ref(fbDb, `${ENTRIES_PATH}/${id}`), data);
}

// ── Statistiques ──────────────────────────────────────────────────────────
export function getStats() {
  const entries = getAllEntries();
  const now     = new Date();

  const isWalk = e => e.type === 'walk' && e.action !== 'end';

  // ── 7 derniers jours ────────────────────────────────────────────────────
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const recent = entries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);

  const walkStarts = recent.filter(isWalk);
  const pipi       = recent.filter(e => e.type === 'bathroom' && e.action === 'pipi');
  const caca       = recent.filter(e => e.type === 'bathroom' && e.action === 'caca');
  const pipiDehors = pipi.filter(e => e.location === 'outside').length;
  const pipiDedans = pipi.filter(e => e.location === 'inside').length;
  const cacaDehors = caca.filter(e => e.location === 'outside').length;
  const cacaDedans = caca.filter(e => e.location === 'inside').length;

  const totalBesoins = pipi.length + caca.length;
  const totalDehors  = pipiDehors + cacaDehors;
  const propretScore = totalBesoins > 0
    ? Math.round((totalDehors / totalBesoins) * 100) : null;

  // ── Aujourd'hui ─────────────────────────────────────────────────────────
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = entries.filter(e => new Date(e.timestamp) >= todayStart);

  // Quick-stats aujourd'hui
  const todayPipiTotal  = todayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi').length;
  const todayPipiDedans = todayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi' && e.location === 'inside').length;

  // Temps de balade depuis 7h
  const todayFrom7am = new Date(now);
  todayFrom7am.setHours(7, 0, 0, 0);
  const todayWalkMinSince7am = entries
    .filter(e => isWalk(e) && new Date(e.timestamp) >= todayFrom7am)
    .reduce((s, e) => s + (e.duration_min || 0), 0);

  // Balades aujourd'hui avec horaires
  const todayWalks = todayEntries
    .filter(isWalk)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(e => ({
      id:          e.id,
      startTime:   e.start_time || e.timestamp,
      endTime:     e.end_time   || null,
      durationMin: e.duration_min || null,
    }));

  // ── Tendance 7 jours ────────────────────────────────────────────────────
  const dailyLabels       = [];
  const dailyWalks        = [];
  const dailyPipi         = [];
  const dailyCaca         = [];
  const dailyInside       = [];
  const dailyPropretScore = [];
  const dailyAvgFirmness  = [];

  for (let i = 6; i >= 0; i--) {
    const day    = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEntries = entries.filter(e => {
      const t = new Date(e.timestamp);
      return t >= day && t <= dayEnd;
    });

    dailyLabels.push(day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }));
    dailyWalks.push(dayEntries.filter(isWalk).length);

    const dayPipi = dayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi');
    const dayCaca = dayEntries.filter(e => e.type === 'bathroom' && e.action === 'caca');
    dailyPipi.push(dayPipi.length);
    dailyCaca.push(dayCaca.length);
    dailyInside.push(dayEntries.filter(e => e.location === 'inside').length);

    const dayTotal  = dayPipi.length + dayCaca.length;
    const dayDehors = dayPipi.filter(e => e.location === 'outside').length
                    + dayCaca.filter(e => e.location === 'outside').length;
    dailyPropretScore.push(dayTotal > 0 ? Math.round(dayDehors / dayTotal * 100) : null);

    const cacaWithFirmness = dayCaca.filter(e => e.firmness !== undefined && e.firmness !== null);
    dailyAvgFirmness.push(cacaWithFirmness.length > 0
      ? Math.round(cacaWithFirmness.reduce((s, e) => s + e.firmness, 0) / cacaWithFirmness.length)
      : null);
  }

  return {
    total: entries.length,
    recent: recent.length,
    walkStarts: walkStarts.length,
    pipi: pipi.length,
    caca: caca.length,
    pipiDehors,
    pipiDedans,
    cacaDehors,
    cacaDedans,
    propretScore,
    todayWalks,
    todayPipiTotal,
    todayPipiDedans,
    todayWalkMinSince7am,
    dailyLabels,
    dailyWalks,
    dailyPipi,
    dailyCaca,
    dailyInside,
    dailyPropretScore,
    dailyAvgFirmness,
  };
}
