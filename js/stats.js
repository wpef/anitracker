/**
 * stats.js – Calcul des statistiques à partir du tableau d'entrées
 *
 * Entièrement piloté par TYPE_DEF : les statistiques de propreté sont
 * calculées pour tous les types de la catégorie 'need' (avec insideValue).
 * Pour ajouter un nouveau besoin, aucun changement ici.
 *
 * Deux fenêtres temporelles :
 *  - 7 jours glissants (fenêtres 7h→7h) → tendance long terme
 *  - Depuis 7h du matin → stats "du jour" (score ring, quick-stats)
 *
 * Score de propreté = 100 − (besoins dedans / besoins totaux × 100)
 */

import { TYPE_DEF, needTypes, formatDayShort } from './utils.js';

/**
 * Calcule l'ensemble des statistiques.
 *
 * @param {object[]} entries  Toutes les entrées triées par timestamp décroissant
 * @returns {object}
 */
export function getStats(entries) {
  const now = new Date();
  const needs = needTypes(); // [[key, def], ...]

  // ── 7 derniers jours (compteurs globaux) ──────────────────────────────────
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const recent = entries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);

  const walkStarts = recent.filter(e => TYPE_DEF[e.type]?.hasDuration);

  // Compteurs par type de besoin (7 jours)
  const needCounts = {};
  for (const [key, def] of needs) {
    const typed = recent.filter(e => e.type === key);
    const inside  = def.insideValue ? typed.filter(e => e.text_val === def.insideValue).length : 0;
    const outside = typed.length - inside;
    needCounts[key] = { total: typed.length, inside, outside };
  }

  // ── Fenêtre "du jour" : depuis 7h ────────────────────────────────────────
  const todayFrom = new Date(now);
  if (now.getHours() < 5 || (now.getHours() === 5 && now.getMinutes() < 30))
    todayFrom.setDate(todayFrom.getDate() - 1);
  todayFrom.setHours(5, 30, 0, 0);
  const todayEntries = entries.filter(e => new Date(e.timestamp) >= todayFrom);

  // Compteurs du jour par type de besoin
  const todayNeedCounts = {};
  let todayNeedTotal  = 0;
  let todayNeedInside = 0;
  for (const [key, def] of needs) {
    const typed   = todayEntries.filter(e => e.type === key);
    const inside  = def.insideValue ? typed.filter(e => e.text_val === def.insideValue).length : 0;
    const outside = typed.length - inside;
    todayNeedCounts[key] = { total: typed.length, inside, outside };
    todayNeedTotal  += typed.length;
    todayNeedInside += inside;
  }

  // Score de propreté
  const todayScore = todayNeedTotal > 0
    ? Math.max(0, Math.round(100 - (todayNeedInside / todayNeedTotal * 100)))
    : null;

  // Balades du jour
  const todayWalkMinSince7am = todayEntries
    .filter(e => TYPE_DEF[e.type]?.hasDuration)
    .reduce((s, e) => s + (e.duration_min || 0), 0);

  const todayWalks = todayEntries
    .filter(e => TYPE_DEF[e.type]?.hasDuration)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(e => ({
      id:          e.id,
      startTime:   e.timestamp,
      endTime:     e.end_time   || null,
      durationMin: e.duration_min || null,
    }));

  // ── Tendance 7 jours (graphiques) ─────────────────────────────────────────
  const dailyLabels       = [];
  const dailyWalks        = [];
  const dailyWalkMin      = [];
  const dailyPropretScore = [];
  const dailyNeedCounts   = {};
  const dailyInside       = [];
  for (const [key] of needs) dailyNeedCounts[key] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(5, 30, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayEntries = entries.filter(e => {
      const t = new Date(e.timestamp);
      return t >= dayStart && t < dayEnd;
    });

    dailyLabels.push(formatDayShort(dayStart));

    const dayWalks = dayEntries.filter(e => TYPE_DEF[e.type]?.hasDuration);
    dailyWalks.push(dayWalks.length);
    dailyWalkMin.push(dayWalks.reduce((s, e) => s + (e.duration_min || 0), 0));

    let dayNeedTotal  = 0;
    let dayNeedInside = 0;
    for (const [key, def] of needs) {
      const typed   = dayEntries.filter(e => e.type === key);
      const inside  = def.insideValue ? typed.filter(e => e.text_val === def.insideValue).length : 0;
      dailyNeedCounts[key].push(typed.length);
      dayNeedTotal  += typed.length;
      dayNeedInside += inside;
    }
    dailyInside.push(dayEntries.filter(e => {
      const def = TYPE_DEF[e.type];
      return def?.insideValue && e.text_val === def.insideValue;
    }).length);

    dailyPropretScore.push(
      dayNeedTotal > 0
        ? Math.max(0, Math.round(100 - (dayNeedInside / dayNeedTotal * 100)))
        : null
    );
  }

  // ── Données de jauge – 3 derniers jours, points individuels ───────────────
  const gaugeData = {};
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
  threeDaysAgo.setHours(0, 0, 0, 0);
  const todayStr = now.toDateString();

  for (const [key, def] of needs) {
    if (!def.gauge) continue;
    const recentItems = entries
      .filter(e => e.type === key && e.num_val !== undefined)
      .filter(e => new Date(e.timestamp) >= threeDaysAgo)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    gaugeData[key] = {
      labels: recentItems.map(e => {
        const d      = new Date(e.timestamp);
        const dayStr = d.toDateString() === todayStr ? 'Auj.' : formatDayShort(d);
        return dayStr + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }),
      data:  recentItems.map(e => e.num_val),
      title: `${def.icon} ${def.gauge.title} – 3 jours`,
      color: def.color || '#ffcc80',
    };
  }

  return {
    total:  entries.length,
    recent: recent.length,
    walkStarts: walkStarts.length,
    needCounts,
    todayNeedCounts,
    todayNeedTotal,
    todayNeedInside,
    todayScore,
    todayWalks,
    todayWalkMinSince7am,
    dailyLabels,
    dailyWalks,
    dailyWalkMin,
    dailyNeedCounts,
    dailyInside,
    dailyPropretScore,
    gaugeData,
  };
}
