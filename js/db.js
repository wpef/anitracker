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

  // Helper : une entrée balade valide (nouveau modèle ou ancien walk_start)
  const isWalk = e => e.type === 'walk' && e.action !== 'end';

  // Période : dernières 24 heures (pour les quick-stats)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last24h = entries.filter(e => new Date(e.timestamp) >= twentyFourHoursAgo);
  const last24hWalks = last24h.filter(isWalk).length;
  const last24hPipi  = last24h.filter(e => e.type === 'bathroom' && e.action === 'pipi').length;
  const last24hCaca  = last24h.filter(e => e.type === 'bathroom' && e.action === 'caca').length;

  // Balades
  const walkStarts = recent.filter(isWalk);

  // Besoins
  const pipi       = recent.filter(e => e.type === 'bathroom' && e.action === 'pipi');
  const caca       = recent.filter(e => e.type === 'bathroom' && e.action === 'caca');

  const pipiDehors = pipi.filter(e => e.location === 'outside').length;
  const pipiDedans = pipi.filter(e => e.location === 'inside').length;
  const cacaDehors = caca.filter(e => e.location === 'outside').length;
  const cacaDedans = caca.filter(e => e.location === 'inside').length;

  // Tendance journalière sur 7 jours
  const dailyLabels       = [];
  const dailyWalks        = [];
  const dailyPipi         = [];
  const dailyCaca         = [];
  const dailyInside       = [];
  const dailyPropretScore = [];

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
  }

  // Balades d'aujourd'hui avec durée
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = entries.filter(e => new Date(e.timestamp) >= todayStart);
  const todayWalks = todayEntries
    .filter(isWalk)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(e => ({
      id: e.id,
      startTime: e.start_time || e.timestamp,
      endTime:   e.end_time   || null,
      durationMin: e.duration_min || null,
    }));

  // Score propreté : % des besoins faits dehors
  const totalBesoins = pipi.length + caca.length;
  const totalDehors  = pipiDehors + cacaDehors;
  const propretScore = totalBesoins > 0 ? Math.round((totalDehors / totalBesoins) * 100) : null;

  return {
    total: entries.length,
    recent: recent.length,
    last24hWalks,
    last24hPipi,
    last24hCaca,
    walkStarts: walkStarts.length,
    pipi: pipi.length,
    caca: caca.length,
    pipiDehors,
    pipiDedans,
    cacaDehors,
    cacaDedans,
    propretScore,
    todayWalks,
    dailyLabels,
    dailyWalks,
    dailyPipi,
    dailyCaca,
    dailyInside,
    dailyPropretScore,
  };
}
