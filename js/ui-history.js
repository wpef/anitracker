/**
 * ui-history.js – Rendu de la page Historique (liste chronologique des entrées).
 *
 * Les entrées sont groupées par jour et affichées du plus récent au plus ancien.
 * Un clic sur une entrée ouvre la page d'édition.
 */

import { $, formatDuration, TYPE_DEF, pipiLabel, cacaLabel } from './utils.js';
import { db } from './db-context.js';
import { openEditPage } from './ui-edit.js';

// ── Rendu principal ────────────────────────────────────────────────────────

/** Restitue la liste de l'historique dans le conteneur #entry-list. */
export function renderHistory() {
  // Les enregistrements walk.action='end' (format v1) sont filtrés par normalizeEntry()
  // dans app.js — aucun filtre supplémentaire nécessaire ici.
  const allEntries = db.getAllEntries();
  const container  = $('entry-list');

  if (!allEntries.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🐶</div>
      <p>Aucune entrée pour l'instant.<br>Ajoutez la première !</p>
    </div>`;
    return;
  }

  container.innerHTML = _buildHTML(allEntries);

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
      html += e.type === 'walk' ? _walkRow(e, fmt) : _bathroomRow(e, fmt);
    }
    html += '</div>';
  }
  return html;
}

/** Groupe les entrées par clé de jour (triées desc → groupes du plus récent au plus ancien). */
function _groupByDay(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = _dayKey(new Date(e.timestamp));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return groups;
}

/** @param {Date} d @returns {string} */
function _dayKey(d) {
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function _dayLabel(key, sample, todayKey, yestKey) {
  if (key === todayKey) return "Aujourd'hui";
  if (key === yestKey)  return 'Hier';
  return new Date(sample.timestamp).toLocaleDateString('fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long' });
}

function _walkRow(e, fmt) {
  const dur      = e.duration_min ? formatDuration(e.duration_min) : '';
  const startStr = fmt(e.timestamp);
  const endStr   = e.end_time ? fmt(e.end_time) : '';
  const range    = endStr ? `${startStr} → ${endStr}` : startStr;
  const meta     = [range, e.note].filter(Boolean).join(' · ');
  return `<div class="tl-entry tl-entry-walk" data-id="${e.id}">
            <div class="tl-entry-time">${startStr}</div>
            <div class="tl-entry-icon">🐾</div>
            <div class="tl-entry-body">
              <div class="tl-entry-title">Balade${dur ? ' · ' + dur : ''}</div>
              ${meta ? `<div class="tl-entry-meta">${meta}</div>` : ''}
            </div>
          </div>`;
}

function _bathroomRow(e, fmt) {
  const def      = TYPE_DEF[e.type] || { label: e.type || '?', icon: '?' };
  const icon     = def.icon;
  const title    = def.label ?? '?';
  const locClass = e.text_val === 'inside' ? 'inside' : 'outside';
  const locLabel = e.text_val ? (def.textLabel?.(e.text_val) ?? e.text_val) : '';
  const parts    = [];
  if (e.num_val !== undefined && (e.type === 'pipi' || e.type === 'caca')) {
    parts.push(e.type === 'caca' ? cacaLabel(e.num_val) : pipiLabel(e.num_val));
  }
  if (e.note) parts.push(e.note);
  const meta = parts.join(' · ');
  return `<div class="tl-entry tl-entry-bathroom tl-entry-${locClass}" data-id="${e.id}">
            <div class="tl-entry-time">${fmt(e.timestamp)}</div>
            <div class="tl-entry-icon">${icon}</div>
            <div class="tl-entry-body">
              <div class="tl-entry-title">${title}</div>
              ${meta ? `<div class="tl-entry-meta">${meta}</div>` : ''}
            </div>
            ${locLabel ? `<span class="entry-badge badge-${e.text_val}">${locLabel}</span>` : ''}
          </div>`;
}
