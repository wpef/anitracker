# Firebase Security Rules — deployment guide

Production Realtime Database rules for AniTracker live in
[`../database.rules.json`](../database.rules.json). This file supersedes the
sketches in `.claude/plans/phase-07-auth.md` / `PLAN.md` (which left `/entries`
world-writable "temporarily"). **Do not ship those sketches.**

## What the rules enforce

| Path | Read | Write |
|---|---|---|
| `users/{uid}` | owner only (`uid === auth.uid`) | owner only |
| `households/{hid}` (cascades to children) | members only | — (see per-child) |
| `households/{hid}/members/{uid}` | members | self, or an `owner` |
| `households/{hid}/settings` | members | members; `createdAt` immutable once set |
| `households/{hid}/entries` | members | members |
| `households/{hid}/customTypes` | members | members (app gates Pro) |
| `households/{hid}/subscription` | members | **denied — server only** |

Every other path is denied by default. All access requires Firebase Auth to be
enabled (Email/Password + Google).

## The important one: `subscription` is server-authoritative

Client code (`billing.js` `_grantLocally`, `app.js` founder grant) tries to
write `subscription` optimistically, but both calls are wrapped in
`try/catch` and documented as "webhook will reconcile". These rules **deny**
that client write on purpose:

- **Paywall integrity.** If members could write `subscription`, anyone could set
  `{ plan: 'pro' }` and unlock Pro for free. Denying client writes closes that
  bypass. Entitlements can only come from trusted server code (Firebase Admin
  SDK), which bypasses rules.
- **No UX regression.** The client writes already fail gracefully, so denying
  them changes nothing the user sees — the tier just arrives from the server a
  moment later.

### Consequence — founder grant must move server-side ⚠️

Grandfathering ("founders" get Pro for life) is currently granted **client-side**
in `app.js` (`setFounderSubscription`). With these rules that write is denied,
so **founders will not receive Pro until a server-side grant exists.** Fold this
into the RevenueCat → Firebase webhook work (production task #4):

- Have the same server (Cloud Function / webhook backend, Admin SDK) that writes
  `households/{hid}/subscription` for purchases also write the founder grant:
  `{ plan: 'pro', source: 'founder', grantedAt: <server time> }`.
- Decide founder status from a **trusted** timestamp (a launch-time snapshot of
  existing households, or the household's server-recorded creation time) — never
  from the client-supplied `settings/createdAt`, which a new user could forge.
- Keep it idempotent: never overwrite an existing `purchase` subscription.

If you prefer to keep the founder grant on the client for launch, replace the
`subscription` rule with a constrained self-grant (founder + `plan:'pro'` +
`!data.exists()`), but note that `settings/createdAt` is client-supplied and can
be back-dated, so a new user could claim founder Pro. The server-side grant is
the recommended, exploit-free option.

## Legacy `/entries` migration

`migrateLegacyEntries()` reads and deletes a flat root `/entries` node. These
rules give root `/entries` **no** rule → denied. That is correct for a fresh
production project. If you migrate an existing project that still holds flat
`/entries` data, run the migration (or a one-off admin script) **before**
deploying these rules, otherwise the client migration will be blocked.

## Keep `createdAt` / `BASCULE_DATE` in sync

`js/permissions.js` `BASCULE_DATE` gates founder status (production task #2).
Once you set the real launch date there, make sure the server founder grant uses
the same cutoff. The rules file does not hardcode the date (founder logic is
server-side), so no change is needed here.

## How to deploy

**Console (simplest):** Firebase Console → Realtime Database → *Rules* tab →
paste the contents of `database.rules.json` → *Publish*.

**CLI:** ensure `firebase.json` points at the file, then:

```jsonc
// firebase.json
{ "database": { "rules": "database.rules.json" } }
```

```bash
firebase deploy --only database
```

## Before you publish — checklist

- [ ] Firebase Auth: Email/Password **and** Google enabled; authorized domains set.
- [ ] Server-side founder grant + RevenueCat webhook in place (task #4) — else
      founders get no Pro.
- [ ] Any legacy flat `/entries` data migrated.
- [ ] Verify a member can read/write their household and **cannot** write
      `households/{hid}/subscription` (Rules Playground: simulate an authed write
      to that path → expect *denied*).
