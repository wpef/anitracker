/**
 * stats.js – Calcul des statistiques à partir du tableau d'entrées
 *
 * Entièrement piloté par getTypeDef() : les statistiques de propreté sont
 * calculées pour tous les types de la catégorie 'need' (avec insideValue).
 * Pour ajouter un nouveau besoin, aucun changement ici.
 *
 * Fenêtres temporelles configurables :
 *  - N jours glissants (fenêtres 5h30→5h30) → tendance long terme
 *  - Depuis 5h30 du matin → stats "du jour" (score ring, quick-stats)
 *
 * Score de propreté = 100 − (besoins dedans / besoins totaux × 100)
 *
 * Optimisations :
 *  - Single-pass : une seule itération sur les entries pour accumuler
 *    tous les compteurs (N jours, jour courant, jauges)
 *  - Memoization : résultat mis en cache tant que les entries ne changent pas
 */

import { getTypeDef, needTypes, formatDayShort } from './utils.js';

// ── Memoization cache ─────────────────────────────────────────────────────
let _statsCache = { hash: null, result: null };

/**
 * Calcule l'ensemble des statistiques.
 *
 * @param {object[]} entries        Toutes les entrées triées par timestamp décroissant
 * @param {object}   [opts]         Options
 * @param {number}   [opts.days=7]  Nombre de jours dans la fenêtre
 * @param {number}   [opts.offset=0] Décalage en périodes (0 = courant)
 * @returns {object}
 */
