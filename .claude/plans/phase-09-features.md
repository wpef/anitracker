# Phase 9 — Nouvelles features

> Prerequis : Phase 8 (freemium gate les features custom)
> Risque : moyen — nouvelles UI + logique
> Estimation : large

## Objectif

Ajouter 3 fonctionnalites majeures :
1. Creation de types d'entree custom par l'utilisateur
2. Fenetre de stats configurable
3. Vue Gantt chart de la journee

---

## 9.1 — Types d'entree custom

### Contexte

Actuellement les types sont definis dans `TYPE_DEF` (fichier `js/utils.js`).
L'app est deja data-driven : toute l'UI se genere a partir de `TYPE_DEF`.
L'objectif est de permettre aux utilisateurs premium de creer leurs propres types.

### Taches

#### 9.1.1 Stocker les types custom dans Firebase

**Structure Firebase :**
```
/households/{householdId}/
  customTypes/{typeKey}: {
    key: 'medicament',
    label: 'Medicament',
    icon: '💊',
    color: '#e74c3c',
    gauge: false,
    gaugeLabel: null,
    textOptions: [
      { label: 'Vermifuge', value: 'vermifuge' },
      { label: 'Anti-puce', value: 'antipuce' }
    ],
    duration: false,
    createdAt: '...',
    createdBy: 'uid'
  }
```

#### 9.1.2 Merger les types built-in + custom au boot

**Fichier :** `js/utils.js`

```js
let _mergedTypeDef = { ...TYPE_DEF };

export function registerCustomTypes(customTypes) {
  _mergedTypeDef = { ...TYPE_DEF, ...customTypes };
}

export function getTypeDef() {
  return _mergedTypeDef;
}
```

**Important :** Remplacer TOUTES les references a `TYPE_DEF` dans le code
par `getTypeDef()` pour que les types custom soient pris en compte partout.

#### 9.1.3 UI de creation de type

**Fichier :** `index.html` — ajouter `<section id="page-custom-type">`

Formulaire :
- Nom du type (input text)
- Icone (emoji picker simple — grille d'emojis courants)
- Couleur (palette de 12 couleurs predefinies)
- Activer le gauge ? (toggle) → si oui, label du gauge
- Options textuelles ? (toggle) → si oui, liste dynamique d'options
- Activer la duree ? (toggle)
- Bouton "Creer"

**Fichier :** `js/ui-custom-type.js` (nouveau module)
**Fichier :** `css/style.css` — styles pour le formulaire

#### 9.1.4 Gating : types custom = premium only

**Fichier :** `js/ui-custom-type.js`

```js
import { isPremium } from './permissions.js';

if (!isPremium()) {
  showPremiumCTA('Creez vos propres types avec Premium');
  return;
}
```

---

## 9.2 — Fenetre de stats configurable

### Contexte

Actuellement les stats sont fixes sur 7 jours. L'utilisateur veut
pouvoir choisir la fenetre (7j, 14j, 30j) et swiper entre les periodes.

### Taches

#### 9.2.1 Ajouter un selecteur de periode

**Fichier :** `js/ui-stats.js`

Ajouter un segmented control au-dessus des stats :

```html
<div class="segment stat-period">
  <button class="seg-btn active" data-days="7">7j</button>
  <button class="seg-btn" data-days="14">14j</button>
  <button class="seg-btn" data-days="30">30j</button>
</div>
```

#### 9.2.2 Modifier `getStats()` pour accepter une fenetre

**Fichier :** `js/stats.js`

```js
// Avant : function getStats(entries)
// Apres :
export function getStats(entries, { days = 7, offset = 0 } = {}) {
  // days = nombre de jours dans la fenetre
  // offset = decalage en semaines (0 = courant, 1 = semaine precedente, etc.)
}
```

#### 9.2.3 Swipe entre les periodes (premium only)

**Fichier :** `js/ui-stats.js`

```js
let weekOffset = 0;

// Touch swipe detection
let touchStartX = 0;
statsContainer.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
});
statsContainer.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(diff) > 50 && canSwipeStats()) {
    weekOffset += diff > 0 ? 1 : -1;
    weekOffset = Math.max(0, weekOffset);
    refreshStats();
  }
});
```

Afficher "Semaine du X au Y" avec des fleches `<` `>`.

---

## 9.3 — Vue Gantt chart

### Contexte

Afficher une timeline visuelle de la journee montrant quand chaque
activite a eu lieu, sous forme de barres horizontales colorees.

### Taches

#### 9.3.1 Creer le composant Gantt

**Fichier :** `js/ui-gantt.js` (nouveau module)

Pas besoin de librairie — un rendu HTML/CSS suffit :

```html
<div class="gantt-chart">
  <div class="gantt-axis">
    <!-- Marqueurs horaires : 6h, 8h, 10h, ... 22h -->
  </div>
  <div class="gantt-row" data-type="walk">
    <span class="gantt-label">🐕 Balade</span>
    <div class="gantt-bar" style="left: 25%; width: 8%; background: var(--walk-color)"></div>
    <div class="gantt-bar" style="left: 70%; width: 5%; background: var(--walk-color)"></div>
  </div>
  <div class="gantt-row" data-type="pipi">
    <span class="gantt-label">💧 Pipi</span>
    <div class="gantt-dot" style="left: 30%"></div>
    <div class="gantt-dot" style="left: 65%"></div>
  </div>
  <!-- ... -->
</div>
```

- Les balades (duration) sont des barres (largeur = duree)
- Les events ponctuels (pipi, caca, repas) sont des points/dots
- L'axe couvre 5h30 → 5h30 (fenetre de jour de l'app)

#### 9.3.2 Styles CSS

**Fichier :** `css/style.css`

```css
.gantt-chart { padding: 1rem 0; }
.gantt-row {
  display: flex;
  align-items: center;
  height: 2rem;
  position: relative;
  margin-bottom: .25rem;
}
.gantt-label { width: 5rem; font-size: .75rem; flex-shrink: 0; }
.gantt-track { flex: 1; position: relative; height: 100%; background: var(--card-bg); border-radius: .25rem; }
.gantt-bar {
  position: absolute;
  height: 60%;
  top: 20%;
  border-radius: .25rem;
  opacity: 0.8;
}
.gantt-dot {
  position: absolute;
  width: .5rem;
  height: .5rem;
  border-radius: 50%;
  top: 50%;
  transform: translateY(-50%);
}
```

#### 9.3.3 Integrer dans la page Stats

**Fichier :** `js/ui-stats.js`

Ajouter le Gantt chart sous les stats existantes, dans une carte separee.
Titre : "Journee en cours" ou "Timeline".

#### 9.3.4 Mettre a jour `showcase.html`

Ajouter un exemple statique du Gantt chart avec des donnees fictives.

---

## Verification

- [ ] Creer un type custom "Medicament" → visible dans le type selector
- [ ] Ajouter une entree avec le type custom → sauvegarde OK
- [ ] Supprimer un type custom → les entries existantes restent visibles
- [ ] Selecteur de periode 7j/14j/30j → stats recalculees
- [ ] Swipe stats (premium) → navigation entre les semaines
- [ ] Gantt chart → barres pour les balades, dots pour les autres
- [ ] Gantt chart → reflète les entries du jour
- [ ] Utilisateur freemium ne peut pas creer de type custom
- [ ] showcase.html → Gantt chart visible

## Quand c'est fini

1. Commit : `feat: custom entry types, configurable stats window, Gantt chart`
2. Push
3. Cocher Phase 9 dans `PLAN.md` + date
4. Indiquer Phase 10 comme prochaine
