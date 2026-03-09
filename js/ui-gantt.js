/**
 * ui-gantt.js – Gantt chart component for today's activity timeline.
 *
 * Renders a horizontal timeline showing when each activity occurred:
 * - Duration types (walks, occupations) are shown as bars
 * - Point events (pipi, caca, meals) are shown as dots
 * - Axis covers 5:30 → 5:30 next day (app's day window)
 */

import { getTypeDef, allTypes } from './utils.js';

// Day window: 5:30 AM → 5:30 AM next day (24h)
const DAY_START_HOUR = 5;
const DAY_START_MIN = 30;
const DAY_TOTAL_MIN = 24 * 60; // 1440 minutes

// Axis hour markers to display
const AXIS_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];

/**
 * Render the Gantt chart into a container element.
 *
 * @param {HTMLElement} container
 * @param {object[]} entries  All entries (will be filtered to today)
 */
export function renderGantt(container, entries) {
  const now = new Date();

  // Compute today's 5:30 boundary
  const todayStart = new Date(now);
  if (now.getHours() < DAY_START_HOUR ||
      (now.getHours() === DAY_START_HOUR && now.getMinutes() < DAY_START_MIN)) {
    todayStart.setDate(todayStart.getDate() - 1);
  }
  todayStart.setHours(DAY_START_HOUR, DAY_START_MIN, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Filter entries to today's window
  const todayEntries = entries.filter(e => {
    const ts = new Date(e.timestamp);
    return ts >= todayStart && ts < todayEnd;
  });

  if (todayEntries.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:.5rem;font-size:.8rem">Pas encore d\'activite aujourd\'hui</div>';
    return;
  }

  // Group entries by type
  const typeDef = getTypeDef();
  const byType = {};
  for (const entry of todayEntries) {
    if (!typeDef[entry.type]) continue;
    if (!byType[entry.type]) byType[entry.type] = [];
    byType[entry.type].push(entry);
  }

  // Build axis
  let axisHtml = '<div class="gantt-axis">';
  for (const hour of AXIS_HOURS) {
    const pct = _minutesToPct(_hourToMinFromStart(hour));
    axisHtml += `<span class="gantt-axis-label" style="left:${pct}%">${hour}h</span>`;
  }
  // "Now" marker
  const nowMin = _tsToMinFromStart(now, todayStart);
  if (nowMin >= 0 && nowMin <= DAY_TOTAL_MIN) {
    const nowPct = _minutesToPct(nowMin);
    axisHtml += `<span class="gantt-axis-label" style="left:${nowPct}%;color:var(--walk);font-weight:bold">▼</span>`;
  }
  axisHtml += '</div>';

  // Build rows — maintain TYPE_DEF order
  let rowsHtml = '';
  for (const [typeKey] of allTypes()) {
    if (!byType[typeKey]) continue;
    const def = typeDef[typeKey];
    const entriesOfType = byType[typeKey];

    let barsHtml = '';
    for (const entry of entriesOfType) {
      const startMin = _tsToMinFromStart(new Date(entry.timestamp), todayStart);
      const startPct = _minutesToPct(Math.max(0, startMin));

      if (def.hasDuration && entry.end_time) {
        // Duration bar
        const endMin = _tsToMinFromStart(new Date(entry.end_time), todayStart);
        const widthPct = _minutesToPct(Math.max(3, endMin - startMin));
        barsHtml += `<div class="gantt-bar" style="left:${startPct}%;width:${widthPct}%;background:${def.color}"></div>`;
      } else {
        // Point dot
        barsHtml += `<div class="gantt-dot" style="left:${startPct}%;background:${def.color}"></div>`;
      }
    }

    rowsHtml += `<div class="gantt-row">
      <span class="gantt-label">${def.icon} ${def.label}</span>
      <div class="gantt-track">${barsHtml}</div>
    </div>`;
  }

  container.innerHTML = `<div class="gantt-chart">${axisHtml}${rowsHtml}</div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _tsToMinFromStart(date, dayStart) {
  return (date - dayStart) / 60000;
}

function _minutesToPct(min) {
  return Math.min(100, Math.max(0, (min / DAY_TOTAL_MIN) * 100)).toFixed(1);
}

function _hourToMinFromStart(hour) {
  // Convert an absolute hour to minutes from day start (5:30)
  let min = (hour - DAY_START_HOUR) * 60 - DAY_START_MIN;
  if (min < 0) min += DAY_TOTAL_MIN;
  return min;
}
