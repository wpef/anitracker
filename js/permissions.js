/**
 * permissions.js – Freemium gating with THREE tiers: free < paid (Premium) < pro.
 *
 * Tier is per-household, read from the Firebase subscription node.
 * In demo mode everything is unlocked (tier = pro).
 *
 * Tier matrix:
 *   free  : pipi/caca/walk · 7 j history · stats period ≤ 7 j
 *   paid  : + meal/occupation · export · week nav · 90 j history · any stats period
 *   pro   : + custom type creation · UNLIMITED history
 */

import { TEST_MODE } from './test-mode.js';

// ── Tier limits ──────────────────────────────────────────────────────────────
// Types available without premium. meal & occupation stay paid+ (product
// decision). Custom types require pro.
const FREE_TYPES = ['pipi', 'caca', 'walk'];
const FREE_HISTORY_DAYS = 7;
const PAID_HISTORY_DAYS = 90;        // Premium capped at 3 months
const FREE_STATS_PERIOD_DAYS = 7;    // free can't view stats periods > 7 j

const RANK = { free: 0, paid: 1, pro: 2 };

// ── Grandfathering (early adopters) ─────────────────────────────────────────
// Households created strictly BEFORE this date are "founders": premium for
// life, free of charge, never paywalled. Households created on/after pay the
// normal one-shot price. `installed_at` is the household's `settings.createdAt`
// (written at household creation) — no extra field needed.
// ⚠️ Set this to the V2 store-launch date before publishing. MUST stay in sync
// with BASCULE_DATE in functions/index.js (the server grant is authoritative;
// the client grant path is denied by the security rules).
export const BASCULE_DATE = '2026-07-06T00:00:00.000Z';

/**
 * Whether a household qualifies for founder (grandfathered) premium.
 * @param {string|null|undefined} createdAtISO  household settings.createdAt
 * @returns {boolean}
 */
export function isFounder(createdAtISO) {
  if (!createdAtISO) return false;
  const created = new Date(createdAtISO);
  if (isNaN(created)) return false;
  return created < new Date(BASCULE_DATE);
}

// ── State ───────────────────────────────────────────────────────────────────
let _tier = 'free';   // tier from the household subscription
let _isDemo = false;

// ── QA tier override (recette / test build) ─────────────────────────────────
// localStorage.anitracker_tier_override = 'free' | 'paid' | 'pro' simulates a
// tier without a real purchase. SECURITY: honoured only on the web build OR
// when TEST_MODE is on (test APK). In a production native release
// (TEST_MODE=false) it is ignored — it cannot bypass the shipped paywall.
function _tierOverride() {
  const isNative = !!(window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform());
  if (isNative && !TEST_MODE) return null;
  try {
    const v = localStorage.getItem('anitracker_tier_override');
    return (v === 'free' || v === 'paid' || v === 'pro') ? v : null;
  } catch { return null; }
}

/** Effective tier: override > demo(pro) > subscription. */
function _effectiveTier() {
  const ov = _tierOverride();
  if (ov) return ov;
  if (_isDemo) return 'pro';
  return _tier;
}

function _rank() { return RANK[_effectiveTier()] ?? 0; }

/** Set demo mode — unlocks everything (tier = pro). */
export function setDemoMode(demo) {
  _isDemo = demo;
}

/**
 * Set the current tier (called when subscription data changes in Firebase).
 * @param {'free'|'paid'|'pro'} tier
 */
export function setTier(tier) {
  _tier = (tier === 'paid' || tier === 'pro') ? tier : 'free';
}

/** @returns {'free'|'paid'|'pro'} the effective tier. */
export function getTier() {
  return _effectiveTier();
}

/** @returns {boolean} ≥ paid (Premium). Kept as `isPremium` for compatibility. */
export function isPremium() { return _rank() >= RANK.paid; }
/** @returns {boolean} ≥ pro. */
export function isPro() { return _rank() >= RANK.pro; }

/**
 * Check if a type key is available to the current user.
 * Free types always; meal/occupation & custom types require ≥ paid.
 * @param {string} typeKey
 * @returns {boolean}
 */
export function canUseType(typeKey) {
  if (_rank() >= RANK.paid) return true;
  return FREE_TYPES.includes(typeKey);
}

/** @returns {string[]} type keys available in free tier. */
export function getFreeTypes() {
  return [...FREE_TYPES];
}

/** @returns {boolean} Whether the user can CREATE custom types (pro only). */
export function canCreateCustomType() {
  return _rank() >= RANK.pro;
}

/**
 * Max number of history days visible: free 7 · paid 90 · pro ∞.
 * @returns {number}
 */
export function getMaxHistoryDays() {
  const r = _rank();
  if (r >= RANK.pro) return Infinity;
  if (r >= RANK.paid) return PAID_HISTORY_DAYS;
  return FREE_HISTORY_DAYS;
}

/**
 * Max stats-period length (days) the user can select: free 7 · paid/pro ∞.
 * @returns {number}
 */
export function getMaxStatsPeriodDays() {
  return _rank() >= RANK.paid ? Infinity : FREE_STATS_PERIOD_DAYS;
}

/** @returns {boolean} Whether week-by-week stats navigation is available (≥ paid). */
export function canSwipeStats() {
  return _rank() >= RANK.paid;
}

/** @returns {boolean} Whether data export is available (≥ paid). */
export function canExportData() {
  return _rank() >= RANK.paid;
}
