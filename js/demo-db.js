/**
 * demo-db.js – Données fictives pour le mode démo (sans Firebase)
 *
 * Expose la même interface que db.js afin que app.js puisse charger
 * l'un ou l'autre de façon transparente via import() dynamique :
 *   initDB, getAllEntries, saveEntry, deleteEntry, updateEntry
 *
 * Les données couvrent 7 jours glissants et sont regénérées à chaque
 * démarrage de session démo.
 */

let entriesCache = [];
let _onUpdate    = null;
let _idSeq       = 9000;

function mkId() {
  return (++_idSeq) + '_demo';
}

// ── Génération des données de démo ────────────────────────────────────────
function generateDemoData() {
  const entries = [];
  const now     = new Date();

  // Helpers
  const at = (dayOffset, hour, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const pipi  = (d, h, m, loc, num_val = 50)  => ({ id: mkId(), type: 'pipi', text_val: loc, num_val, timestamp: at(d,h,m) });
  const caca  = (d, h, m, loc, num_val = 70)  => ({ id: mkId(), type: 'caca', text_val: loc, num_val, timestamp: at(d,h,m) });
  const cacan = (d, h, m, loc, num_val, note) => ({ ...caca(d,h,m,loc,num_val), note });
  const meal  = (d, h, m)                     => ({ id: mkId(), type: 'meal', timestamp: at(d,h,m) });
  const walk  = (d, h, m, dur) => {
    const ts  = at(d, h, m);
    const end = new Date(new Date(ts).getTime() + dur * 60000).toISOString();
    return { id: mkId(), type: 'walk', timestamp: ts, end_time: end, duration_min: dur };
  };

  // ── Aujourd'hui (jour 0) ─────────────────────────────────────────────────
  entries.push(meal(0, 7, 0));
  entries.push(walk(0, 7, 50, 30));
  entries.push(pipi(0, 7, 45, 'outside', 65));
  entries.push(pipi(0, 8, 30, 'outside', 40));
  entries.push(pipi(0, 10, 15, 'inside', 30));     // accident
  entries.push(caca(0, 11, 0,  'outside', 80));
  entries.push(walk(0, 12, 0,  20));
  entries.push(pipi(0, 13, 30, 'outside', 55));

  // ── Hier (jour 1) ────────────────────────────────────────────────────────
  entries.push(meal(1, 7, 0));
  entries.push(walk(1, 7, 30, 35));
  entries.push(pipi(1, 7, 15,  'outside', 70));
  entries.push(pipi(1, 9, 30,  'outside', 45));
  entries.push(pipi(1, 11, 0,  'inside',  25));    // accident
  entries.push(caca(1, 12, 30, 'outside', 75));
  entries.push(walk(1, 17, 0,  40));
  entries.push(pipi(1, 17, 45, 'outside', 50));
  entries.push(meal(1, 18, 30));
  entries.push(pipi(1, 20, 0,  'outside', 40));

  // ── Jour -2 ──────────────────────────────────────────────────────────────
  entries.push(meal(2, 7, 15));
  entries.push(walk(2, 8, 0,   25));
  entries.push(pipi(2, 7, 50,  'outside', 65));
  entries.push(pipi(2, 10, 0,  'outside', 40));
  entries.push(pipi(2, 12, 30, 'inside',  35));    // accident
  entries.push(pipi(2, 12, 45, 'inside',  30));    // accident
  entries.push(caca(2, 14, 0,  'outside', 65));
  entries.push(walk(2, 18, 30, 30));
  entries.push(meal(2, 18, 0));
  entries.push(pipi(2, 19, 0,  'outside', 55));

  // ── Jour -3 ──────────────────────────────────────────────────────────────
  entries.push(meal(3, 7, 0));
  entries.push(walk(3, 7, 45, 30));
  entries.push(pipi(3, 7, 30,  'outside', 75));
  entries.push(pipi(3, 9, 45,  'outside', 50));
  entries.push(pipi(3, 11, 30, 'outside', 40));
  entries.push(cacan(3, 13, 0, 'inside',  55, 'Un peu mou'));  // accident
  entries.push(walk(3, 17, 30, 45));
  entries.push(pipi(3, 18, 0,  'outside', 60));
  entries.push(meal(3, 18, 30));
  entries.push(pipi(3, 20, 30, 'outside', 35));

  // ── Jour -4 ──────────────────────────────────────────────────────────────
  entries.push(meal(4, 7, 0));
  entries.push(walk(4, 8, 0,   30));
  entries.push(pipi(4, 7, 45,  'outside', 65));
  entries.push(pipi(4, 9, 30,  'inside',  40));    // accident
  entries.push(caca(4, 11, 0,  'outside', 85));
  entries.push(walk(4, 17, 0,  35));
  entries.push(pipi(4, 17, 30, 'outside', 55));
  entries.push(meal(4, 18, 0));
  entries.push(pipi(4, 20, 0,  'outside', 45));

  // ── Jour -5 ──────────────────────────────────────────────────────────────
  entries.push(meal(5, 7, 0));
  entries.push(walk(5, 7, 30, 40));
  entries.push(pipi(5, 7, 20,  'outside', 70));
  entries.push(pipi(5, 10, 0,  'outside', 45));
  entries.push(pipi(5, 12, 0,  'outside', 35));
  entries.push(caca(5, 14, 30, 'outside', 70));
  entries.push(walk(5, 17, 0,  30));
  entries.push(pipi(5, 17, 45, 'outside', 50));
  entries.push(meal(5, 18, 30));
  entries.push(pipi(5, 20, 30, 'inside',  30));    // accident

  // ── Jour -6 ──────────────────────────────────────────────────────────────
  entries.push(meal(6, 7, 0));
  entries.push(walk(6, 8, 0,   25));
  entries.push(pipi(6, 7, 50,  'outside', 60));
  entries.push(pipi(6, 10, 15, 'inside',  40));    // accident
  entries.push(pipi(6, 10, 20, 'inside',  35));    // accident
  entries.push(caca(6, 12, 0,  'outside', 60));
  entries.push(walk(6, 17, 30, 30));
  entries.push(pipi(6, 18, 0,  'outside', 55));
  entries.push(meal(6, 18, 30));

  return entries;
}

// ── API publique ──────────────────────────────────────────────────────────
/**
 * Initialise le cache avec des données de démo et appelle onUpdate.
 *
 * @param {() => void} onUpdate  Callback déclenché après chaque mutation
 */
export function initDB(onUpdate) {
  _onUpdate    = onUpdate;
  entriesCache = generateDemoData();
  entriesCache.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (typeof onUpdate === 'function') onUpdate();
}

/** @returns {object[]} Copie du cache trié par timestamp décroissant */
export function getAllEntries() {
  return [...entriesCache];
}

/**
 * @param {object} entry  Entrée sans id
 * @returns {Promise<object>}
 */
export async function saveEntry(entry) {
  entry.id        = mkId();
  entry.timestamp = entry.timestamp || new Date().toISOString();
  entriesCache.unshift(entry);
  entriesCache.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (_onUpdate) _onUpdate();
  return entry;
}

/** @param {string} id @returns {Promise<void>} */
export async function deleteEntry(id) {
  entriesCache = entriesCache.filter(e => e.id !== id);
  if (_onUpdate) _onUpdate();
}

/** @param {string} id @param {object} data @returns {Promise<void>} */
export async function updateEntry(id, data) {
  entriesCache = entriesCache.map(e => e.id === id ? { ...e, ...data } : e);
  entriesCache.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (_onUpdate) _onUpdate();
}
