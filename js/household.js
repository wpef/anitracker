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

import { getDatabase, ref, set, get, remove }
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
