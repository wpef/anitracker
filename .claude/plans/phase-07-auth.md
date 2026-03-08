# Phase 7 — Gestion utilisateurs & authentification

> Prerequis : Phases 1-6 (app production-ready)
> Risque : eleve — changement d'architecture de donnees
> Estimation : large

## Objectif

Permettre a des utilisateurs externes de s'inscrire, se connecter, et
gerer leurs propres donnees. Supporter le partage d'entries entre
utilisateurs (ex: un couple partage le meme chien).

---

## Decisions d'architecture a prendre AVANT d'implementer

Demander a l'utilisateur de valider ces choix :

1. **Methode d'auth :** Firebase Authentication (Email/Password + Google Sign-in?)
2. **Structure de donnees Firebase :**
   - Option A : `/users/{uid}/entries/` (donnees par utilisateur)
   - Option B : `/households/{householdId}/entries/` (donnees par foyer)
   - **Recommande :** Option B — permet le partage naturellement
3. **Partage :** Un utilisateur cree un "foyer" → genere un code d'invitation
   → l'autre utilisateur rejoint avec le code → les deux voient les memes entries
4. **Migration :** Les entries existantes (sans auth) doivent etre rattachees
   au premier utilisateur qui se connecte

---

## Taches

### 7.1 Activer Firebase Authentication

**Console Firebase :** Activer les providers Email/Password et Google.

**Fichier :** `js/auth.js` (nouveau module)

```js
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, GoogleAuthProvider,
         signInWithPopup } from 'firebase-auth-sdk-url';

export function initAuth(onLogin, onLogout) { ... }
export function signup(email, password) { ... }
export function login(email, password) { ... }
export function loginWithGoogle() { ... }
export function logout() { ... }
export function getCurrentUser() { ... }
```

---

### 7.2 Restructurer les donnees Firebase

**Structure actuelle :** `/entries/{id}` (flat, pas de notion d'utilisateur)

**Structure cible :**
```
/households/{householdId}/
  entries/{entryId}: { ...entry, createdBy: uid }
  members/{uid}: { email, displayName, role: 'owner'|'member', joinedAt }
  settings/: { householdName, createdAt }

/users/{uid}/
  householdId: "xxx"
  email: "..."
  displayName: "..."
```

**Fichier :** `js/db.js` — modifier `ENTRIES_PATH` pour pointer vers
`/households/{householdId}/entries/` au lieu de `/entries/`.

---

### 7.3 Firebase Security Rules

**Console Firebase :** Remplacer les regles permissives par :

```json
{
  "rules": {
    "households": {
      "$householdId": {
        ".read": "root.child('households/' + $householdId + '/members/' + auth.uid).exists()",
        ".write": "root.child('households/' + $householdId + '/members/' + auth.uid).exists()",
        "members": {
          "$uid": {
            ".write": "$uid === auth.uid || root.child('households/' + $householdId + '/members/' + auth.uid + '/role').val() === 'owner'"
          }
        }
      }
    },
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

### 7.4 Creer l'UI d'inscription / connexion

**Fichier :** `index.html` — ajouter une `<section id="page-auth">` avec :
- Formulaire email/password
- Bouton "Connexion avec Google"
- Toggle inscription/connexion
- Lien "Mot de passe oublie"

**Fichier :** `css/style.css` — styles pour la page auth
(reutiliser les `.card`, `.btn-submit` existants)

**Fichier :** `js/navigation.js` — ajouter la page auth dans le routing

---

### 7.5 Systeme d'invitation (partage de foyer)

**Fichier :** `js/auth.js` ou `js/household.js` (nouveau)

- `createHousehold()` — cree un foyer + ajoute le createur comme owner
- `generateInviteCode()` — genere un code 6 caracteres unique
- `joinHousehold(code)` — rejoint un foyer existant via le code
- Stocker les invitations dans `/invites/{code}: { householdId, createdBy, expiresAt }`

**UI :** Page settings avec "Mon foyer" + "Inviter quelqu'un" + affichage du code

---

### 7.6 Migration des donnees existantes

**Fichier :** `js/db.js` ou `js/auth.js`

Au premier login :
1. Lire `/entries/` (ancien chemin)
2. Si des entries existent et que l'utilisateur n'a pas de foyer :
   - Creer un foyer automatiquement
   - Deplacer les entries vers `/households/{newId}/entries/`
   - Supprimer `/entries/`
3. Afficher un toast "Vos donnees ont ete migrees"

---

## Verification

- [ ] Inscription email/password → compte cree, redirection vers l'app
- [ ] Connexion Google → fonctionne
- [ ] Deconnexion → retour a la page auth
- [ ] Deux utilisateurs dans le meme foyer voient les memes entries
- [ ] Un utilisateur hors du foyer ne peut PAS lire les entries (tester les rules)
- [ ] Migration des anciennes donnees au premier login → tout est la
- [ ] Code d'invitation → le second utilisateur rejoint le foyer
- [ ] Mode demo toujours fonctionnel (pas d'auth en demo)

## Quand c'est fini

1. Commit : `feat: Firebase auth, households, invite system, data migration`
2. Push
3. Cocher Phase 7 dans `PLAN.md` + date
4. Indiquer Phase 8 comme prochaine
