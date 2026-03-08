# Phase 10 — App native & CI/CD

> Prerequis : Phases 7-9 (toutes les features implementees)
> Risque : eleve — nouveau tooling, nouveau workflow
> Estimation : tres large

## Objectif

Publier AniTracker sur l'App Store (iOS) et le Play Store (Android),
et mettre en place un workflow de deploiement continu qui couvre
les 3 plateformes (web, iOS, Android).

---

## Decisions d'architecture a prendre AVANT d'implementer

Demander a l'utilisateur de valider ces choix :

### Approche de build natif

| Option | Avantages | Inconvenients |
|--------|-----------|---------------|
| **Capacitor** (recommande) | Reutilise le code web existant tel quel, maintenu par Ionic, simple a configurer | Moins de controle natif qu'un framework dedie |
| **PWA Builder** | Zero code natif, juste un wrapper | Limitations iOS (pas de push notifs, stockage limite) |
| **React Native / Flutter** | Performance native | Rewrite complet, pas adapte a ce projet |

**Recommandation : Capacitor** — l'app est deja une PWA vanilla JS,
Capacitor wrappe le code web dans une WebView native avec acces aux
APIs natives (push, filesystem, etc.).

### Comptes developeur requis

- **Apple Developer Program** : 99$/an (obligatoire pour l'App Store)
- **Google Play Console** : 25$ one-time (obligatoire pour le Play Store)

---

## Taches

### 10.1 Setup Capacitor

```bash
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init AniTracker com.anitracker.app --web-dir .
npx cap add ios
npx cap add android
```

**Fichiers generes :**
- `capacitor.config.ts` — config Capacitor
- `ios/` — projet Xcode
- `android/` — projet Android Studio
- `package.json` — dependances npm

**Important :** Ajouter dans `.gitignore` :
```
node_modules/
ios/App/Pods/
android/.gradle/
android/app/build/
```

---

### 10.2 Configurer le build iOS

**Fichier :** `ios/App/App/Info.plist`

- Bundle ID : `com.anitracker.app`
- Display name : `AniTracker`
- Version : `1.0.0`

**Actions manuelles (pas automatisables par Claude) :**
1. Ouvrir `ios/App/App.xcworkspace` dans Xcode
2. Configurer le Signing (equipe Apple Developer)
3. Definir les capabilities (push notifications si besoin)
4. Ajouter les icones App Store (1024x1024)
5. Build + Archive + Upload vers App Store Connect

---

### 10.3 Configurer le build Android

**Fichier :** `android/app/build.gradle`

- `applicationId`: `com.anitracker.app`
- `versionCode`: 1
- `versionName`: "1.0.0"

**Actions manuelles :**
1. Ouvrir `android/` dans Android Studio
2. Generer une signing key : `keytool -genkey -v -keystore anitracker.keystore`
3. Configurer le signing dans `build.gradle`
4. Build > Generate Signed Bundle (AAB)
5. Upload vers Google Play Console

---

### 10.4 Workflow CI/CD avec GitHub Actions

**Fichier :** `.github/workflows/deploy.yml` (nouveau)

```yaml
name: Deploy AniTracker

on:
  push:
    branches: [main]

jobs:
  # Job 1 : Deploy web sur Netlify
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=.
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

  # Job 2 : Build Android (AAB)
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx cap sync android
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Build AAB
        working-directory: android
        run: ./gradlew bundleRelease
      - name: Sign AAB
        # Utiliser un secret GitHub pour la keystore
        run: jarsigner -keystore ${{ secrets.ANDROID_KEYSTORE }} ...
      - uses: actions/upload-artifact@v4
        with:
          name: android-aab
          path: android/app/build/outputs/bundle/release/*.aab

  # Job 3 : Build iOS (necessite macOS runner)
  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx cap sync ios
      - name: Build iOS
        run: |
          cd ios/App
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -archivePath App.xcarchive \
            archive
      - name: Export IPA
        run: |
          xcodebuild -exportArchive \
            -archivePath ios/App/App.xcarchive \
            -exportPath ios/App/export \
            -exportOptionsPlist ios/App/ExportOptions.plist
```

---

### 10.5 Gestion des versions

**Fichier :** `package.json`

Utiliser `npm version` pour bumper la version :
```bash
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0
```

**Synchroniser la version dans :**
- `package.json` (source de verite)
- `capacitor.config.ts`
- `manifest.json`
- `ios/App/App/Info.plist`
- `android/app/build.gradle`

Creer un script `scripts/bump-version.sh` qui met a jour tous ces fichiers.

---

### 10.6 Workflow unifie : du commit au deploy

```
commit → push main
  ├── GitHub Actions : deploy web (Netlify)     → 1 min
  ├── GitHub Actions : build Android (AAB)      → 5 min
  └── GitHub Actions : build iOS (IPA)          → 10 min
       ├── Upload Play Store (manual ou Fastlane)
       └── Upload App Store (manual ou Fastlane)
```

**Pour automatiser les uploads store :**
- **Fastlane** (recommande) — outil open-source pour automatiser les
  builds et uploads iOS/Android
- Ajouter `Fastfile` dans `ios/` et `android/`

---

## Ce que Claude peut faire vs ce qui est manuel

| Tache | Claude | Manuel |
|-------|--------|--------|
| Setup Capacitor + config | Oui | — |
| Ecrire le workflow GitHub Actions | Oui | — |
| Configurer les icons et splash screens | Oui | — |
| Script de bump version | Oui | — |
| Creer les comptes Apple/Google | — | Oui |
| Configurer le signing iOS | — | Oui (Xcode) |
| Generer la keystore Android | — | Oui |
| Premiere soumission App Store/Play Store | — | Oui |
| Configurer les secrets GitHub | — | Oui (Settings > Secrets) |

---

## Verification

- [ ] `npx cap sync` → pas d'erreur
- [ ] Build iOS en local → app se lance dans le simulateur
- [ ] Build Android en local → app se lance dans l'emulateur
- [ ] GitHub Actions → les 3 jobs (web, Android, iOS) passent
- [ ] L'app native fonctionne identiquement a la version web
- [ ] Push notifs (si configurees) → recues sur les 2 plateformes
- [ ] Version bump → tous les fichiers mis a jour

## Quand c'est fini

1. Commit : `feat: Capacitor setup, CI/CD workflows for web + iOS + Android`
2. Push
3. Cocher Phase 10 dans `PLAN.md` + date
4. Afficher : "Plan complet termine ! L'app est prete pour un deploiement
   sur les 3 plateformes."
