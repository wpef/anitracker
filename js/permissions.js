/**
 * permissions.js – Freemium/premium feature gating.
 *
 * Reads premium status from household subscription data in Firebase.
 * Premium is per-household: if the household has an active subscription,
 * all members get premium access.
 *
 * In demo mode, everything is unlocked (no gating).
 */

// ── Free-tier limits ────────────────────────────────────────────────────────
const FREE_TYPES = ['pipi', 'caca', 'walk', 'repas'];
const FREE_HISTORY_DAYS = 7;

// ── State ───────────────────────────────────────────────────────────────────
let _isPremium = false;
let _isDemo = false;

/**
 * Set demo mode — disables all gating.
 * @param {boolean} demo
 */
export function setDemoMode(demo) {
  _isDemo = demo;
}

/**
 * Update premium status (called when subscription data changes in Firebase).
 * @param {boolean} isPremium
 */
export function setPremiumStatus(isPremium) {
  _isPremium = isPremium;
}

/** @returns {boolean} True if user has premium access (or demo mode). */
export function isPremium() {
  return _isDemo || _isPremium;
}

/**
 * Check if a type key is available to the current user.
 * @param {string} typeKey
 * @returns {boolean}
 */
export function canUseType(typeKey) {
  if (_isDemo || _isPremium) return true;
  return FREE_TYPES.includes(typeKey);
}

/**
 * Returns the list of type keys available in free tier.
 * @returns {string[]}
 */
export function getFreeTypes() {
  return [...FREE_TYPES];
}

/**
 * Max number of history days visible to the current user.
 * @returns {number}
 */
export function getMaxHistoryDays() {
  if (_isDemo || _isPremium) return Infinity;
  return FREE_HISTORY_DAYS;
}

/** @returns {boolean} Whether week-by-week stats navigation is available. */
export function canSwipeStats() {
  return _isDemo || _isPremium;
}

/** @returns {boolean} Whether data export is available. */
export function canExportData() {
  return _isDemo || _isPremium;
}
