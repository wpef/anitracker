<!--
  CAHIER DE LANCEMENT — fichier vivant, mis à jour par Claude à chaque étape.
  Convention de statut : ☐ à faire · ⏳ en cours · ☑ fait (AAAA-MM-JJ) · ⛔ bloqué
  Quand une étape avance : mettre à jour la ligne « Statut », ajouter une entrée
  datée dans le « Journal » de la phase, puis commit + push sur la branche de dev.
-->

# AniTracker — Cahier de lancement production

Guide pas-à-pas pour publier AniTracker sur le Google Play Store, du test sans
paiement jusqu'à la prod. **Chaque phase contient un prompt prêt-à-coller** pour
la reprendre dans une nouvelle conversation Claude Code.

- **Repo** : `wpef/anitracker` · **Branche de dev** : `claude/anitrack-v2-production-yjvzd8`
- **Package Android** : `com.anitracker.app`
- **Produits** : `anitracker_premium` (→ entitlement `premium` → tier *paid*),
  `anitracker_pro` (→ entitlement `pro` → tier *pro*)

## Comment utiliser ce fichier

1. Ouvre une nouvelle conversation Claude Code sur ce repo.
2. Copie le **📋 Prompt** de la phase que tu veux faire.
3. Claude lit ce fichier, exécute l'étape, **met à jour le statut + le journal**,
   puis commit/push. Il te dit ce qu'il attend de toi (valeurs, clics dashboard).
4. Reviens ici : le statut reflète toujours l'avancement réel.

> Règle d'honnêteté : Claude ne coche ☑ que ce qui est réellement vérifié. Ce qui
> n'est testable que de ton côté (achat réel, dashboards) reste ⏳ tant que tu
> n'as pas confirmé.

---

## Tableau de bord

