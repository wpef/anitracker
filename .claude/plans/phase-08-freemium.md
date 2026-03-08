# Phase 8 — Modele freemium / premium

> Prerequis : Phase 7 (auth + utilisateurs)
> Risque : moyen — logique de gating + integration paiement
> Estimation : large

## Objectif

Mettre en place un systeme freemium ou les utilisateurs gratuits ont
un acces limite, avec des CTAs pour passer en premium. Guider sur les
solutions de paiement a integrer.

---

## Decisions d'architecture a prendre AVANT d'implementer

Demander a l'utilisateur de valider ces choix :

1. **Solution de paiement :**
   - **Stripe** (recommande) — le plus simple pour les abonnements web
   - RevenueCat — si on veut unifier web + iOS + Android (Phase 10)
   - Paddle — alternative a Stripe avec gestion TVA
2. **Modele d'abonnement :**
   - Mensuel ? Annuel ? Les deux ?
   - Prix ?
   - Essai gratuit de X jours ?
3. **Granularite :** Premium par utilisateur ou par foyer ?
   (Recommande : par foyer — si un membre est premium, tout le foyer l'est)

---

## Regles freemium / premium

| Fonctionnalite | Freemium | Premium |
|----------------|----------|---------|
| Types d'entries | pipi, caca, balade, repas | Tous (+ types custom Phase 9) |
| Historique | 7 derniers jours | Illimite |
| Stats | 7 derniers jours | Illimite + swipe semaines |
| Quick entry | Oui | Oui |
| Partage foyer | Oui | Oui |
| Types custom | Non | Oui |
| Export donnees | Non | Oui |

---

## Taches

### 8.1 Module de permissions

**Fichier :** `js/permissions.js` (nouveau module)

```js
/**
 * Manages freemium/premium feature gating.
 * Reads premium status from Firebase user profile.
 */

const FREE_TYPES = ['pipi', 'caca', 'walk', 'repas'];
const FREE_HISTORY_DAYS = 7;

let _isPremium = false;

export function setPremiumStatus(isPremium) {
  _isPremium = isPremium;
}

export function isPremium() {
  return _isPremium;
}

export function canUseType(typeKey) {
  if (_isPremium) return true;
  return FREE_TYPES.includes(typeKey);
}

export function getMaxHistoryDays() {
  return _isPremium ? Infinity : FREE_HISTORY_DAYS;
}

export function canSwipeStats() {
  return _isPremium;
}

export function canExportData() {
  return _isPremium;
}
```

---

### 8.2 Stocker le statut premium dans Firebase

**Structure Firebase :**
```
/households/{householdId}/
  subscription/
    plan: 'free' | 'premium'
    stripeCustomerId: '...'
    stripeSubscriptionId: '...'
    expiresAt: '2026-04-08T...'
    trialEndsAt: '...'
```

**Fichier :** `js/db.js` — ajouter un listener sur le noeud `subscription`
au boot de l'app. Appeler `setPremiumStatus(true/false)` selon le statut.

---

### 8.3 Gating UI — Types d'entries bloques

**Fichier :** `js/ui-new-entry.js` (le segment de type selector)

Pour les types non-disponibles en freemium :
- Ajouter une classe `.locked` sur le bouton
- Ajouter une icone cadenas (emoji ou SVG)
- Au clic sur un type bloque → afficher un modal CTA premium

```js
import { canUseType } from './permissions.js';

// Dans le rendu des boutons de type :
if (!canUseType(typeKey)) {
  btn.classList.add('locked');
  btn.innerHTML += ' 🔒';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    showPremiumCTA('Passez en Premium pour debloquer ce type');
  });
}
```

---

### 8.4 Gating UI — Historique limite

**Fichier :** `js/ui-history.js`

- Filtrer les entries a afficher selon `getMaxHistoryDays()`
- Apres la derniere entry visible, afficher un bloc floute + CTA :

```html
<div class="premium-gate">
  <div class="blurred-entries">
    <!-- 3-4 fausses entries floutees -->
  </div>
  <div class="premium-cta">
    <p>Voir tout l'historique</p>
    <button class="btn-premium">Passer en Premium</button>
  </div>
</div>
```

**Fichier :** `css/style.css` — styles pour `.premium-gate`, `.blurred-entries`,
`.btn-premium`

```css
.blurred-entries {
  filter: blur(6px);
  pointer-events: none;
  user-select: none;
}

.premium-gate {
  position: relative;
  margin-top: 1rem;
}

.premium-cta {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
}

.btn-premium {
  background: linear-gradient(135deg, var(--accent), #f59e0b);
  color: #fff;
  border: none;
  padding: .75rem 2rem;
  border-radius: 2rem;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}
```

---

### 8.5 Gating UI — Stats limitees + swipe

**Fichier :** `js/ui-stats.js`

- Freemium : stats de la semaine en cours uniquement, pas de swipe
- Premium : ajouter un swipe horizontal (touch events) pour naviguer
  entre les semaines. Afficher "Semaine du X au Y" avec fleches.

Pour le gate :
```js
import { canSwipeStats } from './permissions.js';

if (!canSwipeStats()) {
  // Masquer les fleches de navigation semaines
  // Afficher un mini-CTA sous les stats : "Swipez pour voir les semaines precedentes 🔒"
}
```

---

### 8.6 Modal CTA Premium reutilisable

**Fichier :** `js/ui-premium.js` (nouveau module)

```js
export function showPremiumCTA(message) {
  // Afficher un modal-sheet avec :
  // - Le message personnalise
  // - Les avantages premium (liste)
  // - Bouton "Essayer gratuitement X jours" (si trial disponible)
  // - Bouton "S'abonner" → rediriger vers Stripe Checkout
  // - Bouton "Plus tard" → fermer
}
```

**Fichier :** `index.html` — ajouter le markup du modal dans le DOM

---

### 8.7 Integration Stripe (guide)

**Ce que Claude peut faire :**
- Creer le module `js/ui-premium.js` avec le bouton qui redirige vers
  Stripe Checkout
- Preparer l'URL de checkout (necessaire : un backend ou Stripe Payment Links)

**Ce que l'utilisateur doit faire manuellement :**
1. Creer un compte Stripe → dashboard.stripe.com
2. Creer un produit "AniTracker Premium" avec un prix recurent
3. Creer un Payment Link ou configurer Checkout
4. Ajouter un webhook Stripe → Netlify Function (ou service externe)
   qui met a jour `/households/{id}/subscription` dans Firebase
5. Securiser avec des Firebase Security Rules

**Alternative sans backend :**
- Utiliser Stripe Payment Links (lien direct, pas de code serveur)
- Verifier le statut manuellement ou via un webhook Netlify Function

**Claude peut aider a creer la Netlify Function si l'utilisateur le souhaite.**

---

## Verification

- [ ] Utilisateur freemium → seuls pipi/caca/balade/repas visibles
- [ ] Clic sur un type bloque → modal CTA premium
- [ ] Historique freemium → 7 jours + zone floutee avec CTA
- [ ] Stats freemium → pas de swipe semaines
- [ ] Utilisateur premium → tout debloques, swipe stats OK
- [ ] Bouton premium → redirection Stripe Checkout
- [ ] Mode demo → tout accessible (pas de gating en demo)

## Quand c'est fini

1. Commit : `feat: freemium/premium gating with locked types, blurred history, stats limit`
2. Push
3. Cocher Phase 8 dans `PLAN.md` + date
4. Indiquer Phase 9 comme prochaine
