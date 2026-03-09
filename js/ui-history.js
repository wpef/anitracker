/**
 * ui-history.js – Rendu de la page Historique (liste chronologique des entrées).
 *
 * Entièrement piloté par TYPE_DEF : chaque entrée est rendue selon sa
 * définition de type. Pour ajouter un nouveau type, aucun changement ici.
 */

import { $, formatDuration, getTypeDef, getTextLabel, gaugeLabel } from './utils.js';
import { db } from './db-context.js';
import { openEditPage } from './ui-edit.js';
import { getMaxHistoryDays, isPremium } from './permissions.js';
import { showPremiumCTA } from './ui-premium.js';

// ── Rendu principal ────────────────────────────────────────────────────────

export function renderHistory() {
  const allEntries = db.getAllEntries();
  const container  = $('entry-list');

  if (!allEntries.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🐶</div>
      <p>Aucune entrée pour l'instant.<br>Ajoutez la première !</p>
    </div>`;
    return;
  }

  // Filter entries by max history days for free users
  const maxDays = getMaxHistoryDays();
  const cutoff = maxDays === Infinity
    ? null
    : new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);

  const visibleEntries = cutoff
    ? allEntries.filter(e => new Date(e.timestamp) >= cutoff)
    : allEntries;

  const hasHiddenEntries = cutoff && visibleEntries.length < allEntries.length;

  container.innerHTML = _buildHTML(visibleEntries);

  // Show blurred premium gate if entries are hidden
  if (hasHiddenEntries) {
    container.innerHTML += _buildPremiumGate(allEntries, visibleEntries.length);
    container.querySelector('.premium-gate-btn')?.addEventListener('click', () => {
      showPremiumCTA('Passez en Premium pour voir tout l\'historique');
    });
  }

  container.querySelectorAll('.tl-entry[data-id]').forEach(el => {
    el.addEventListener('click', () => openEditPage(el.dataset.id));
  });
}

// ── Construction du HTML ───────────────────────────────────────────────────

function _buildHTML(entries) {
  const groups = _groupByDay(entries);

  const todayKey = _dayKey(new Date());
  const yest     = new Date(); yest.setDate(yest.getDate() - 1);
  const yestKey  = _dayKey(yest);

  const fmt = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  let html = '';
  for (const [key, dayEntries] of groups) {
    html += `<div class="tl-day-header">${_dayLabel(key, dayEntries[0], todayKey, yestKey)}</div>
             <div class="tl-list">`;
    for (const e of dayEntries) {
      html += _entryRow(e, fmt);
    }
    html += '</div>';
  }
  return html;
}

function _groupByDay(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = _dayKey(new Date(e.timestamp));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return groups;
}

function _dayKey(d) {
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function _dayLabel(key, sample, todayKey, yestKey) {
  if (key === todayKey) return "Aujourd'hui";
  if (key === yestKey)  return 'Hier';
  return new Date(sample.timestamp).toLocaleDateString('fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Rendu unifié d'une entrée, piloté par TYPE_DEF.
 * Titre : Nom du type • Durée (si existante)
 * Sous-titre : label de la jauge (si existant), sinon horaires ou note
 * Badge : valeur texte avec couleur associée (depuis textOptions)
 */
function _entryRow(e, fmt) {
  const def  = getTypeDef()[e.type] || { label: e.type || '?', icon: '?' };
  const icon = def.icon;
  const startStr = fmt(e.timestamp);

  // Title: Type • Duration
  const dur = e.duration_min ? formatDuration(e.duration_min) : '';
  const titleParts = [def.label];
  if (dur) titleParts.push(dur);
  const title = titleParts.join(' · ');

  // Subtitle: gauge label > time range > note
  const metaParts = [];
  if (e.num_val !== undefined && def.gauge) {
    metaParts.push(gaugeLabel(def.gauge.steps, e.num_val));
  }
  if (def.hasDuration) {
    const endStr = e.end_time ? fmt(e.end_time) : '';
    if (endStr) metaParts.push(`${startStr} → ${endStr}`);
  }
  if (e.note) metaParts.push(e.note);
  const meta = metaParts.join(' · ');

  // Badge: text value with color from textOptions
  const textLabel = e.text_val ? getTextLabel(e.type, e.text_val) : '';
  const textOpt   = e.text_val && def.textOptions
    ? def.textOptions.find(o => o.value === e.text_val) : null;
  const badgeColor = textOpt?.color || '';
  const badgeHtml  = textLabel
    ? `<span class="entry-badge" style="${badgeColor ? `background:${badgeColor}22;color:${badgeColor}` : ''}">${textLabel}</span>`
    : '';

  // Border color: use type color, or inside/outside for needs
  const locClass = e.text_val && def.insideValue && e.text_val === def.insideValue ? 'inside' : 'outside';
  const entryClass = def.hasDuration ? 'tl-entry-walk' : `tl-entry-bathroom tl-entry-${locClass}`;

  return `<div class="tl-entry ${entryClass}" data-id="${e.id}" style="border-left-color:${def.color || ''}">
            <div class="tl-entry-time">${startStr}</div>
            <div class="tl-entry-icon">${icon}</div>
            <div class="tl-entry-body">
              <div class="tl-entry-title">${title}</div>
              ${meta ? `<div class="tl-entry-meta">${meta}</div>` : ''}
            </div>
            ${badgeHtml}
          </div>`;
}

// ── Premium gate (blurred entries + CTA) ────────────────────────────────────

function _buildPremiumGate(allEntries, visibleCount) {
  const hiddenCount = allEntries.length - visibleCount;
  const fmt = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Show 3 fake blurred entries from hidden data
  const preview = allEntries.slice(visibleCount, visibleCount + 3);
  let blurredHtml = '';
  for (const e of preview) {
    const def = getTypeDef()[e.type] || { label: '?', icon: '?' };
    blurredHtml += `<div class="tl-entry" style="border-left-color:${def.color || ''}">
      <div class="tl-entry-time">${fmt(e.timestamp)}</div>
      <div class="tl-entry-icon">${def.icon}</div>
      <div class="tl-entry-body">
        <div class="tl-entry-title">${def.label}</div>
      </div>
    </div>`;
  }

  return `<div class="premium-gate">
    <div class="blurred-entries">${blurredHtml}</div>
    <div class="premium-cta">
      <p class="premium-cta-text">${hiddenCount} entrée${hiddenCount > 1 ? 's' : ''} masquée${hiddenCount > 1 ? 's' : ''}</p>
      <button class="btn-premium premium-gate-btn">Voir tout l'historique</button>
    </div>
  </div>`;
}