| # | Phase | Statut |
|---|-------|--------|
| 0 | Recette navigateur (gating free/premium/pro) | ☐ |
| 1 | Recette achat simulé (RevenueCat Test Store + APK debug) | ⏳ APK buildé (run #1 vert) ; install + test achat sur device restants |
| 2 | Google Play : app + signing + 1er AAB en test interne | ⏳ compte créé (2026-07-02) |
| 3 | Produits Play + RevenueCat prod + entitlements + clé `goog_` | ☐ |
| 4 | Backend prod : Firebase Auth + règles + Cloud Functions + webhook | ☐ |
| 5 | Recette bout-en-bout depuis le Play Store (License Testers, sans payer) | ☐ |
| 6 | Passage en prod (clé `goog_`, `TEST_MODE=false`, version, privacy, Data Safety) | ☐ |

**État du code (sur `main` sauf mention)** :
- Règles Firebase (`database.rules.json`) : ☑ sur main (PR #60) — **pas déployées**.
- Pièce serveur (`functions/`) + workflow debug (`android-debug.yml`) : ☑ sur
  main (PR #61, 2026-07-02).
- ☑ Branche par défaut du repo basculée sur `main` (2026-07-07) : les workflows
  `android-debug.yml` et `android-release.yml` sont enregistrés et visibles
  dans l'onglet Actions.
- ℹ️ L'intégration GitHub de Claude n'a pas la permission `actions: write`
  (dispatch API → 403) : les workflows se déclenchent **depuis l'UI Actions**
  (bouton « Run workflow »), pas via Claude.

---

## Phase 0 — Recette navigateur (gating)

**Statut : ☐**

**Objectif.** Valider toute la logique freemium (quelles features se verrouillent
par tier) sans rien installer. Gratuit, immédiat, à faire en premier.

**Actions (toi).**
1. Sers la racine du repo en HTTP (ex. `python3 -m http.server` puis ouvre
   `http://localhost:8000/index.html`) dans Chrome.
2. Le switcher **🧪 OFF/FREE/PREMIUM/PRO** est visible (car `TEST_MODE=true`).
3. Pour chaque tier, vérifie le comportement attendu (voir `recette.md` pour les
   assertions détaillées) :
   - **FREE** : seuls pipi/caca/walk ; historique 7 j ; pas d'export ; pas de nav
     période stats ; types meal/occupation verrouillés (cadenas).
   - **PREMIUM** : + meal/occupation, export, nav période, historique 90 j.
   - **PRO** : + création de types perso, historique illimité.

**Vérif.** Aucune feature gratuite de la v1 n'est verrouillée (non-régression).

**Ce que je fais.** Si tu repères un gating faux, dis-le-moi : je corrige dans
`js/permissions.js` (+ `recette.md`).

**Journal.**
- _(vide)_

**📋 Prompt (nouvelle conversation).**
```
Lis store/launch-runbook.md, on fait la Phase 0 (recette navigateur du gating).
Rappelle-moi comment lancer l'app en local, puis attends mes retours tier par
tier (FREE/PREMIUM/PRO). Si je signale un gating incorrect, corrige
js/permissions.js et recette.md. Quand j'ai tout validé, passe la Phase 0 en ☑
avec la date, ajoute une entrée au Journal, commit + push.
```

---

## Phase 1 — Recette achat simulé (Test Store + APK debug)

**Statut : ⏳ (APK debug buildé avec la clé Test Store ; install + test achat sur device restants)**

**Objectif.** Valider le vrai bouton d'achat (`billing.js` → entitlement → toast
→ déblocage) sur ton téléphone, avec des achats **simulés** (RevenueCat Test
Store). Pas de compte Google Play requis, pas de paiement.

**Prérequis.**
- ☑ PR de la branche de dev **mergée** (PR #61, sur main le 2026-07-02).
- ☑ Branche par défaut du repo = `main` (basculée le 2026-07-07) : le bouton
  « Run workflow » est disponible dans l'onglet Actions.
- Firebase : **Auth Email/Password activée** + Realtime DB avec des **règles
  ouvertes** (NE PAS déployer `database.rules.json` maintenant — on veut que
  l'écriture optimiste de `billing.js` fasse basculer le tier sans webhook).

**Actions (toi) — RevenueCat Test Store.**
1. Entitlements avec identifier **`premium`** et **`pro`**.
2. Produits Test Store **`anitracker_premium`** et **`anitracker_pro`**.
3. Attache produit→entitlement (premium→premium, pro→pro).
4. Offering **Current** avec les 2 packages.
5. Récupère la clé publique **`test_...`** (Test Store SDK key).

**Actions (toi) — build & install.**
6. GitHub → **Actions → "Build Android Debug (APK)" → Run workflow** → colle la
   clé `test_...` → lance.
7. Télécharge `anitracker-debug-*.apk` dans les **Artifacts** du run, transfère-le
   sur ton tél, installe (sources inconnues).

**Actions (toi) — test.**
8. 1er lancement : colle ta **config Firebase** dans l'écran de setup.
9. Crée un compte / connecte-toi.
10. Switcher **🧪 FREE/PREMIUM/PRO** → le gating change en direct (test instantané).
11. Switcher sur **OFF** → ouvre la modale premium → **achète** (simulé) → tu dois
    voir « Premium débloqué 🎉 » puis les features se déverrouiller.

**Vérif.** Le toast succès apparaît ; en OFF, après achat, le tier passe à
paid/pro et les features premium se débloquent.

**Ce que je fais.** J'ai livré le workflow d'injection de clé + build. Si le
plugin RevenueCat coince en Test Store, je debug `billing.js`. Je peux aussi
déclencher le workflow à ta place si tu me donnes la clé `test_`.

**Journal.**
- 2026-07-02 : workflow `android-debug.yml` + pièce serveur livrés sur la branche
  de dev (commits `fd299d2`, `60a7799`). En attente de merge + config Test Store.
- 2026-07-02 : PR #61 mergée → workflow + `functions/` sur main (`7fac908`).
  Contenu du workflow vérifié (injection clé `test_` OK, pattern
  `REVENUECAT_ANDROID_API_KEY = ''` présent dans `js/billing.js:29`). **Bloqué** :
  la branche par défaut du repo est `claude/current-v1`, donc GitHub n'expose pas
  `android-debug.yml` (tentative de dispatch → 403). Action : basculer la branche
  par défaut sur `main`, puis relancer.
- 2026-07-07 : branche par défaut basculée sur `main` → workflows debug/release
  enregistrés côté GitHub (vérifié via l'API). Clé Test Store `test_…` reçue.
  Dispatch via l'intégration Claude toujours en 403 (pas de permission
  `actions: write`) → le build se lance depuis l'UI Actions avec la clé.
- 2026-07-07 : run #1 du workflow **vert** (2 min 46, clé injectée). Artifact
  `anitracker-debug-7fac908…` (~6 Mo, expire le 2026-07-21) :
  https://github.com/wpef/anitracker/actions/runs/28867117897. Règles RTDB de
  test (`auth != null`) communiquées. Reste : install APK + recette achat
  simulé sur device (étapes 8-11).

**📋 Prompt (nouvelle conversation).**
```
Lis store/launch-runbook.md, on est en Phase 1 (recette achat via Test Store).
Vérifie que le workflow android-debug.yml est bien sur main et déclenchable.
Guide-moi pour configurer les entitlements/produits Test Store, puis pour lancer
le build et installer l'APK. Si je te donne la clé test_, déclenche le workflow
pour moi. Aide-moi à diagnostiquer si l'achat simulé ne débloque pas le tier.
Mets à jour le statut + le Journal de la Phase 1, commit + push.
```

---

## Phase 2 — Google Play : app + signing + 1er AAB en test interne

**Statut : ⏳ (compte créé 2026-07-02)**

**Objectif.** Créer la fiche app, mettre en place la signature, et uploader un
premier AAB signé sur le canal de **test interne** (obligatoire avant de pouvoir
créer/activer les produits in-app).

**Actions (toi) — Play Console.**
1. **Create app** : nom « AniTracker », langue par défaut FR, type *App*,
   *Free*. Remplis les déclarations initiales.
2. Le **package** `com.anitracker.app` se fixe au 1er upload de l'AAB (rien à
   saisir à la main).
3. Active **Play App Signing** (Google gère la clé de signature d'app ; toi tu
   fournis une **upload key**).

**Actions (toi) — générer l'upload keystore** (sur ta machine, garde-le en lieu
sûr, hors repo) :
```bash
keytool -genkeypair -v -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 9125 -alias upload
# note bien : mot de passe du store, alias (upload), mot de passe de la clé
base64 -w0 upload-keystore.jks > upload-keystore.b64   # (macOS: base64 -i upload-keystore.jks -o upload-keystore.b64)
```

**Actions (toi) — secrets GitHub** (repo → Settings → Secrets and variables →
Actions) :
- `ANDROID_KEYSTORE_BASE64` = contenu de `upload-keystore.b64`
- `ANDROID_KEYSTORE_PASSWORD` = mot de passe du store
- `ANDROID_KEY_ALIAS` = `upload`
- `ANDROID_KEY_PASSWORD` = mot de passe de la clé

**Actions — build AAB signé.**
4. (moi) je peux bumper `versionCode`/`versionName` si besoin (le 1 actuel suffit
   pour le 1er upload).
5. (toi) crée un tag `v1.0.0` (`git tag v1.0.0 && git push origin v1.0.0`) OU
   lance le workflow **"Build Android Release (AAB)"** manuellement → télécharge
   l'AAB dans les Artifacts.
6. (toi) Play Console → **Testing → Internal testing → Create release** → upload
   l'AAB → ajoute des testeurs → publie sur le canal interne.

**Vérif.** L'AAB est accepté par Play (signé), le canal interne a un lien de test.

**Ce que je fais.** Bump de version si demandé ; je vérifie le workflow release ;
je t'aide si l'upload est rejeté (permissions, targetSdk, etc.).

**Journal.**
- 2026-07-02 : compte Google Play Console créé.

**📋 Prompt (nouvelle conversation).**
```
Lis store/launch-runbook.md, on est en Phase 2 (Google Play : app + signing +
1er AAB). Guide-moi pour créer la fiche app, générer l'upload keystore et poser
les 4 secrets GitHub. Bump versionCode/versionName si nécessaire et vérifie le
workflow android-release.yml. Aide-moi à builder l'AAB signé et à l'uploader en
test interne. Mets à jour le statut + le Journal de la Phase 2, commit + push.
```

---

## Phase 3 — Produits Play + RevenueCat prod + clé `goog_`

**Statut : ☐**

**Objectif.** Créer les produits in-app réels, connecter Google Play à
RevenueCat, obtenir la clé publique prod `goog_...`.

**Actions (toi).**
1. Play Console → **Monetize → In-app products** : crée `anitracker_premium` et
   `anitracker_pro` (achat unique / non-consommable), avec prix. Active-les.
   (Nécessite l'AAB de la Phase 2 déjà uploadé, avec la permission Billing —
   fournie par le plugin RevenueCat.)
2. RevenueCat → **Project → add app → Google Play Store** → package
   `com.anitracker.app` + **JSON de service account Google** (droits Play
   Developer API — suivre le guide « Play Service Credentials » de RevenueCat).
3. RevenueCat **importe** les produits Play → crée entitlements **`premium`** /
   **`pro`** → **attache** produit→entitlement → offering **Current**.
4. Récupère la clé publique **`goog_...`** (Project → API keys → clé App Android).

**Vérif.** Les produits Play apparaissent dans RevenueCat, attachés aux
entitlements ; la clé `goog_` existe.

**Ce que je fais.** Je peux te détailler la création du **service account Google**
(le point le plus pénible). Une fois la clé `goog_` obtenue, je la mets dans le
code en Phase 6.

**Journal.**
- _(vide)_

**📋 Prompt (nouvelle conversation).**
```
Lis store/launch-runbook.md, on est en Phase 3 (produits Play + connexion
RevenueCat + clé goog_). Détaille-moi la création du service account Google et
la connexion Play↔RevenueCat, puis la création/attache des entitlements et de
l'offering. Note la clé goog_ que je te donnerai (sans la commiter). Mets à jour
le statut + le Journal de la Phase 3, commit + push.
```

---

## Phase 4 — Backend prod : Firebase Auth + règles + Cloud Functions + webhook

**Statut : ☐**

**Objectif.** Déployer la source de vérité serveur des abonnements et verrouiller
la base. Détails dans `store/server-setup.md` et `store/security-rules.md`.

**Actions (toi).**
1. Firebase Auth : **Email/Password + Google** activés ; domaines autorisés.
2. Déployer functions + règles :
   ```bash
   cd functions && npm install && cd ..
   firebase use <ton-projet>
   firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
   firebase deploy --only functions,database
   ```
3. RevenueCat → **Integrations → Webhooks** : URL de `revenuecatWebhook` +
   header `Authorization` = le secret. Envoie un **test event** et vérifie les
   logs (`firebase functions:log`) + l'écriture de `subscription`.
4. Vérifie la date **`BASCULE_DATE`** (founder) dans `js/permissions.js` **et**
   `functions/index.js` (doivent matcher). Actuellement `2026-07-06`.

**Vérif.** Un event de test RevenueCat écrit bien `households/<id>/subscription` ;
un client authentifié **ne peut pas** écrire ce nœud (Rules Playground).

**Ce que je fais.** Code déjà livré. J'ajuste `BASCULE_DATE` (dis-moi si tu veux
une date future pour récompenser les early adopters), et je t'aide à débugger le
webhook si le tier ne bascule pas.

**Journal.**
- 2026-07-02 : `functions/` + `firebase.json` + `store/server-setup.md` livrés.

**📋 Prompt (nouvelle conversation).**
```
Lis store/launch-runbook.md + store/server-setup.md, on est en Phase 4 (backend
prod). Guide-moi pour activer Firebase Auth, déployer functions+règles, et
configurer le webhook RevenueCat. Confirme/ajuste BASCULE_DATE dans les deux
fichiers. Aide-moi à valider qu'un event de test écrit bien subscription et que
le client ne peut pas l'écrire. Mets à jour le statut + le Journal de la Phase 4,
commit + push.
```

---

## Phase 5 — Recette bout-en-bout depuis le Play Store (sans payer)

**Statut : ☐**

**Objectif.** Valider le vrai chemin complet (achat Play → RevenueCat → webhook →
Firebase → tier) sans être facturé, via les **License Testers**.

**Prérequis.** Phases 2, 3, 4 faites.

**Actions (toi).**
1. Play Console → **Setup → License testing** : ajoute les comptes Google
   testeurs (ils ne sont **pas facturés** sur les achats).
2. Build un AAB (via tag/workflow) **avec la clé `goog_`** intégrée
   (voir Phase 6 pour l'injection) et **`TEST_MODE=false`** (on teste le vrai
   paywall). Uploade-le en test interne.
3. Sur un tél d'un compte testeur : installe depuis le lien interne, connecte-toi,
   achète → l'achat de test se fait, le webhook écrit `subscription`, le tier
   bascule.

**Vérif.** Après achat de test : `households/<id>/subscription` écrit par le
webhook, tier premium/pro actif ; « Restaurer les achats » refonctionne après
réinstall.

**Ce que je fais.** Je prépare le build de cette phase (clé `goog_` +
`TEST_MODE=false`) — c'est le même que la prod, en canal interne.

**Journal.**
- _(vide)_

**📋 Prompt (nouvelle conversation).**
```
Lis store/launch-runbook.md, on est en Phase 5 (recette bout-en-bout depuis le
Play Store avec License Testers). Guide-moi pour ajouter des testeurs, prépare le
build interne (clé goog_ + TEST_MODE=false), et aide-moi à valider le chemin
achat→webhook→tier sans facturation. Mets à jour le statut + le Journal de la
Phase 5, commit + push.
```

---

## Phase 6 — Passage en prod

**Statut : ☐**

**Objectif.** Basculer l'app en production sur le Play Store.

**Actions (moi — code, sur PR).**
1. `js/billing.js` → `REVENUECAT_ANDROID_API_KEY = '<clé goog_>'`.
2. `js/test-mode.js` → `TEST_MODE = false`.
3. `android/app/build.gradle` → bump `versionCode` (+1) / `versionName`.
4. Vérifier `BASCULE_DATE` finale (permissions.js + functions/index.js).

**Actions (toi).**
5. Héberger `privacy.html` à une URL publique ; remplir **Data Safety**
   (`store/data-safety.md`) ; visuels (screenshots, feature graphic 1024×500,
   icône) ; descriptions FR.
6. Tag `v1.0.0` → workflow AAB signé → upload.
7. **Promouvoir** la release du canal interne vers **Production** (ou créer une
   release Production) → soumettre à la revue Google.

**Vérif.** App en revue puis publiée ; achat réel fonctionne ; founders (si date
future) obtiennent Pro.

**Journal.**
- _(vide)_

**📋 Prompt (nouvelle conversation).**
```
Lis store/launch-runbook.md, on est en Phase 6 (passage prod). Applique les
changements code (clé goog_ que je te donne, TEST_MODE=false, bump version,
BASCULE_DATE finale) sur une PR. Rappelle-moi le checklist Play Console (privacy
URL, Data Safety, visuels, promotion en production). Mets à jour le statut + le
Journal de la Phase 6, commit + push.
```

---

## Annexe — rappels utiles

- Ne jamais commiter les clés `goog_`/keystore/JSON service account.
- Chaque upload Play exige un `versionCode` strictement supérieur au précédent.
- `TEST_MODE=false` obligatoire pour toute release destinée à la prod (sinon le
  switcher permet de contourner le paywall depuis l'appareil).
- Ne jamais faire payer une feature gratuite de la v1 (non-régression free).
