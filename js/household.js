/**
 * household.js – Household management for multi-user data isolation.
 *
 * Structure in Firebase:
 *   /households/{householdId}/entries/{entryId}  – entry data
 *   /households/{householdId}/members/{uid}      – member info
 *   /households/{householdId}/settings/           – household metadata
 *   /users/{uid}/householdId                     – reverse lookup
 *
 * This module handles creating households, associating users,
 * and migrating legacy flat /entries data.
 */

import { getDatabase, ref, set, get, remove, onValue }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

let _db = null;

/**
 * Initialise the household module with a Firebase database instance.
 * @param {import('firebase/database').Database} database
 */
export function initHousehold(database) {
  _db = database;
}

/**
 * Look up the household ID for a given user.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
export async function getUserHouseholdId(uid) {
  const snap = await get(ref(_db, `users/${uid}/householdId`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Create a new household and add the user as owner.
 * @param {string} uid
 * @param {string} email
 * @param {string} displayName
 * @returns {Promise<string>} The new household ID
 */
export async function createHousehold(uid, email, displayName) {
  const householdId = uid + '_h';

  await set(ref(_db, `households/${householdId}/members/${uid}`), {
    email:      email || '',
    displayName: displayName || '',
    role:       'owner',
    joinedAt:   new Date().toISOString(),
  });

  await set(ref(_db, `households/${householdId}/settings`), {
    householdName: 'Mon foyer',
    createdAt:     new Date().toISOString(),
    createdBy:     uid,
  });

  await set(ref(_db, `users/${uid}`), {
    householdId,
    email:       email || '',
    displayName: displayName || '',
  });

  return householdId;
}

/**
 * Migrate legacy flat /entries to the household structure.
 * Moves all entries from /entries/ to /households/{householdId}/entries/,
 * adding createdBy to each entry.
 *
 * @param {string} householdId
 * @param {string} uid
 * @returns {Promise<number>} Number of entries migrated
 */
export async function migrateLegacyEntries(householdId, uid) {
  const snap = await get(ref(_db, 'entries'));
  if (!snap.exists()) return 0;

  const entries = snap.val();
  const count = Object.keys(entries).length;

  // Write entries under household path
  for (const [id, entry] of Object.entries(entries)) {
    await set(ref(_db, `households/${householdId}/entries/${id}`), {
      ...entry,
      createdBy: uid,
    });
  }

  // Remove old flat path
  await remove(ref(_db, 'entries'));

  return count;
}

/**
 * Returns the entries path for a given household.
 * @param {string} householdId
 * @returns {string}
 */
export function getEntriesPath(householdId) {
  return `households/${householdId}/entries`;
}

/**
 * Read the household creation timestamp (acts as `installed_at` for
 * grandfathering). Written by createHousehold() at first login.
 *
 * @param {string} householdId
 * @returns {Promise<string|null>} ISO timestamp, or null if absent
 */
export async function getHouseholdCreatedAt(householdId) {
  const snap = await get(ref(_db, `households/${householdId}/settings/createdAt`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Read the raw subscription node (or null).
 * @param {string} householdId
 * @returns {Promise<object|null>}
 */
export async function getSubscription(householdId) {
  const snap = await get(ref(_db, `households/${householdId}/subscription`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Grant lifetime founder premium, idempotently.
 *
 * No-op if a premium subscription already exists (never overwrites a
 * `purchase` with `founder`, nor re-stamps an existing `founder`). The grant
 * is a one-shot (no `expiresAt`), so onSubscriptionChange() treats it as
 * active for life.
 *
 * @param {string} householdId
 * @returns {Promise<boolean>} true if a new founder grant was written
 */
export async function setFounderSubscription(householdId) {
  const existing = await getSubscription(householdId);
  if (existing && (existing.plan === 'pro' || existing.plan === 'paid' || existing.plan === 'premium')) {
    return false;
  }
  await set(ref(_db, `households/${householdId}/subscription`), {
    plan:      'pro',            // founders get the top tier for life
    source:    'founder',
    grantedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Record a one-shot purchase (lifetime, no expiry) at the given tier.
 *
 * Optimistic client write — the RevenueCat → Firebase webhook is the
 * authoritative source of truth for entitlements (see plan.md, Lane D).
 *
 * @param {string} householdId
 * @param {'paid'|'pro'} [plan='paid']
 * @returns {Promise<void>}
 */
export async function setPurchaseSubscription(householdId, plan = 'paid') {
  await set(ref(_db, `households/${householdId}/subscription`), {
    plan:        plan === 'pro' ? 'pro' : 'paid',
    source:      'purchase',
    purchasedAt: new Date().toISOString(),
  });
}

/**
 * Map a raw subscription node to a tier ('free' | 'paid' | 'pro').
 * Legacy `plan:'premium'` → 'pro' for founders, else 'paid'.
 * @param {object|null} sub
 * @returns {'free'|'paid'|'pro'}
 */
export function subscriptionTier(sub) {
  if (!sub) return 'free';
  const active = (sub.plan === 'pro' || sub.plan === 'paid' || sub.plan === 'premium')
    && (!sub.expiresAt || new Date(sub.expiresAt) > new Date());
  if (!active) return 'free';
  if (sub.plan === 'pro') return 'pro';
  if (sub.plan === 'premium') return sub.source === 'founder' ? 'pro' : 'paid';
  return 'paid';
}

/**
 * Listen to the household subscription node for tier changes.
 * Calls onChange(tier) — 'free' | 'paid' | 'pro' — on every change.
 *
 * @param {string} householdId
 * @param {(tier: 'free'|'paid'|'pro') => void} onChange
 */
export function onSubscriptionChange(householdId, onChange) {
  const subRef = ref(_db, `households/${householdId}/subscription`);
  onValue(subRef, (snapshot) => {
    onChange(subscriptionTier(snapshot.val()));
  });
}

/**
 * Listen to custom types for a household.
 * Calls onChange with the custom types object whenever it changes.
 *
 * @param {string} householdId
 * @param {(customTypes: Record<string, object>) => void} onChange
 */
export function onCustomTypesChange(householdId, onChange) {
  const ctRef = ref(_db, `households/${householdId}/customTypes`);
  onValue(ctRef, (snapshot) => {
    onChange(snapshot.val() || {});
  });
}

/**
 * Save a custom type definition to Firebase.
 *
 * @param {string} householdId
 * @param {string} typeKey
 * @param {object} typeDef
 * @returns {Promise<void>}
 */
export async function saveCustomType(householdId, typeKey, typeDef) {
  await set(ref(_db, `households/${householdId}/customTypes/${typeKey}`), typeDef);
}

/**
 * Delete a custom type definition from Firebase.
 *
 * @param {string} householdId
 * @param {string} typeKey
 * @returns {Promise<void>}
 */
export async function deleteCustomType(householdId, typeKey) {
  await remove(ref(_db, `households/${householdId}/customTypes/${typeKey}`));
}
