# Server setup — Cloud Functions (RevenueCat webhook + founder grant)

The `subscription` node is **server-authoritative**: the security rules deny all
client writes (see `security-rules.md`), so entitlements are written only by the
Cloud Functions in [`../functions/`](../functions/), which use the Admin SDK.

Two functions:

| Function | Trigger | Writes |
|---|---|---|
| `revenuecatWebhook` | HTTPS POST from RevenueCat | `households/{app_user_id}/subscription` on purchase/refund |
| `grantFounderOnCreate` | RTDB create of `households/{hid}/settings/createdAt` | founder Pro if created before the cutoff (server time) |

## How a purchase becomes an entitlement

1. On Android, `js/billing.js` calls `Purchases.logIn({ appUserID: householdId })`
   so the RevenueCat customer id **is** the household id.
2. The user buys `anitracker_premium` / `anitracker_pro`.
3. RevenueCat POSTs an event to `revenuecatWebhook` with
   `event.app_user_id = householdId` and `entitlement_ids`.
4. The function maps the entitlement (`pro`→`pro`, `premium`→`paid`) and writes
   `households/{householdId}/subscription = { plan, source:'purchase', ... }`.
5. The app's `onSubscriptionChange` listener flips the tier live.

`_grantLocally` in `billing.js` still tries an optimistic client write; the rules
deny it (already `try/catch`), so the webhook is the single source of truth.

## Deploy

Prereqs: Node 20, `npm i -g firebase-tools`, `firebase login`.

```bash
cd functions && npm install && cd ..
firebase use <your-firebase-project-id>     # or: firebase use --add

# Webhook shared secret (RevenueCat sends it in the Authorization header):
firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
#   ...or add REVENUECAT_WEBHOOK_SECRET=... to functions/.env (gitignored)

firebase deploy --only functions,database
```

`firebase deploy --only database` also publishes `database.rules.json` (wired in
`firebase.json`). Deploy the rules and functions **together** so the paywall is
never open while entitlements are already server-only.

> If you use `functions/.env` instead of Secret Manager, read it with
> `process.env.REVENUECAT_WEBHOOK_SECRET` (already how `index.js` reads it) and
> make sure `.env` is gitignored (it is, in `functions/.gitignore`).

## Configure the RevenueCat webhook

1. Deploy → note the function URL:
   `https://<region>-<project>.cloudfunctions.net/revenuecatWebhook`
2. RevenueCat dashboard → **Integrations → Webhooks → + New**.
   - **URL**: the function URL above.
   - **Authorization header**: the exact value you set as
     `REVENUECAT_WEBHOOK_SECRET`.
3. Send a **test event** from RevenueCat → check `firebase functions:log` shows
   `[rc] ... -> paid/pro for <household>` and that
   `households/<id>/subscription` was written.

## Founder cutoff — keep it in sync ⚠️

`BASCULE_DATE` exists in **two** places and they must match:

- `functions/index.js` → `const BASCULE_DATE` (authoritative — server grant)
- `js/permissions.js` → `export const BASCULE_DATE` (client-side helper)

Currently **`2026-07-06T00:00:00.000Z`** (Monday launch). Households created
before it (decided from the trusted server event time, not the client
`createdAt`) get lifetime founder Pro.

> Product note: with 0 existing users, a cutoff equal to launch day grandfathers
> nobody. To reward early adopters, set a **future** cutoff (e.g. `2026-08-06` =
> "everyone in the first month is a founder") in **both** files.

## What is NOT testable here

The end-to-end purchase path (real Google Play purchase → RevenueCat → webhook)
can't be exercised without the Play Console app, the `goog_` production key, and
a signed build. Validate on an internal-testing track, or with RevenueCat's Test
Store, once those exist. The founder trigger can be tested immediately by
creating a household in your dev Firebase project before the cutoff.
