/**
 * ui-premium.js – Reusable premium CTA modal (bottom sheet).
 *
 * Shows a modal with a personalised message, premium advantages,
 * and buttons to start a free trial or subscribe via RevenueCat.
 */

import { $ } from './utils.js';

// ── Modal elements (cached after first call) ────────────────────────────────
let _modal = null;
let _msgEl = null;

function _ensureElements() {
  if (_modal) return;
  _modal = $('premium-modal');
  _msgEl = $('premium-modal-msg');
}

/**
 * Show the premium CTA modal with a custom message.
 * @param {string} message  Contextual message (e.g. "Passez en Premium pour débloquer ce type")
 */
export function showPremiumCTA(message) {
  _ensureElements();
  if (!_modal) return;
  _msgEl.textContent = message || 'Passez en Premium pour tout débloquer';
  _modal.classList.add('open');
  _modal.addEventListener('click', _onBackdropClick);
}

/** Hide the premium CTA modal. */
export function hidePremiumCTA() {
  if (!_modal) return;
  _modal.classList.remove('open');
  _modal.removeEventListener('click', _onBackdropClick);
}

function _onBackdropClick(e) {
  if (e.target === _modal) hidePremiumCTA();
}

// ── Bind static buttons (called once at module load) ────────────────────────
function _bindButtons() {
  $('premium-close-btn')?.addEventListener('click', hidePremiumCTA);
  $('premium-subscribe-btn')?.addEventListener('click', () => {
    // RevenueCat integration — placeholder URL
    // The user will configure RevenueCat and replace this
    window.open('https://app.revenuecat.com', '_blank');
  });
}

_bindButtons();
