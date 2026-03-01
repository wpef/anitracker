/**
 * toast.js – Notification toast et indicateur de synchronisation.
 */

import { $ } from './utils.js';

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
  dot.title = state === 'ok'      ? 'Synchronisé'
            : state === 'pending' ? 'Synchronisation…'
                                  : 'Erreur de sync';
}