export function getStats(entries, opts = {}) {
  // Backward compat: if opts is a number, treat as legacy weekOffset
  let days, offset;
  if (typeof opts === 'number') {
    days = 7;
    offset = opts;
  } else {
    days = opts.days || 7;
    offset = opts.offset || 0;
  }

  // Memoization: skip recalculation if entries haven't changed
  const hash = entries.length + '_' + (entries[0]?.id || '') + '_' + (entries[entries.length - 1]?.id || '') + '_d' + days + '_o' + offset;
  if (hash === _statsCache.hash) return _statsCache.result;

  const now = new Date();
  if (offset > 0) {
    now.setDate(now.getDate() - offset * days);
  }
  const needs = needTypes(); // [[key, def], ...]
  const needKeys = new Set(needs.map(([k]) => k));

  // ── Pre-compute time boundaries ───────────────────────────────────────

  // N-day window bounds (day 0 = oldest, day N-1 = today)
  const dayBounds = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i);
    start.setHours(5, 30, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    dayBounds.push({ start, end, dayIndex: days - 1 - i }); // dayIndex 0..N-1 (0=oldest)
  }

  const windowStart = dayBounds[0].start;

  // Today window (5:30 AM boundary)
  const todayFrom = new Date(now);
  if (now.getHours() < 5 || (now.getHours() === 5 && now.getMinutes() < 30))
    todayFrom.setDate(todayFrom.getDate() - 1);
  todayFrom.setHours(5, 30, 0, 0);

  // 3-day window for gauge data
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
  threeDaysAgo.setHours(0, 0, 0, 0);

  // ── Initialize accumulators ───────────────────────────────────────────

  let recentCount = 0;
  let walkStartsCount = 0;

  // N-day need counts (global)
  const needCounts = {};
  for (const [key] of needs) needCounts[key] = { total: 0, inside: 0, outside: 0 };

  // Today counters
  const todayNeedCounts = {};
  for (const [key] of needs) todayNeedCounts[key] = { total: 0, inside: 0, outside: 0 };
  let todayNeedTotal = 0;
  let todayNeedInside = 0;
  let todayWalkMinSince7am = 0;
  const todayWalks = [];

  // Daily arrays (N days) — per-day accumulators
  const dailyWalkCount = new Array(days).fill(0);
  const dailyWalkMinArr = new Array(days).fill(0);
  const dailyInsideArr = new Array(days).fill(0);
  const dailyNeedTotalArr = new Array(days).fill(0);
  const dailyNeedInsideArr = new Array(days).fill(0);
  const dailyNeedCountsMap = {};
  for (const [key] of needs) dailyNeedCountsMap[key] = new Array(days).fill(0);

  // Gauge data collectors (3 days, sorted ascending later)
  const gaugeCollectors = {};
  for (const [key, def] of needs) {
    if (def.gauge) gaugeCollectors[key] = [];
  }

  // ── SINGLE PASS over all entries ──────────────────────────────────────

  for (const entry of entries) {
    const ts = new Date(entry.timestamp);
    const def = getTypeDef()[entry.type];
    if (!def) continue;

    const isNeed = needKeys.has(entry.type);
    const hasDuration = def.hasDuration;
    const isInside = isNeed && def.insideValue && entry.text_val === def.insideValue;

    // --- N-day recent window ---
    if (ts >= windowStart) {
      recentCount++;
      if (hasDuration) walkStartsCount++;

      // N-day need counts (global)
      if (isNeed) {
        needCounts[entry.type].total++;
        if (isInside) needCounts[entry.type].inside++;
        else needCounts[entry.type].outside++;
      }

      // Assign to daily bucket
      for (const { start, end, dayIndex } of dayBounds) {
        if (ts >= start && ts < end) {
          if (hasDuration) {
            dailyWalkCount[dayIndex]++;
            dailyWalkMinArr[dayIndex] += entry.duration_min || 0;
          }
          if (isNeed) {
            dailyNeedCountsMap[entry.type][dayIndex]++;
            dailyNeedTotalArr[dayIndex]++;
            if (isInside) {
              dailyNeedInsideArr[dayIndex]++;
              dailyInsideArr[dayIndex]++;
            }
          }
          break;
        }
      }
    }

    // --- Today window ---
    if (ts >= todayFrom) {
      if (isNeed) {
        todayNeedCounts[entry.type].total++;
        todayNeedTotal++;
        if (isInside) {
          todayNeedCounts[entry.type].inside++;
          todayNeedInside++;
        } else {
          todayNeedCounts[entry.type].outside++;
        }
      }
      if (hasDuration) {
        todayWalkMinSince7am += entry.duration_min || 0;
        todayWalks.push({
          id:          entry.id,
          startTime:   entry.timestamp,
          endTime:     entry.end_time || null,
          durationMin: entry.duration_min || null,
        });
      }
    }

    // --- Gauge data (3 days) ---
    if (isNeed && def.gauge && entry.num_val !== undefined && ts >= threeDaysAgo) {
      gaugeCollectors[entry.type].push(entry);
    }
  }

  // ── Post-processing ───────────────────────────────────────────────────

  // Today walks: sort ascending by timestamp
  todayWalks.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  // Today score
  const todayScore = todayNeedTotal > 0
    ? Math.max(0, Math.round(100 - (todayNeedInside / todayNeedTotal * 100)))
    : null;

  // Need counts: compute outside from total/inside (already done in-loop for todayNeedCounts)
  for (const [key] of needs) {
    needCounts[key].outside = needCounts[key].total - needCounts[key].inside;
  }

  // Daily arrays
  const dailyLabels = [];
  const dailyPropretScore = [];
  for (let i = 0; i < days; i++) {
    dailyLabels.push(formatDayShort(dayBounds[i].start));
    dailyPropretScore.push(
      dailyNeedTotalArr[i] > 0
        ? Math.max(0, Math.round(100 - (dailyNeedInsideArr[i] / dailyNeedTotalArr[i] * 100)))
        : null
    );
  }

  const dailyNeedCounts = {};
  for (const [key] of needs) dailyNeedCounts[key] = dailyNeedCountsMap[key];

  // Gauge data: sort ascending and format
  const gaugeData = {};
  const todayStr = now.toDateString();
  for (const [key, def] of needs) {
    if (!def.gauge) continue;
    const items = gaugeCollectors[key].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    gaugeData[key] = {
      labels: items.map(e => {
        const d = new Date(e.timestamp);
        const dayStr = d.toDateString() === todayStr ? 'Auj.' : formatDayShort(d);
        return dayStr + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }),
      data: items.map(e => e.num_val),
      title: `${def.icon} ${def.gauge.title} – 3 jours`,
      color: def.color || '#ffcc80',
    };
  }

  const result = {
    total: entries.length,
    recent: recentCount,
    walkStarts: walkStartsCount,
    needCounts,
    todayNeedCounts,
    todayNeedTotal,
    todayNeedInside,
    todayScore,
    todayWalks,
    todayWalkMinSince7am,
    dailyLabels,
    dailyWalks: dailyWalkCount,
    dailyWalkMin: dailyWalkMinArr,
    dailyNeedCounts,
    dailyInside: dailyInsideArr,
    dailyPropretScore,
    gaugeData,
    days,
  };

  _statsCache = { hash, result };
  return result;
}
