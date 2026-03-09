/**
 * ui-stats.js – Rendu de la page Statistiques.
 *
 * Entièrement piloté par getTypeDef() : les détails du score, les charts de jauge
 * sont générés dynamiquement. Pour ajouter un nouveau type besoin, aucun
 * changement ici.
 *
 * Features:
 *  - Period selector: 7j / 14j / 30j
 *  - Premium users can swipe between periods using navigation arrows
 *  - Gantt chart showing today's timeline
 */

import { $, formatDuration, getTypeDef, needTypes } from './utils.js';
import { db } from './db-context.js';
import { getStats } from './stats.js';
import { renderScoreRing, renderBarChart, renderLineChart } from './charts.js';
import { canSwipeStats, isPremium } from './permissions.js';
import { showPremiumCTA } from './ui-premium.js';
import { renderGantt } from './ui-gantt.js';

// ── Graphiques de jauge — canvas créés dynamiquement ────────────────────────
let _gaugeCanvasIds = [];

// ── Period & navigation state ───────────────────────────────────────────────
let _days = 7;       // 7, 14, or 30
let _periodOffset = 0; // 0 = current period, 1 = previous, etc.

/** Met à jour l'intégralité de la page Statistiques. */
export function renderStats() {
  const s = getStats(db.getAllEntries(), { days: _days, offset: _periodOffset });

  // ── Period selector ──────────────────────────────────────────────────────
  _renderPeriodSelector();

  // ── Week navigation header ──────────────────────────────────────────────
  _renderWeekNav();

  // ── Quick-stats (bandeau du haut) ──────────────────────────────────────
  $('qs-pipi-in').textContent    = s.todayNeedInside;
  $('qs-pipi-total').textContent = s.todayNeedTotal;
  $('qs-walk-time').textContent  = s.todayWalkMinSince7am > 0
    ? formatDuration(s.todayWalkMinSince7am) : '0';

  // ── Score de propreté du jour ──────────────────────────────────────────
  renderScoreRing(s.todayScore);

  // Générer les détails du score dynamiquement depuis getTypeDef()
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

  // ── Graphique propreté (N jours) ───────────────────────────────────────
  renderBarChart('chart-propret', s.dailyLabels, [
    { label: `Propreté (%)`, data: s.dailyPropretScore, color: '#4caf50' },
  ], { yMax: 100, yUnit: '%' });

  // ── Graphique balades (N jours — durée en minutes par jour, courbe) ──
  renderLineChart('chart-walks', s.dailyLabels, s.dailyWalkMin, '#4cc9f0', { yUnit: ' min' });

  // ── Graphiques de jauge dynamiques ─────────────────────────────────────
  _renderGaugeCharts(s);

  // ── Gantt chart (today's timeline) ──────────────────────────────────────
  const ganttContainer = $('gantt-container');
  if (ganttContainer) {
    renderGantt(ganttContainer, db.getAllEntries());
  }
}

// ── Period selector ─────────────────────────────────────────────────────────

function _renderPeriodSelector() {
  const container = $('stats-period-selector');
  if (!container) return;

  // Only rebuild if needed
  if (container.dataset.built) {
    // Just update active state
    container.querySelectorAll('[data-days]').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.days, 10) === _days);
    });
    return;
  }

  container.dataset.built = '1';
  container.innerHTML = `<div class="segment stat-period">
    <button class="seg-btn${_days === 7 ? ' active' : ''}" data-days="7">7j</button>
    <button class="seg-btn${_days === 14 ? ' active' : ''}" data-days="14">14j</button>
    <button class="seg-btn${_days === 30 ? ' active' : ''}" data-days="30">30j</button>
  </div>`;

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-days]');
    if (!btn) return;
    const newDays = parseInt(btn.dataset.days, 10);
    if (newDays === _days) return;
    _days = newDays;
    _periodOffset = 0; // reset offset when changing period
    renderStats();
  });
}

// ── Week/period navigation ──────────────────────────────────────────────────

function _renderWeekNav() {
  const container = $('stats-week-nav');
  if (!container) return;

  if (!canSwipeStats()) {
    // Free user: show locked CTA
    container.innerHTML = `<div class="week-nav-locked">
      <span>Periode en cours</span>
      <button class="week-nav-lock-btn">Voir les periodes precedentes \uD83D\uDD12</button>
    </div>`;
    container.querySelector('.week-nav-lock-btn')?.addEventListener('click', () => {
      showPremiumCTA('Passez en Premium pour naviguer entre les periodes');
    });
    return;
  }

  // Premium user: show period label + arrows
  const refDate = new Date();
  refDate.setDate(refDate.getDate() - _periodOffset * _days);
  const periodStart = new Date(refDate);
  periodStart.setDate(periodStart.getDate() - _days + 1);

  const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const label = _periodOffset === 0
    ? `${_days} derniers jours`
    : `Du ${fmt(periodStart)} au ${fmt(refDate)}`;

  container.innerHTML = `
    <button class="week-nav-btn" id="week-prev">\u2039</button>
    <span class="week-nav-label">${label}</span>
    <button class="week-nav-btn" id="week-next" ${_periodOffset === 0 ? 'disabled' : ''}>\u203A</button>
  `;

  $('week-prev')?.addEventListener('click', () => {
    _periodOffset++;
    renderStats();
  });
  $('week-next')?.addEventListener('click', () => {
    if (_periodOffset > 0) {
      _periodOffset--;
      renderStats();
    }
  });
}

// ── Touch swipe support ─────────────────────────────────────────────────────

let _touchStartX = 0;
const statsPage = $('page-stats');
if (statsPage) {
  statsPage.addEventListener('touchstart', e => {
    _touchStartX = e.touches[0].clientX;
  }, { passive: true });

  statsPage.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - _touchStartX;
    if (Math.abs(diff) > 50 && canSwipeStats()) {
      if (diff > 0) {
        // Swipe right → go back in time
        _periodOffset++;
      } else {
        // Swipe left → go forward in time
        if (_periodOffset > 0) _periodOffset--;
        else return;
      }
      renderStats();
    }
  }, { passive: true });
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
