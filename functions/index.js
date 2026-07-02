/**
 * AniTracker Cloud Functions (gen 1)
 *
 * Two server-authoritative pieces that write households/{hid}/subscription via
 * the Admin SDK (which bypasses the Realtime Database security rules — clients
 * can never write that node; see database.rules.json / store/security-rules.md):
 *
 *   1. revenuecatWebhook  — HTTPS endpoint called by RevenueCat on purchase
 *      events. Maps the entitlement to a plan and records the subscription for
 *      the household. This is the AUTHORITATIVE source of paid entitlements.
 *
 *   2. grantFounderOnCreate — RTDB trigger. When a household is created BEFORE
 *      the launch cutoff (decided from the trusted SERVER event time, never the
 *      client-supplied createdAt), it grants lifetime "founder" Pro.
 *
 * Deploy + configuration: see store/server-setup.md.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

// ── Config ───────────────────────────────────────────────────────────────────

// Founder cutoff. MUST match BASCULE_DATE in js/permissions.js. Households
// created (server time) strictly before this get lifetime Pro for free.
const BASCULE_DATE = '2026-07-06T00:00:00.000Z';

// Shared secret RevenueCat sends verbatim in the Authorization header
// (RevenueCat dashboard → Integrations → Webhooks → Authorization header value).
// Set with:  firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
// or in functions/.env  (REVENUECAT_WEBHOOK_SECRET=...). If unset, auth is
// skipped and a warning is logged — do NOT ship to production without it.
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || '';

// RevenueCat entitlement identifiers → our internal plan.
const ENTITLEMENT_PLAN = { pro: 'pro', premium: 'paid' };
// Fallback: RevenueCat product identifiers → our internal plan.
const PRODUCT_PLAN = { anitracker_pro: 'pro', anitracker_premium: 'paid' };

// RevenueCat event types that GRANT / REVOKE an entitlement. Our products are
// one-shot non-consumables, so RENEWAL/EXPIRATION are defensive.
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL',
  'PRODUCT_CHANGE', 'UNCANCELLATION', 'TRANSFER',
]);
const REVOKE_EVENTS = new Set([
  'EXPIRATION', 'REFUND', 'CANCELLATION',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_RANK = { paid: 1, pro: 2 };

/** Map a RevenueCat event to our plan ('paid' | 'pro'), or null if none. */
function planFromEvent(ev) {
  const ents = ev.entitlement_ids
    || (ev.entitlement_id ? [ev.entitlement_id] : []);
  if (ents.includes('pro')) return 'pro';
  if (ents.includes('premium')) return 'paid';
  return PRODUCT_PLAN[ev.product_id] || null;
}

/** True if this app_user_id is a real household id (not an anonymous RC id). */
function isHouseholdId(id) {
  return typeof id === 'string' && id.length > 0
    && !id.startsWith('$RCAnonymousID');
}

// ── 1. RevenueCat webhook ────────────────────────────────────────────────────

exports.revenuecatWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  if (WEBHOOK_SECRET) {
    if (req.get('Authorization') !== WEBHOOK_SECRET) {
      console.warn('[rc] rejected: bad Authorization header');
      return res.status(401).send('Unauthorized');
    }
  } else {
    console.warn('[rc] REVENUECAT_WEBHOOK_SECRET not set — auth skipped');
  }

  const event = req.body && req.body.event;
  if (!event || !event.type) {
    return res.status(400).send('No event');
  }

  const hid = event.app_user_id;
  if (!isHouseholdId(hid)) {
    // Anonymous purchases can't be attributed. The app calls Purchases.logIn
    // with the household id (see js/billing.js) so this should be rare.
    console.warn('[rc] ignored: non-household app_user_id', hid);
    return res.status(200).send('Ignored: anonymous user');
  }

  const subRef = admin.database().ref(`households/${hid}/subscription`);
  const current = (await subRef.get()).val();

  // Never touch a founder grant (lifetime, free).
  if (current && current.source === 'founder') {
    return res.status(200).send('Founder grant kept');
  }

  if (GRANT_EVENTS.has(event.type)) {
    const plan = planFromEvent(event);
    if (!plan) {
      console.warn('[rc] grant event without a known entitlement', event.type);
      return res.status(200).send('No matching entitlement');
    }
    // Never downgrade an existing higher tier (e.g. pro -> paid).
    if (current && PLAN_RANK[current.plan] >= PLAN_RANK[plan]) {
      return res.status(200).send('Existing tier kept');
    }
    await subRef.set({
      plan,
      source: 'purchase',
      purchasedAt: new Date().toISOString(),
      rcEvent: event.type,
      rcEventId: event.id || null,
    });
    console.log(`[rc] ${event.type} -> ${plan} for ${hid}`);
    return res.status(200).send('OK');
  }

  if (REVOKE_EVENTS.has(event.type)) {
    if (current) await subRef.remove();
    console.log(`[rc] ${event.type} -> revoked for ${hid}`);
    return res.status(200).send('Revoked');
  }

  return res.status(200).send(`Ignored: ${event.type}`);
});

// ── 2. Founder grant on household creation ───────────────────────────────────

exports.grantFounderOnCreate = functions.database
  .ref('/households/{hid}/settings/createdAt')
  .onCreate(async (snap, context) => {
    // Decide founder status from the TRUSTED server event time, not the
    // client-written createdAt value (which could be back-dated to forge it).
    const serverTime = context.timestamp; // ISO 8601, set by the platform
    if (!serverTime || serverTime >= BASCULE_DATE) return null;

    const subRef = admin.database()
      .ref(`households/${context.params.hid}/subscription`);
    const current = (await subRef.get()).val();

    // Idempotent: never overwrite an existing paid/pro/founder subscription.
    if (current && (current.plan === 'pro' || current.plan === 'paid')) {
      return null;
    }
    await subRef.set({
      plan: 'pro',            // founders get the top tier for life
      source: 'founder',
      grantedAt: new Date().toISOString(),
    });
    console.log(`[founder] granted pro to ${context.params.hid}`);
    return null;
  });
