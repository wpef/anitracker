/**
 * stats.js – Calcul des statistiques à partir du tableau d'entrées
 *
 * Pas de dépendance sur le DOM ni sur la couche DB : reçoit les entrées
 * en paramètre et retourne un objet de métriques prêtes à l'affichage.
 */

// ── Prédicat balade ────────────────────────────────────────────────────────
// Une balade valide a type='walk' et n'est pas un ancien enregistrement "end".
const isWalk = e => e.type === 'walk' && e.action !== 'end';

/**
 * Calcule l'ensemble des statistiques utilisées par la page Stats et les quick-stats.
 *
 * @param {object[]} entries  Toutes les entrées triées par timestamp décroissant
 * @returns {{
 *   total: number,
 *   recent: number,
 *   walkStarts: number,
 *   pipi: number,
 *   caca: number,
 *   pipiDehors: number,
 *   pipiDedans: number,
 *   cacaDehors: number,
 *   cacaDedans: number,
 *   todayScore: number|null,
 *   todayWalks: object[],
 *   todayPipiTotal: number,
 *   todayPipiDedans: number,
 *   todayWalkMinSince7am: number,
 *   todayPipiDehors: number,
 *   todayPipiDedans_s: number,
 *   todayCacaDehors: number,
 *   todayCacaDedans: number,
 *   dailyLabels: string[],
 *   dailyWalks: number[],
 *   dailyPipi: number[],
 *   dailyCaca: number[],
 *   dailyInside: number[],
 *   dailyPropretScore: (number|null)[],
 *   firmnessLabels: string[],
 *   firmnessData: number[],
 * }}
 */
export function getStats(entries) {
  const now = new Date();

  // ── 7 derniers jours (compteurs globaux) ──────────────────────────────────
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

  // ── Score de propreté du JOUR (ring SVG) ──────────────────────────────────
  // Formule : 100 − (pipiDedans + cacaDedans) / total_pipis × 100
  // Caca dehors est neutre et exclu du dénominateur.
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = entries.filter(e => new Date(e.timestamp) >= todayStart);

  const todayPipi         = todayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi');
  const todayCaca         = todayEntries.filter(e => e.type === 'bathroom' && e.action === 'caca');
  const todayPipiDehors   = todayPipi.filter(e => e.location === 'outside').length;
  const todayPipiDedans_s = todayPipi.filter(e => e.location === 'inside').length;
  const todayCacaDehors   = todayCaca.filter(e => e.location === 'outside').length;
  const todayCacaDedans   = todayCaca.filter(e => e.location === 'inside').length;
  const todayBad          = todayPipiDedans_s + todayCacaDedans;
  const todayScore        = todayPipi.length > 0
    ? Math.max(0, Math.round(100 - (todayBad / todayPipi.length * 100))) : null;

  // ── Quick-stats : depuis 7h (ou hier 7h si avant 7h) ─────────────────────
  const statsFrom7am = new Date(now);
  if (now.getHours() < 7) statsFrom7am.setDate(statsFrom7am.getDate() - 1);
  statsFrom7am.setHours(7, 0, 0, 0);
  const quickEntries = entries.filter(e => new Date(e.timestamp) >= statsFrom7am);

  const todayPipiTotal       = quickEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi').length;
  const todayPipiDedans      = quickEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi' && e.location === 'inside').length;
  const todayWalkMinSince7am = quickEntries.filter(isWalk).reduce((s, e) => s + (e.duration_min || 0), 0);

  // Balades du jour avec horaires détaillés
  const todayWalks = todayEntries
    .filter(isWalk)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(e => ({
      id:          e.id,
      startTime:   e.start_time || e.timestamp,
      endTime:     e.end_time   || null,
      durationMin: e.duration_min || null,
    }));

  // ── Tendance 7 jours (graphique barres) ───────────────────────────────────
  const dailyLabels       = [];
  const dailyWalks        = [];
  const dailyPipi         = [];
  const dailyCaca         = [];
  const dailyInside       = [];
  const dailyPropretScore = [];

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

    const dayPipi       = dayEntries.filter(e => e.type === 'bathroom' && e.action === 'pipi');
    const dayCaca       = dayEntries.filter(e => e.type === 'bathroom' && e.action === 'caca');
    const dayPipiDedans = dayPipi.filter(e => e.location === 'inside').length;
    const dayCacaDedans = dayCaca.filter(e => e.location === 'inside').length;

    dailyPipi.push(dayPipi.length);
    dailyCaca.push(dayCaca.length);
    dailyInside.push(dayEntries.filter(e => e.location === 'inside').length);
    // Même formule que le score du jour
    dailyPropretScore.push(
      dayPipi.length > 0
        ? Math.max(0, Math.round(100 - ((dayPipiDedans + dayCacaDedans) / dayPipi.length * 100)))
        : null
    );
  }

  // ── Fermeté des cacas – 3 derniers jours, points individuels ─────────────
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
  threeDaysAgo.setHours(0, 0, 0, 0);

  const recentCacas = entries
    .filter(e => e.type === 'bathroom' && e.action === 'caca' && e.firmness !== undefined)
    .filter(e => new Date(e.timestamp) >= threeDaysAgo)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const todayStr       = now.toDateString();
  const firmnessLabels = recentCacas.map(e => {
    const d      = new Date(e.timestamp);
    const dayStr = d.toDateString() === todayStr
      ? 'Auj.'
      : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    return dayStr + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  });
  const firmnessData = recentCacas.map(e => e.firmness);

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
    todayScore,
    todayWalks,
    todayPipiTotal,
    todayPipiDedans,
    todayWalkMinSince7am,
    todayPipiDehors,
    todayPipiDedans_s,
    todayCacaDehors,
    todayCacaDedans,
    dailyLabels,
    dailyWalks,
    dailyPipi,
    dailyCaca,
    dailyInside,
    dailyPropretScore,
    firmnessLabels,
    firmnessData,
  };
}
