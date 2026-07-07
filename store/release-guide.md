# AniTracker — Guide de publication Play Store (Android)

V2 cible **Android uniquement** (iOS = V3). Build web sans bundler ; le natif est
généré par Capacitor.

> 📲 **Livrer l'app sur ton téléphone pour tester** (install USB local, Firebase
> App Distribution, canal test interne Play) : voir **`store/distribution.md`**.

## 1. Pré-requis (une fois)

- [ ] Compte **Google Play Console** (frais unique 25 $).
- [ ] Compte **RevenueCat** (voir `plan.md` → Actions manuelles / Billing).
- [ ] Projet **Firebase** avec Auth (Email + Google) + Realtime Database.

## 2. Générer la clé de signature (sur ta machine)

```bash
keytool -genkey -v -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 9125 \
  -alias anitracker
```

Garde `upload-keystore.jks` **hors du repo** (déjà gitignoré). Conserve-le en
lieu sûr : le perdre empêche toute mise à jour de l'app.

### Build local signé (optionnel)
Crée `keystore.properties` à la racine (gitignoré) :

```
storeFile=/chemin/absolu/upload-keystore.jks
storePassword=********
keyAlias=anitracker
keyPassword=********
```

Puis :
```bash
npm run sync
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

## 3. Build signé via CI (recommandé)

Workflow : `.github/workflows/android-release.yml` (déclenché par un tag `v*`
ou manuellement). Ajoute ces **secrets GitHub** (Settings → Secrets → Actions) :

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 upload-keystore.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `anitracker` |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

Lance : `git tag v1.0.0 && git push --tags` → l'AAB signé est en artifact.

## 4. À chaque release

- [ ] **`TEST_MODE = false`** dans `js/test-mode.js` (sinon le paywall est
      contournable depuis l'appareil via le switcher de test !).
- [ ] Incrémenter `versionCode` (entier, +1) et `versionName` dans
      `android/app/build.gradle`.
- [ ] Vérifier `BASCULE_DATE` dans `js/permissions.js` (date de bascule founder).
- [ ] Renseigner la clé publique RevenueCat dans `js/billing.js`.

## 5. Fiche du store (assets à fournir)

- [ ] **Icône** 512×512 (déjà présente : `icons/icon-512.png`).
- [ ] **Feature graphic** 1024×500 (à créer).
- [ ] **Screenshots** téléphone (min 2, idéalement 4–8) — pages Rapide, Stats,
      Historique, modal Premium.
- [ ] **Titre** : AniTracker.
- [ ] **Description courte + longue** (FR).
- [ ] **Politique de confidentialité** : URL publique de `privacy.html`.
- [ ] **Data Safety** : voir `store/data-safety.md`.
- [ ] **Catégorie** : Mode de vie / Maison.

## 6. Premier upload

1. Play Console → Créer l'application → FR par défaut.
2. Téléverser l'AAB sur un canal de test interne d'abord.
3. Remplir fiche + Data Safety + politique de confidentialité.
4. Promouvoir en production une fois validé.
