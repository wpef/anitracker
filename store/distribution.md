# AniTracker — Livraison de l'app sur ton téléphone

Trois niveaux, du plus rapide/manuel au plus proche de la prod. Chacun est
indépendant : tu peux t'arrêter au niveau 1 tant que tu es seul à tester.

| Niveau | Canal | Pour qui | Prérequis | Statut code |
|---|---|---|---|---|
| 1 | `scripts/install-apk.sh` (USB + adb) | toi, câble branché | adb + token GitHub | ✅ prêt |
| 2 | Firebase App Distribution | testeurs groupe `internal` | secrets Firebase | ✅ prêt (optionnel, skip auto) |
| 3 | Play Store, canal test interne | testeurs Play | Phases 2-3 du runbook | ⏸️ préparé, dormant |

> ⚠️ **Ne jamais commiter** une clé : keystore `.jks`, JSON de service account
> (Firebase ou Play), clé `goog_`/`test_`. Tout ça vit uniquement dans les
> **secrets GitHub Actions**. Le `.gitignore` bloque déjà les patterns connus.

---

## Niveau 1 — Install USB local (`scripts/install-apk.sh`)

Récupère le dernier APK debug produit par le workflow **android-debug.yml** (via
l'API GitHub) et l'installe sur le téléphone branché en USB avec `adb`. Pas de
cloud, pas d'attente.

### Prérequis (une fois)

1. **adb** (Android Platform Tools) sur ton PATH :
   - macOS : `brew install android-platform-tools`
   - Debian/Ubuntu : `sudo apt install adb`
   - Arch : `sudo pacman -S android-tools`
   Plus `curl`, `jq`, `unzip` (souvent déjà là ; `jq` : `brew/apt/pacman install jq`).
2. **Débogage USB sur le téléphone** :
   - Réglages → À propos → tape 7× sur « Numéro de build » (débloque les options
     dev).
   - Réglages → Options pour les développeurs → active **Débogage USB**.
   - Branche le câble, puis **accepte la fenêtre « Autoriser le débogage USB ? »**
     sur le téléphone. Vérifie avec `adb devices` : l'appareil doit apparaître en
     `device` (pas `unauthorized`).
   - Au 1er install, Android peut demander d'autoriser les installations depuis
     cette source.
3. **Token GitHub** avec accès lecture aux Actions de `wpef/anitracker` (les
   téléchargements d'artifacts sont authentifiés, même sur repo public) :
   - PAT classique : scope `repo` (repo privé) ou `public_repo`.
   - PAT fine-grained : Repository permissions → **Actions : Read-only**.
   - Exporte-le : `export GITHUB_TOKEN=ghp_xxx` (ou `GH_TOKEN`).

### Utilisation

```bash
export GITHUB_TOKEN=ghp_xxx
./scripts/install-apk.sh                  # dernier run réussi → install sur le tél
./scripts/install-apk.sh --run-id 123456  # un run précis
./scripts/install-apk.sh --any-status     # dernier run même s'il a échoué/est en cours
./scripts/install-apk.sh --download-only  # récupère juste l'APK, pas d'install
./scripts/install-apk.sh --serial ABC123  # cible un appareil adb précis
```

Le script trouve le run, télécharge l'artifact `anitracker-debug-*`, le
dézippe, copie l'APK en `./anitracker-debug.apk` (gitignoré) et fait
`adb install -r`.

> ℹ️ L'artifact du workflow expire après 14 jours. S'il n'y a plus rien à
> télécharger, relance d'abord le workflow (Actions → Build Android Debug).

---

## Niveau 2 — Firebase App Distribution (cloud, sans câble)

Après le build, le workflow **android-debug.yml** peut pousser l'APK vers
Firebase App Distribution. Les testeurs du groupe **`internal`** reçoivent une
notif et installent depuis leur téléphone. L'étape est **optionnelle** : sans
les secrets, elle est sautée et le build actuel n'est pas impacté.

### A. Activer App Distribution dans la console Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → ton
   projet AniTracker.
2. Menu **Release & Monitor → App Distribution** → **Get started**.
3. Si l'app Android n'existe pas encore : **Project settings → Add app →
   Android**, package `com.anitracker.app` (le `google-services.json` n'est pas
   requis pour la distribution).
4. Onglet **Testers & Groups → Add group** → nomme-le exactement **`internal`**
   → ajoute ton adresse e-mail (et celles des autres testeurs).

### B. Créer le service account (droits App Distribution)

Firebase s'appuie sur Google Cloud pour l'auth CI.

1. [console.cloud.google.com](https://console.cloud.google.com) → sélectionne le
   **même projet** que Firebase.
2. **IAM & Admin → Service Accounts → Create service account**
   (ex. `anitracker-ci`).
3. Rôle : **Firebase App Distribution Admin**
   (`roles/firebaseappdistro.admin`). Valide.
4. Ouvre le compte → onglet **Keys → Add key → Create new key → JSON** →
   télécharge le fichier. **Garde-le hors du repo.**

### C. Récupérer le FIREBASE_APP_ID

Firebase console → **Project settings → General → Your apps →** l'app Android →
champ **App ID**, de la forme `1:1234567890:android:abcdef012345`.

### D. Poser les secrets GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Contenu |
|---|---|
| `FIREBASE_APP_ID` | l'App ID `1:...:android:...` |
| `FIREBASE_SERVICE_ACCOUNT` | **tout le contenu** du fichier JSON du service account |

> Dès que `FIREBASE_APP_ID` est présent, l'étape s'active au prochain run. S'il
> manque, elle est sautée (build inchangé). Si `FIREBASE_APP_ID` est là mais que
> le JSON manque, l'étape se termine proprement sans erreur.

### E. Lancer et installer

1. GitHub → **Actions → Build Android Debug (APK) → Run workflow** (colle la clé
   `test_` si tu testes le billing, sinon laisse vide).
2. À la fin du run, l'étape « Distribute to Firebase App Distribution » pousse
   l'APK.
3. Sur le **téléphone** : ouvre l'e-mail d'invitation App Distribution (1re fois)
   → suis le lien → installe l'app **App Tester** de Firebase → tu y vois les
   nouvelles versions et tu installes en un tap. Les builds suivants arrivent
   par notif.

---

## Niveau 3 — Play Store, canal de test interne (préparé, DORMANT)

Workflow **android-playstore.yml** : à chaque tag `v*`, il build l'AAB signé et
l'uploade sur le **canal test interne** de Play, en **draft** (tu promeus à la
main). Il est **prêt mais volontairement dormant** : le job d'upload ne tourne
que si le secret `PLAY_SERVICE_ACCOUNT_JSON` existe. Tant que ce n'est pas le
cas, le workflow se termine en vert sans rien toucher — rien à désactiver.

### Dépendances (voir `store/launch-runbook.md`)

- **Phase 2** — obligatoire avant tout upload API :
  - upload keystore généré + les 4 secrets déjà utilisés par
    `android-release.yml` : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
    `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` ;
  - fiche app créée dans Play Console **et un 1er AAB uploadé MANUELLEMENT** une
    fois (Play refuse les uploads par API tant qu'une 1re release manuelle n'a
    pas fixé le package `com.anitracker.app`).
- **Phase 3** — le service account Play :
  - un service account Google avec la **Play Android Developer API** activée et
    la permission **« Release to testing tracks »** (accordée dans Play Console →
    Users and permissions) ;
  - son JSON stocké dans le secret **`PLAY_SERVICE_ACCOUNT_JSON`**.

### Créer le service account Play (Phase 3)

1. Play Console → **Setup → API access** → lie/associe un projet Google Cloud.
2. Google Cloud console → **IAM & Admin → Service Accounts → Create** (ex.
   `anitracker-play-ci`) → **Keys → Add key → JSON** → télécharge (hors repo).
3. Play Console → **Users and permissions → Invite new users** → l'e-mail du
   service account → permission **Release to testing tracks** (au moins sur cette
   app).
4. Repo → **Settings → Secrets → Actions** → `PLAY_SERVICE_ACCOUNT_JSON` = tout
   le JSON.

### Activer

Une fois Phases 2-3 faites et `PLAY_SERVICE_ACCOUNT_JSON` posé :

```bash
git tag v1.0.1 && git push origin v1.0.1
```

→ le workflow build l'AAB signé et l'uploade sur le canal interne en **draft**.
Va dans Play Console → **Testing → Internal testing** pour relire et publier la
release. Rien ne part vers de vrais utilisateurs automatiquement.

> Le statut d'upload est `draft` par sécurité. Passe-le à `completed` dans
> `android-playstore.yml` seulement quand tu veux une publication interne
> automatique à chaque tag.

---

## Récap des secrets GitHub

| Secret | Niveau | Requis pour |
|---|---|---|
| `FIREBASE_APP_ID` | 2 | activer l'upload App Distribution |
| `FIREBASE_SERVICE_ACCOUNT` | 2 | auth App Distribution (JSON) |
| `ANDROID_KEYSTORE_BASE64` | 3 | signer l'AAB (déjà en Phase 2) |
| `ANDROID_KEYSTORE_PASSWORD` | 3 | idem |
| `ANDROID_KEY_ALIAS` | 3 | idem |
| `ANDROID_KEY_PASSWORD` | 3 | idem |
| `PLAY_SERVICE_ACCOUNT_JSON` | 3 | upload Play (arme le workflow dormant) |

Aucun de ces secrets n'apparaît dans le repo — uniquement dans
**Settings → Secrets and variables → Actions**.
