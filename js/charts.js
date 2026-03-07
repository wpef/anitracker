/**
 * charts.js – Rendu des graphiques Chart.js et du ring SVG de propreté.
 *
 * Maintient un registre interne des instances Chart pour les détruire
 * avant chaque recréation (évite les fuites mémoire sur Chart.js).
 */

import { $ } from './utils.js';

/** @type {Record<string, Chart>} */
const charts = {};

// ── Ring SVG ───────────────────────────────────────────────────────────────

/**
 * Met à jour le ring SVG du score de propreté journalier.
 *
 * @param {number|null} score  Score de 0 à 100, ou null si pas de données
 */
export function renderScoreRing(score) {
  const pct    = score !== null ? score : 0;
  const radius = 54;
  const circum = 2 * Math.PI * radius;
  const offset = circum - (pct / 100) * circum;

  const fill = document.querySelector('.ring-fill');
  fill.setAttribute('stroke-dasharray', circum);
  fill.setAttribute('stroke-dashoffset', circum);
  // Léger délai pour déclencher la transition CSS
  setTimeout(() => fill.setAttribute('stroke-dashoffset', offset), 50);

  $('ring-pct').textContent   = score !== null ? pct + '%' : '—';
  $('ring-label').textContent = score !== null
    ? (pct >= 80 ? '🌟 Excellent !' : pct >= 50 ? '👍 Bien !' : '💪 En progrès')
    : 'Pas encore de données';
}

// ── Graphique en barres ────────────────────────────────────────────────────

/**
 * Crée ou recrée un graphique en barres Chart.js.
 *
 * @param {string}   canvasId   ID du canvas cible
 * @param {string[]} labels     Labels de l'axe X
 * @param {{ label: string, data: (number|null)[], color: string }[]} datasets
 * @param {{ yMax?: number, yUnit?: string }} [opts]
 */
export function renderBarChart(canvasId, labels, datasets, opts = {}) {
  const ctx = $(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label:           d.label,
        data:            d.data.map(v => v === null ? NaN : v),
        backgroundColor: d.color + '99',
        borderColor:     d.color,
        borderWidth:     2,
        borderRadius:    6,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: { color: '#9a9ab0', font: { size: 11 }, boxWidth: 12, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: ctx => isNaN(ctx.parsed.y)
              ? 'Pas de données'
              : ctx.parsed.y + (opts.yUnit || ''),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#9a9ab0', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        y: {
          beginAtZero: true,
          ...(opts.yMax ? { max: opts.yMax } : {}),
          ticks: {
            color:     '#9a9ab0',
            precision: 0,
            font:      { size: 10 },
            callback:  v => v + (opts.yUnit || ''),
          },
          grid: { color: 'rgba(255,255,255,.06)' },
        },
      },
    },
  });
}

// ── Graphique en ligne ─────────────────────────────────────────────────────

/**
 * Crée ou recrée un graphique en ligne Chart.js.
 *
 * @param {string}          canvasId
 * @param {string[]}        labels
 * @param {(number|null)[]} data
 * @param {string}          color  Couleur CSS (hex)
 * @param {{ yUnit?: string, yMax?: number }} [opts]
 */
export function renderLineChart(canvasId, labels, data, color, opts = {}) {
  const ctx = $(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) charts[canvasId].destroy();

  const yUnit = opts.yUnit || '%';
  const yScale = { min: 0, beginAtZero: true };
  if (opts.yMax != null) yScale.max = opts.yMax;
  else if (!opts.yUnit) yScale.max = 100; // default 0-100% for gauge charts

  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data:                data.map(v => v === null ? NaN : v),
        borderColor:         color,
        backgroundColor:     color + '22',
        borderWidth:         2,
        pointBackgroundColor: color,
        pointRadius:         4,
        pointHoverRadius:    6,
        fill:                true,
        tension:             0.35,
        spanGaps:            false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => isNaN(ctx.parsed.y) ? 'Pas de données' : ctx.parsed.y + yUnit,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#9a9ab0', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        y: {
          ...yScale,
          ticks: {
            color: '#9a9ab0',
            font:  { size: 10 },
            precision: 0,
            callback: v => v + yUnit,
          },
          grid: { color: 'rgba(255,255,255,.06)' },
        },
      },
    },
  });
}
