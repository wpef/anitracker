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
import { renderScoreRing, renderBarChart, renderLineChart, renderDayActivityBars, renderPropretChart } from './charts.js';
import { canSwipeStats, isPremium, getMaxStatsPeriodDays } from './permissions.js';
import { showPremiumCTA } from './ui-premium.js';
import { showToast } from './toast.js';
import { renderGantt } from './ui-gantt.js';

// ── Graphiques de jauge — canvas créés dynamiquement ────────────────────────
let _gaugeCanvasIds = [];

// ── Period & navigation state ───────────────────────────────────────────────
let _days = 7;        // 7, 14, or 30
let _periodOffset = 0; // 0 = current period, 1 = previous, etc.
let _todayOffset = 0;  // 0 = today, 1 = yesterday, … (Aujourd'hui tab nav)
let _view = 'today';   // 'today' (défaut) | 'period'

const MAX_DAY_BACK = 7; // day navigation capped at 7 days back (all tiers)

/** Met à jour la page Statistiques (onglet actif uniquement). */
export function renderStats() {
  _syncTabs();
  const todayEl  = $('stats-today');
  const periodEl = $('stats-period');

  if (_view === 'period') {
    if (todayEl)  todayEl.style.display  = 'none';
    if (periodEl) periodEl.style.display = '';
    _renderPeriod(getStats(db.getAllEntries(), { days: _days, offset: _periodOffset }));
  } else {
    if (periodEl) periodEl.style.display = 'none';
    if (todayEl)  todayEl.style.display  = '';
    _renderToday(getStats(db.getAllEntries(), { days: _days, todayOffset: _todayOffset }));
  }
}

