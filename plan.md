# AniTracker V2 — Plan store-ready (one-shot premium + grandfathering)

> Plan destiné au skill **plan-executor**. Lanes parallélisables, dépendances
> explicites, sélection de modèle par complexité. **Scope solo, Android d'abord.**
> Base d'intégration = `main` (cette branche y a été reset).

---

## 0. Décisions actées

| Sujet | Décision |
|---|---|
| Wrapper natif | **Capacitor** (déjà en place sur `main`, Android) |
| Base d'intégration | **`main`**. `current-v1` = polish PWA → backlog V3 |
| Modèle éco | Infra premium de `main` **MAIS achat one-shot** (pas d'abonnement) **+ grandfathering `founder`** |
| Gating types | Inchangé : gratuits = **pipi / caca / walk** ; premium = occupation, meal + features nouvelles |
| Billing provider | **RevenueCat** (non-consommable → entitlement `premium`) |
| Plateforme V2 | **Android d'abord**. iOS → V3 |
| Identité / premium | **Par foyer** (`households/{id}/subscription`) |

---

## Lanes

| Lane | Titre | Dépend de | Risque | Modèle | Statut |
|---|---|---|---|---|---|
| **A** | Réconciliation de base (`main` → branche V2) | — | moyen | Opus | [x] |
| **B** | Abonnement → **achat one-shot** | A | moyen | Opus | [x] |
| **C** | Grandfathering `founder` + `BASCULE_DATE` | A | faible | Sonnet | [x] |
| **D** | RevenueCat réel (SDK Capacitor + webhook) | B,C | élevé | Opus | [x] |
| **E** | Finalisation existant + nettoyage gating | A | faible | Sonnet | [x] |
| **F** | RGPD / permissions / privacy | A | faible | Sonnet | [x] |
| **G** | Build Play (release AAB + signing + CI) | A | moyen | Sonnet | [x] |
| **H** | Recette par tier (mock) — Étapes 7-8 | B,C,D,E | moyen | Opus | [x] |

```
A ──┬──> B ──┬──> D ──> H
    ├──> C ──┘
    ├──> E ──────────> H
    ├──> F
    └──> G
```

---

## Lane B — Abonnement → achat one-shot
`onSubscriptionChange()` supporte déjà le sans-expiration (`!sub.expiresAt` ⇒ actif).
One-shot = écrire `{plan:'premium', source:'purchase'}` **sans `expiresAt`**.
- **B1** `household.js` : prise en compte de `source`.
- **B2** `index.html` modal : « Essai 14j » → « Débloquer à vie / Achat unique ».
- **B3** `ui-premium.js` : retirer placeholder `window.open` ; brancher flow one-shot (Lane D).

## Lane C — Grandfathering `founder`
`settings.createdAt` (écrit dans `createHousehold`) sert d'`installed_at`.
- **C1** `permissions.js` : `BASCULE_DATE` + `isFounder(createdAt)`.
- **C2** `app.js::initApp` : si `createdAt < BASCULE_DATE` & pas de subscription → poser `{plan:'premium', source:'founder'}`.
- **C3** Idempotence : ne jamais écraser `purchase`↔`founder`.

## Lane D — RevenueCat réel
- **D1** `@revenuecat/purchases-capacitor` + `cap sync`.
- **D2** Init SDK (clé publique Android).
- **D3** Bouton → `purchasePackage()` (non-consommable) + « Restaurer ».
- **D4 (sécurité)** Webhook RC→Firebase = source de vérité ; write client = optimiste.
- **D5** `/security-review` sur cette lane.

## Lane E — Finalisation + gating
- **E1** `permissions.js::FREE_TYPES` : nettoyer la string morte `'repas'` (clé réelle `'meal'`). **Comportement inchangé** (meal + occupation restent premium — décision utilisateur). Commenter.
- **E2** Vérifier custom types / gantt / export / stats hebdo / history blur non régressés.
- **E3** MAJ `showcase.html` + `CLAUDE.md` si composants premium manquants.

## Lane F — RGPD / permissions
- **F1** `AndroidManifest.xml` : auditer permissions.
- **F2** Politique de confidentialité hébergée.
- **F3** Data Safety form (contenu).
- **F4** Lien privacy dans l'app.

## Lane G — Build Play
- **G1** Upper keystore (action manuelle).
- **G2** `build.gradle` signingConfigs via secrets.
- **G3** Workflow `bundleRelease` → `.aab` signé.
- **G4** Screenshots + feature graphic + descriptions FR.

## Lane H — Recette par tier (Étapes 7-8)
- **H1** Override dev `localStorage.anitracker_tier_override` (free/paid/founder).
- **H2** `recette.md` : toutes features × {free, paid, founder}.
- **H3** Non-régression : pipi/caca/walk/history-7j/quick/stats-base jamais de paywall.
- **H4** Boucle ≤3 itér., arrêt si 0 bloquant + 0 majeur sur 2 passes.

---

## Candidats premium (Étape 4)
**Nouvelles (premium légitime)** : types personnalisés, vue Gantt, export, stats semaine-par-semaine, historique illimité.
**Existantes gardées premium (choix assumé)** : Occupation 🧩, Repas 🍽️.

## Backlog V3
- iOS (`@capacitor/ios`, build Mac/Xcode).
- Cherry-pick sélectif du polish `current-v1` (dark-mode, crash-proof setup, fix regex config).
- Validation serveur stricte entitlements.
- Suppression règle RTDB `/entries` ouverte (post-migration).
- Multi-animaux / profils.

## Actions manuelles utilisateur
### Billing (D)
- [ ] RevenueCat : 1 produit non-consommable « Premium à vie » + entitlement `premium` + offering.
- [ ] Clé publique RC Android dans l'app.
- [ ] Webhook RevenueCat → Firebase (`households/{id}/subscription`).
### RGPD (F)
- [ ] Héberger privacy policy (URL publique).
- [ ] Data Safety form (Play Console).
### Store (G)
- [ ] Compte Google Play (25 $).
- [ ] Upload keystore + secrets GitHub.
- [ ] Screenshots + feature graphic + descriptions FR.
### Firebase
- [ ] Auth Email/Password + Google ; domaines autorisés.
- [ ] Security Rules households/users.
