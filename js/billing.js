/**
 * billing.js – One-shot premium purchase via RevenueCat (Capacitor).
 *
 * Model: a single NON-CONSUMABLE product mapped to the `premium` entitlement.
 * No subscription. Buying it once unlocks premium for life.
 *
 * Platform notes:
 *  - NATIVE (Capacitor Android): talks to the RevenueCat SDK and registers the
 *    real purchase / restore handlers used by the premium CTA modal.
 *  - WEB / DEMO: no-op. ui-premium.js then falls back to an informative toast.
 *
 * Source of truth: the RevenueCat → Firebase webhook writes the household
 * `subscription` node server-side. The client writes here are OPTIMISTIC so the
 * UI unlocks immediately; the webhook reconciles authoritatively. See plan.md.
 *
 * ⚠️ No JS bundler in this project (build.js just copies files). The RevenueCat
 * JS wrapper is therefore loaded as a self-contained ESM bundle from a CDN,
 * mirroring how Firebase is loaded. The native SDK itself is wired by
 * `npx cap sync` from the installed @revenuecat/purchases-capacitor package.
 * Validate this path on the first real device build.
 */

import { setPurchaseHandler, setRestoreHandler, hidePremiumCTA } from './ui-premium.js';
import { showToast } from './toast.js';

// ⚠️ MANUAL ACTION: set this to the RevenueCat *public* Android SDK key before
// the native release (RevenueCat dashboard → Project → API keys). Leaving it
// empty disables purchases (web/demo fallback applies).
const REVENUECAT_ANDROID_API_KEY = '';

// Entitlement identifiers configured in the RevenueCat dashboard (one per tier).
const ENTITLEMENT = { paid: 'premium', pro: 'pro' };

// Product identifiers (one non-consumable per tier) — configure in RC/Play.
const PRODUCT = { paid: 'anitracker_premium', pro: 'anitracker_pro' };

// CDN ESM build of the Capacitor wrapper (deps bundled in).
const RC_MODULE_URL = 'https://esm.sh/@revenuecat/purchases-capacitor@9?bundle';

let _getHouseholdId = null;
let _householdModule = null;

/**
 * Initialise billing. Safe to call on web (no-op).
 *
 * @param {object}   opts
 * @param {() => (string|null)} opts.getHouseholdId  Current household id getter
 * @param {object}   opts.householdModule            The household.js module
 * @returns {Promise<void>}
 */
export async function initBilling({ getHouseholdId, householdModule }) {
  _getHouseholdId = getHouseholdId;
  _householdModule = householdModule;

  if (!_isNative()) return;            // web/demo → CTA falls back to a toast
  if (!REVENUECAT_ANDROID_API_KEY) {
    console.warn('[billing] RevenueCat API key not set — purchases disabled');
    return;
  }

  let Purchases;
  try {
    ({ Purchases } = await import(RC_MODULE_URL));
    await Purchases.configure({ apiKey: REVENUECAT_ANDROID_API_KEY });
  } catch (e) {
    console.error('[billing] RevenueCat init failed', e);
    return;
  }

  // Identify the RevenueCat customer as the household so the webhook can map
  // purchase events to households/{app_user_id}/subscription. Without this the
  // customer is anonymous ($RCAnonymousID) and the webhook cannot attribute the
  // purchase to a household (see functions/index.js). Aliases any purchases made
  // while anonymous onto the household id.
  const hid = _getHouseholdId?.();
  if (hid) {
    try {
      await Purchases.logIn({ appUserID: hid });
    } catch (e) {
      console.warn('[billing] RevenueCat logIn failed', e);
    }
  }

  // Reflect any pre-existing entitlement (e.g. after reinstall) on startup.
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const tier = _entitledTier(customerInfo);
    if (tier) await _grantLocally(tier);
  } catch { /* non-fatal */ }

  setPurchaseHandler((tier) => _buyLifetime(Purchases, tier));
  setRestoreHandler(() => _restore(Purchases));
}

// ── Internals ───────────────────────────────────────────────────────────────

function _isNative() {
  return !!(window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform());
}

/** Highest tier the customer is entitled to ('pro' > 'paid'), or null. */
function _entitledTier(customerInfo) {
  const active = customerInfo?.entitlements?.active || {};
  if (active[ENTITLEMENT.pro]) return 'pro';
  if (active[ENTITLEMENT.paid]) return 'paid';
  return null;
}

async function _buyLifetime(Purchases, tier) {
  const wanted = tier === 'pro' ? 'pro' : 'paid';
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings?.current?.availablePackages || [];
    // Pick the package whose product matches the wanted tier (fallback: first).
    const pkg = pkgs.find(p => p?.product?.identifier === PRODUCT[wanted]) || pkgs[0];
    if (!pkg) { showToast('Offre indisponible pour le moment'); return; }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const granted = _entitledTier(customerInfo);
    if (granted) {
      await _grantLocally(granted);
      hidePremiumCTA();
      showToast((granted === 'pro' ? 'Pro' : 'Premium') + ' débloqué — merci ! 🎉');
    }
  } catch (e) {
    if (e?.userCancelled) return;      // user dismissed the native sheet
    console.error('[billing] purchase failed', e);
    showToast('Achat échoué, réessaie plus tard');
  }
}

async function _restore(Purchases) {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const tier = _entitledTier(customerInfo);
    if (tier) {
      await _grantLocally(tier);
      hidePremiumCTA();
      showToast('Achats restaurés ✓');
    } else {
      showToast('Aucun achat à restaurer');
    }
  } catch (e) {
    console.error('[billing] restore failed', e);
    showToast('Restauration échouée');
  }
}

/**
 * Optimistic local grant. The RevenueCat webhook remains the source of truth.
 * @param {'paid'|'pro'} tier
 */
async function _grantLocally(tier) {
  const hid = _getHouseholdId?.();
  if (!hid || !_householdModule) return;
  try {
    await _householdModule.setPurchaseSubscription(hid, tier);
  } catch { /* webhook will reconcile */ }
}