/** Libellé du jour affiché sur l'onglet Aujourd'hui. */
function _dayLabel(offset) {
  if (offset === 0) return "Aujourd'hui";
  if (offset === 1) return 'Hier';
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Onglet AUJOURD'HUI ───────────────────────────────────────────────────────

function _renderToday(s) {
  // Day label + dynamic titles (Aujourd'hui / Hier / date)
  const dayLbl = _dayLabel(_todayOffset);
  const dayEl = $('stats-day-label');
  if (dayEl) dayEl.textContent = dayLbl;
  const hintEl = $('stats-day-hint');
  if (hintEl) hintEl.textContent = canSwipeStats()
    ? (_todayOffset < MAX_DAY_BACK ? '← glisse pour les jours précédents' : 'jour le plus ancien')
    : '🔒 glisse pour débloquer les jours précédents';
  const scoreTitle = $('score-card-title');
  if (scoreTitle) scoreTitle.textContent = `🏆 Score propreté – ${dayLbl.toLowerCase()}`;

  // Quick-stats (bandeau du haut)
  $('qs-pipi-in').textContent    = s.todayNeedInside;
  $('qs-pipi-total').textContent = s.todayNeedTotal;
  $('qs-walk-time').textContent  = s.todayWalkMinSince7am > 0
    ? formatDuration(s.todayWalkMinSince7am) : '0';

  // Score de propreté du jour
  renderScoreRing(s.todayScore);
  _renderScoreDetails(s);

  // Résumé des balades du jour — uniquement les vraies balades (type 'walk')
  const walks         = (s.todayWalks || []).filter(w => w.type === 'walk');
  const walkCount     = walks.length;
  const totalTodayMin = walks.reduce((sum, w) => sum + (w.durationMin || 0), 0);
  let todaySummary;
  if (walkCount === 0) {
    todaySummary = '<span class="today-walks-empty">Pas encore de balade aujourd\'hui</span>';
  } else {
    const countLabel = walkCount === 1 ? '1 balade' : `${walkCount} balades`;
    const durLabel   = totalTodayMin > 0 ? ` · ${formatDuration(totalTodayMin)} au total` : '';
    todaySummary = `<span class="today-walks-count">${countLabel}</span><span class="today-walks-dur">${durLabel}</span>`;
  }
  $('today-walks-summary').innerHTML = todaySummary;

  // Activités à durée du jour — barres cumulées par heure, empilées par type.
  // X = heure (0–23 h), Y = durée cumulée (min), une couleur par type.
  const td = getTypeDef();
  const durationEvents = (s.todayWalks || []).filter(w => w.durationMin);
  const byType = {};
  for (const w of durationEvents) {
    const def = td[w.type] || {};
    if (!byType[w.type]) byType[w.type] = { label: def.label || w.type, color: def.color || '#4cc9f0', data: new Array(24).fill(0) };
    byType[w.type].data[new Date(w.startTime).getHours()] += w.durationMin;
  }
  const labels   = Array.from({ length: 24 }, (_, h) => h + 'h');
  const datasets = Object.values(byType).map(t => ({ label: t.label, data: t.data, color: t.color }));
  renderDayActivityBars('chart-day-duration', labels, datasets);
  const emptyEl = $('today-duration-empty');
  if (emptyEl) emptyEl.style.display = durationEvents.length ? 'none' : 'block';

  // Timeline du jour (Gantt) — pour le jour sélectionné
  const ganttContainer = $('gantt-container');
  if (ganttContainer) renderGantt(ganttContainer, db.getAllEntries(), _todayOffset);
}

// ── Onglet PÉRIODE ───────────────────────────────────────────────────────────

function _renderPeriod(s) {
  _renderPeriodSelector();
  _renderWeekNav();

  const hasData = s.dailyPropretScore.some(v => v !== null && v !== undefined);

  // Graphique propreté (N jours) : barres % + courbes besoins total / dedans
  renderPropretChart('chart-propret', s.dailyLabels, {
    score:  s.dailyPropretScore,
    total:  s.dailyNeedTotal,
    inside: s.dailyInside,
  });

  // Graphique balades (N jours) — barres pour une lecture claire des totaux
  renderBarChart('chart-walks', s.dailyLabels, [
    { label: 'Balades (min)', data: s.dailyWalkMin, color: '#4cc9f0' },
  ], { yUnit: ' min' });

  // Graphiques de jauge dynamiques
  _renderGaugeCharts(s);

  _toggleEmptyHint(!hasData);
}

// ── Onglets (switch) ─────────────────────────────────────────────────────────

function _syncTabs() {
  document.querySelectorAll('[data-stats-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.statsTab === _view));
}

function _toggleEmptyHint(show) {
  const periodEl = $('stats-period');
  if (!periodEl) return;
  let hint = periodEl.querySelector('.stats-empty-hint');
  if (show && !hint) {
    hint = document.createElement('p');
    hint.className = 'stats-empty-hint';
    hint.textContent = 'Pas encore de données sur cette période.';
    periodEl.appendChild(hint);
  } else if (!show && hint) {
    hint.remove();
  }
}

const _statsTabs = document.querySelector('.stats-tabs');
if (_statsTabs) {
  _statsTabs.addEventListener('click', e => {
    const btn = e.target.closest('[data-stats-tab]');
    if (!btn) return;
    _view = btn.dataset.statsTab;
    if (_view === 'today') _todayOffset = 0; // tapping the tab returns to today
    renderStats();
  });
}

// ── Period selector ─────────────────────────────────────────────────────────

function _renderPeriodSelector() {
  const container = $('stats-period-selector');
  if (!container) return;

  const maxDays = getMaxStatsPeriodDays();   // free: 7 · paid/pro: ∞
  if (_days > maxDays) _days = 7;            // clamp if tier downgraded

  // Rebuild each render so the lock state reflects the current tier.
  container.innerHTML = `<div class="segment stat-period">` +
    [7, 14, 30].map(d => {
      const locked = d > maxDays;
      return `<button class="seg-btn${d === _days ? ' active' : ''}${locked ? ' locked' : ''}" data-days="${d}">${d}j${locked ? ' 🔒' : ''}</button>`;
    }).join('') + `</div>`;

  if (!container.dataset.bound) {
    container.dataset.bound = '1';
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-days]');
      if (!btn) return;
      if (btn.classList.contains('locked')) {
        showPremiumCTA('Passez en Premium pour les périodes de plus de 7 jours', 'paid');
        return;
      }
      const newDays = parseInt(btn.dataset.days, 10);
      if (newDays === _days) return;
      _days = newDays;
      _periodOffset = 0; // reset offset when changing period
      renderStats();
    });
  }
}

// ── Week/period navigation ──────────────────────────────────────────────────

function _renderWeekNav() {
  const container = $('stats-week-nav');
  if (!container) return;

  if (!canSwipeStats()) {
    // Free user: clear current-period label + a subtle, non-blocking hint.
    container.innerHTML = `<div class="week-nav-free">
      <span class="week-nav-label">${_days} derniers jours</span>
      <button class="week-nav-hint">Naviguer dans le temps \uD83D\uDD12</button>
    </div>`;
    container.querySelector('.week-nav-hint')?.addEventListener('click', () => {
      showPremiumCTA('Passez en Premium pour naviguer entre les p\u00E9riodes', 'paid');
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
    if (Math.abs(diff) <= 50) return;

    if (_view === 'period') {
      // Période tab: navigate periods (premium only)
      if (!canSwipeStats()) return;
      if (diff > 0) _periodOffset++;
      else if (_periodOffset > 0) _periodOffset--;
      else return;
      renderStats();
      return;
    }

    // Aujourd'hui tab: swipe LEFT = previous day, RIGHT = toward today.
    if (diff < 0) {
      // Going back in time → premium-gated, capped at MAX_DAY_BACK
      if (!canSwipeStats()) {
        showPremiumCTA('Passez en Premium pour voir les jours précédents', 'paid');
        return;
      }
      if (_todayOffset < MAX_DAY_BACK) { _todayOffset++; renderStats(); }
      else showToast(`Limité à ${MAX_DAY_BACK} jours`);
    } else {
      // Coming forward toward today (free of charge)
      if (_todayOffset > 0) { _todayOffset--; renderStats(); }
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
