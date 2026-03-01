/**
 * ui-stats.js – Rendu de la page Statistiques.
 *
 * Appelle getStats() avec les entrées courantes, puis met à jour
 * les quick-stats, le ring SVG de propreté et les graphiques Chart.js.
 */

import { $, formatDuration } from './utils.js';
import { db } from './db-context.js';
import { getStats } from './stats.js';
import { renderScoreRing, renderBarChart, renderLineChart } from './charts.js';

/** Met à jour l'intégralité de la page Statistiques. */
export function renderStats() {
  const s = getStats(db.getAllEntries());

  // ── Quick-stats (bandeau du haut) ──────────────────────────────────────
  $('qs-pipi-in').textContent    = s.todayPipiDedans;
  $('qs-pipi-total').textContent = s.todayPipiTotal;
  $('qs-walk-time').textContent  = s.todayWalkMinSince7am > 0
    ? formatDuration(s.todayWalkMinSince7am) : '0';

  // ── Score de propreté du jour ──────────────────────────────────────────
  renderScoreRing(s.todayScore);
  $('si-pipi-out').textContent = s.todayPipiDehors;
  $('si-pipi-in').textContent  = s.todayPipiDedans_s;
  $('si-caca-out').textContent = s.todayCacaDehors;
  $('si-caca-in').textContent  = s.todayCacaDedans;

  // ── Résumé des balades du jour ─────────────────────────────────────────
  const walkCount     = s.todayWalks.length;
  const totalTodayMin = s.todayWalks.reduce((sum, w) => sum + (w.durationMin || 0), 0);
  let todaySummary;
  if (walkCount === 0) {
    todaySummary = '<span class="today-walks-empty">Pas encore de balade aujourd\'hui</span>';
  } else {
    const countLabel = walkCount === 1 ? '1 balade' : `${walkCount} balades`;
    const durLabel   = totalTodayMin > 0 ? ` · ${formatDuration(totalTodayMin)} au total` : '';
    todaySummary = `<span class="today-walks-count">${countLabel}</span><span class="today-walks-dur">${durLabel}</span>`;
  }
  $('today-walks-summary').innerHTML = todaySummary;

  // ── Graphique propreté (7 jours) ───────────────────────────────────────
  renderBarChart('chart-propret', s.dailyLabels, [
    { label: 'Propreté (%)', data: s.dailyPropretScore, color: '#4caf50' },
  ], { yMax: 100, yUnit: '%' });

  // ── Graphique fermeté des cacas (3 jours, points individuels) ─────────
  renderLineChart('chart-firmness', s.firmnessLabels, s.firmnessData, '#ffcc80');
}
