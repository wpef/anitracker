/**
 * db.js – Gestion des données en localStorage
 */

const DB_KEY = 'anitracker_entries';

export function getAllEntries() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveEntry(entry) {
  const entries = getAllEntries();
  entry.id = Date.now();
  entry.timestamp = entry.timestamp || new Date().toISOString();
  entries.unshift(entry);
  localStorage.setItem(DB_KEY, JSON.stringify(entries));
  return entry;
}

export function deleteEntry(id) {
  const entries = getAllEntries().filter(e => e.id !== id);
  localStorage.setItem(DB_KEY, JSON.stringify(entries));
}

export function getStats() {
  const entries = getAllEntries();
  const now = new Date();

  // Période : 7 derniers jours
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const recent = entries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);

  // Balades
  const walkStarts = recent.filter(e => e.type === 'walk' && e.action === 'start');
  const walkEnds   = recent.filter(e => e.type === 'walk' && e.action === 'end');

  // Besoins
  const pipi       = recent.filter(e => e.type === 'bathroom' && e.action === 'pipi');
  const caca       = recent.filter(e => e.type === 'bathroom' && e.action === 'caca');

  const pipiDehors = pipi.filter(e => e.location === 'outside').length;
  const pipiDedans = pipi.filter(e => e.location === 'inside').length;
  const cacaDehors = caca.filter(e => e.location === 'outside').length;
  const cacaDedans = caca.filter(e => e.location === 'inside').length;

  // Tendance journalière sur 7 jours
  const dailyLabels = [];
  const dailyWalks  = [];
  const dailyPipi   = [];
  const dailyCaca   = [];
  const dailyInside = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEntries = entries.filter(e => {
      const t = new Date(e.timestamp);
      return t >= day && t <= dayEnd;
    });

    dailyLabels.push(day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }));
    dailyWalks.push(dayEntries.filter(e => e.type === 'walk' && e.action === 'start').length);
    dailyPipi.push(dayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi').length);
    dailyCaca.push(dayEntries.filter(e => e.type === 'bathroom' && e.action === 'caca').length);
    dailyInside.push(dayEntries.filter(e => e.location === 'inside').length);
  }

  // Score propreté : % des besoins faits dehors
  const totalBesoins = pipi.length + caca.length;
  const totalDehors  = pipiDehors + cacaDehors;
  const propretScore = totalBesoins > 0 ? Math.round((totalDehors / totalBesoins) * 100) : null;

  return {
    total: entries.length,
    recent: recent.length,
    walkStarts: walkStarts.length,
    walkEnds: walkEnds.length,
    pipi: pipi.length,
    caca: caca.length,
    pipiDehors,
    pipiDedans,
    cacaDehors,
    cacaDedans,
    propretScore,
    dailyLabels,
    dailyWalks,
    dailyPipi,
    dailyCaca,
    dailyInside,
  };
}
