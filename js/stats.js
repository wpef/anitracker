/**
 * stats.js – Calcul des statistiques à partir du tableau d'entrées
 *
 * Pas de dépendance sur le DOM ni sur la couche DB : reçoit les entrées
 * en paramètre et retourne un objet de métriques prêtes à l'affichage.
 *
 * Deux fenêtres temporelles :
 *  - 7 jours glissants  → tendance long terme (graphiques, compteurs globaux)
 *  - Depuis 7h du matin → toutes les stats "du jour" (score ring, quick-stats, balades)
 *    Le reset à 7h (et non à minuit) évite que les accidents nocturnes soient
 *    attribués à la journée suivante. Avant 7h, la fenêtre démarre à 7h la veille.
 */

import { isWalk, formatDayShort } from './utils.js';

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
  const pipi       = recent.filter(e => e.type === 'pipi');
  const caca       = recent.filter(e => e.type === 'caca');
  const pipiDehors = pipi.filter(e => e.text_val === 'outside').length;
  const pipiDedans = pipi.filter(e => e.text_val === 'inside').length;
  const cacaDehors = caca.filter(e => e.text_val === 'outside').length;
  const cacaDedans = caca.filter(e => e.text_val === 'inside').length;

  // ── Fenêtre "du jour" : depuis 7h (source unique pour score + quick-stats) ─
  // Reset à 7h (et non à minuit) pour que les accidents nocturnes soient attribués
  // à la journée précédente. Avant 7h, la fenêtre démarre à 7h la veille.
  const todayFrom = new Date(now);
  if (now.getHours() < 7) todayFrom.setDate(todayFrom.getDate() - 1);
  todayFrom.setHours(7, 0, 0, 0);
  const todayEntries = entries.filter(e => new Date(e.timestamp) >= todayFrom);

  const todayPipi         = todayEntries.filter(e => e.type === 'pipi');
  const todayCaca         = todayEntries.filter(e => e.type === 'caca');
  const todayPipiDehors   = todayPipi.filter(e => e.text_val === 'outside').length;
  const todayPipiDedans   = todayPipi.filter(e => e.text_val === 'inside').length;
  const todayCacaDehors   = todayCaca.filter(e => e.text_val === 'outside').length;
  const todayCacaDedans   = todayCaca.filter(e => e.text_val === 'inside').length;

  // Score de propreté — formule : 100 − (accidents / total_pipis × 100)
  // Caca dehors est neutre, exclu du dénominateur (on ne peut pas "forcer" un caca dehors).
  const todayBad   = todayPipiDedans + todayCacaDedans;
  const todayScore = todayPipi.length > 0
    ? Math.max(0, Math.round(100 - (todayBad / todayPipi.length * 100))) : null;

  // Dérivés directs — même fenêtre, pas de second filtre
  const todayPipiTotal = todayPipi.length;
  const todayWalkMinSince7am = todayEntries.filter(isWalk)
    .reduce((s, e) => s + (e.duration_min || 0), 0);

  const todayWalks = todayEntries
    .filter(isWalk)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(e => ({
      id:          e.id,
      startTime:   e.timestamp,
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

    dailyLabels.push(formatDayShort(day));
    dailyWalks.push(dayEntries.filter(isWalk).length);

    const dayPipi       = dayEntries.filter(e => e.type === 'pipi');
    const dayCaca       = dayEntries.filter(e => e.type === 'caca');
    const dayPipiDedans = dayPipi.filter(e => e.text_val === 'inside').length;
    const dayCacaDedans = dayCaca.filter(e => e.text_val === 'inside').length;

    dailyPipi.push(dayPipi.length);
    dailyCaca.push(dayCaca.length);
    dailyInside.push(dayEntries.filter(e => e.text_val === 'inside').length);
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
    .filter(e => e.type === 'caca' && e.num_val !== undefined)
    .filter(e => new Date(e.timestamp) >= threeDaysAgo)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const todayStr       = now.toDateString();
  const firmnessLabels = recentCacas.map(e => {
    const d      = new Date(e.timestamp);
    const dayStr = d.toDateString() === todayStr ? 'Auj.' : formatDayShort(d);
    return dayStr + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  });
  const firmnessData = recentCacas.map(e => e.num_val);

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
