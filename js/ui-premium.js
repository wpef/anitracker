/**
 * ui-premium.js – Reusable premium CTA modal (bottom sheet).
 *
 * Shows a modal with a personalised message, premium advantages, and a button
 * to unlock premium via a ONE-SHOT purchase (lifetime, no subscription).
 *
 * The actual purchase flow is injected via setPurchaseHandler() — the billing
 * layer (RevenueCat, Lane D) registers the real handler. Until then, the button
 * shows an informative message instead of a broken/placeholder flow.
 */

import { $ } from './utils.js';
import { showToast } from './toast.js';

// ── Modal elements (cached after first call) ────────────────────────────────
let _modal = null;
let _msgEl = null;

// ── Pluggable handlers (set by the billing layer) ───────────────────────────
let _purchaseHandler = null;
let _restoreHandler = null;

/**
 * Register the one-shot purchase handler. Called by the billing layer.
 * @param {(tier: 'paid'|'pro') => (void|Promise<void>)} fn
 */
export function setPurchaseHandler(fn) {
  _purchaseHandler = fn;
}

/**
 * Register the "restore purchases" handler. Called by the billing layer.
 * @param {() => (void|Promise<void>)} fn
 */
export function setRestoreHandler(fn) {
  _restoreHandler = fn;
}

function _ensureElements() {
  if (_modal) return;
  _modal = $('premium-modal');
  _msgEl = $('premium-modal-msg');
}

/**
 * Show the premium CTA modal with a custom message.
 * @param {string} message       Contextual message
 * @param {'paid'|'pro'} [focus]  Highlight a specific offer (e.g. 'pro' for custom types)
 */
export function showPremiumCTA(message, focus) {
  _ensureElements();
  if (!_modal) return;
  _msgEl.textContent = message || 'Passez en Premium pour tout débloquer';
  // Highlight the relevant offer
  _modal.querySelectorAll('.premium-offer').forEach(o =>
    o.classList.toggle('po-focus', !!focus && o.dataset.offer === focus));
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
  // Two offers: each "Débloquer à vie" button carries its tier (data-buy)
  document.querySelectorAll('#premium-modal .po-buy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tier = btn.dataset.buy === 'pro' ? 'pro' : 'paid';
      if (typeof _purchaseHandler === 'function') {
        await _purchaseHandler(tier);
      } else {
        // Billing layer not wired (web/demo build).
        showToast('Achat disponible dans l\'application mobile');
      }
    });
  });
  $('premium-restore-btn')?.addEventListener('click', async () => {
    if (typeof _restoreHandler === 'function') {
      await _restoreHandler();
    } else {
      showToast('Restauration disponible dans l\'application mobile');
    }
  });
}

_bindButtons();
