/**
 * test-mode.js – In-app QA harness for testing tiers without real purchases.
 *
 * When TEST_MODE is true:
 *   - a floating tier switcher (OFF / FREE / PAID / FOUNDER) is shown;
 *   - the tier override in permissions.js is honoured even on native, so the
 *     same test APK can simulate every tier.
 *
 * ⚠️ PRODUCTION: set TEST_MODE = false before building the store release.
 *    Otherwise the paywall can be bypassed from the device (see release-guide).
 */

// Toggle for test builds. MUST be false for the Play Store release.
export const TEST_MODE = true;

const OVERRIDE_KEY = 'anitracker_tier_override';
// value stored in localStorage → display label. 'paid' = Premium tier.
const TIERS = [
  { v: 'off',  label: 'OFF' },
  { v: 'free', label: 'FREE' },
  { v: 'paid', label: 'PREMIUM' },
  { v: 'pro',  label: 'PRO' },
];

export function isTestMode() {
  return TEST_MODE;
}

/**
 * Build and mount the floating tier switcher. Safe no-op when TEST_MODE off.
 */
export function initTestMode() {
  if (!TEST_MODE) return;
  if (document.querySelector('.test-mode-bar')) return;

  let current;
  try { current = localStorage.getItem(OVERRIDE_KEY) || 'off'; } catch { current = 'off'; }

  const bar = document.createElement('div');
  bar.className = 'test-mode-bar';
  bar.innerHTML = '<span class="test-mode-tag">🧪</span>' +
    TIERS.map(t =>
      `<button data-tier="${t.v}" class="test-mode-btn${t.v === current ? ' active' : ''}">${t.label}</button>`
    ).join('');

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tier]');
    if (!btn) return;
    const t = btn.dataset.tier;
    try {
      if (t === 'off') localStorage.removeItem(OVERRIDE_KEY);
      else localStorage.setItem(OVERRIDE_KEY, t);
    } catch { /* ignore */ }
    // Reload so every TYPE_DEF-driven button + gate rebuilds with the new tier.
    location.reload();
  });

  document.body.appendChild(bar);
  console.warn('[test-mode] ENABLED — set TEST_MODE=false for production builds');
}
