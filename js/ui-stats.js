/**
 * ui-stats.js – Rendu de la page Statistiques.
 *
 * Entièrement piloté par TYPE_DEF : les détails du score, les charts de jauge
 * sont générés dynamiquement. Pour ajouter un nouveau type besoin, aucun
 * changement ici.
 */

import { $, formatDuration, TYPE_DEF, needTypes } from './utils.js';
import { db } from './db-context.js';
import { getStats } from './stats.js';
import { renderScoreRing, renderBarChart, renderLineChart } from './charts.js';

// ── Graphiques de jauge — canvas créés dynamiquement ────────────────────────
let _gaugeCanvasIds = [];

/** Met à jour l'intégralité de la page Statistiques. */
export function renderStats() {
  const s = getStats(db.getAllEntries());

  // ── Quick-stats (bandeau du haut) ──────────────────────────────────────
  $('qs-pipi-in').textContent    = s.todayNeedInside;
  $('qs-pipi-total').textContent = s.todayNeedTotal;
  $('qs-walk-time').textContent  = s.todayWalkMinSince7am > 0
    ? formatDuration(s.todayWalkMinSince7am) : '0';

  // ── Score de propreté du jour ──────────────────────────────────────────
  renderScoreRing(s.todayScore);

  // Générer les détails du score dynamiquement depuis TYPE_DEF
  _renderScoreDetails(s);

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

  // ── Graphique balades (7 jours — durée en minutes par jour) ──────────
  renderBarChart('chart-walks', s.dailyLabels, [
    { label: 'Balades (min)', data: s.dailyWalkMin, color: '#4cc9f0' },
  ], { yUnit: ' min' });

  // ── Graphiques de jauge dynamiques ─────────────────────────────────────
  _renderGaugeCharts(s);
}

function _renderScoreDetails(s) {
  const container = $('score-details');
  if (!container) return;

  let html = '';
  for (const [key, def] of needTypes()) {
    const counts = s.todayNeedCounts[key] || { inside: 0, outside: 0 };
    if (def.textOptions) {
      for (const opt of def.textOptions) {
        const isInside = def.insideValue && opt.value === def.insideValue;
        const colorClass = isInside ? 'red' : 'green';
        const count = isInside ? counts.inside : counts.outside;
        html += `<div class="score-item ${colorClass}">
          <span class="si-label">${def.icon} ${def.label} ${opt.label.toLowerCase()}</span>
          <span class="si-value">${count}</span>
        </div>`;
      }
    }
  }
  container.innerHTML = html;
}

function _renderGaugeCharts(s) {
  // Supprimer les anciens canvas dynamiques
  for (const id of _gaugeCanvasIds) {
    const card = $(id)?.closest('.card');
    if (card) card.remove();
  }
  _gaugeCanvasIds = [];

  // Créer un chart pour chaque type avec des données de jauge
  const walksCard = $('chart-walks')?.closest('.card');
  if (!walksCard) return;

  for (const [key, gd] of Object.entries(s.gaugeData)) {
    if (!gd.data.length) continue;
    const canvasId = `chart-gauge-${key}`;
    _gaugeCanvasIds.push(canvasId);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-title">${gd.title}</div>
      <div class="chart-wrap">
        <canvas id="${canvasId}"></canvas>
      </div>`;
    walksCard.parentNode.insertBefore(card, walksCard);

    renderLineChart(canvasId, gd.labels, gd.data, gd.color);
  }
}
