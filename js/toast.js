/**
 * toast.js – Notification toast et indicateur de synchronisation.
 */

import { $ } from './utils.js';
import { db } from './db-context.js';

// ── Toast ──────────────────────────────────────────────────────────────────

let toastTimer;

/**
 * Affiche un message toast pendant 2,5 secondes.
 *
 * @param {string} msg
 */
export function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Sync indicator ─────────────────────────────────────────────────────────

/**
 * Met à jour le point de synchronisation Firebase dans la barre de navigation.
 *
 * @param {'ok'|'pending'|'error'} state
 */
export function setSyncState(state) {
  const dot = $('sync-indicator');
  if (!dot) return;
  dot.className = `sync-dot sync-${state}`;
  let title = { ok: 'Synchronisé', pending: 'Synchronisation…', error: 'Hors ligne' }[state] || '';
  if (state === 'ok' && db.getLastSync) {
    const last = db.getLastSync();
    if (last) {
      const ago = Math.round((Date.now() - last.getTime()) / 60000);
      title += ago < 1 ? ' — à l\'instant' : ` — il y a ${ago} min`;
    }
  }
  dot.title = title;
}
