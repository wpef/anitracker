# Phase 6 — Performance CSS/HTML

> Prerequis : Phase 5
> Risque : nul — uniquement du polish front
> Estimation : petit

## Objectif

Optimiser le chargement initial et les animations pour une experience
fluide, notamment sur les appareils mobiles low-end.

---

## Taches

### 6.1 Ajouter les resource hints CDN

**Fichier :** `index.html` (dans `<head>`, AVANT les balises `<script>`)

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://www.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="dns-prefetch" href="https://www.gstatic.com">
```

**Fichier :** `quick.html` — ajouter les memes hints pour Firebase
(`www.gstatic.com`), pas besoin de jsdelivr (pas de Chart.js).

**Impact :** Economise ~100-300ms au premier chargement en initiant
le handshake DNS+TLS pendant que le HTML est parse.

---

### 6.2 Remplacer `transition: all` par des proprietes specifiques

**Fichier :** `css/style.css`

Chercher toutes les occurrences de `transition: all` ou `transition:all` :

```bash
grep -n "transition.*all" css/style.css
```

Pour chaque occurrence, identifier les proprietes reellement animees
(generalement `background-color`, `color`, `opacity`, `transform`,
`border-color`) et les lister explicitement :

```css
/* Avant */
transition: all .2s;

/* Apres (exemple pour un bouton) */
transition: background-color .2s, color .2s, border-color .2s;
```

**Pourquoi :** `transition: all` force le navigateur a tracker les
transitions sur TOUTES les proprietes CSS, ce qui peut causer des
recalculs de layout inutiles.

---

### 6.3 Ajouter `will-change` sur les elements animes frequemment

**Fichier :** `css/style.css`

**Elements concernes (et seulement ceux-la) :**

```css
#toast {
  will-change: transform, opacity;
}

.modal-sheet {
  will-change: transform;
}
```

**NE PAS ajouter `will-change` partout** — c'est contre-productif.
Seulement sur les elements qui s'animent a chaque interaction utilisateur
(toast qui apparait/disparait, modal sheet qui slide).

---

### 6.4 Lazy-load les modules non-critiques (optionnel)

**Fichier :** `index.html`

Le module principal `js/app.js` importe tout au boot. On peut rendre
certains imports dynamiques pour accelerer le Time-to-Interactive :

```js
// Dans app.js — au lieu de :
import { initStats } from './ui-stats.js';
import { initCharts } from './charts.js';

// Faire un import dynamique quand l'utilisateur clique sur l'onglet Stats :
async function showStats() {
  const { initStats } = await import('./ui-stats.js');
  const { initCharts } = await import('./charts.js');
  // ...
}
```

**Note :** Seulement si le profiling montre que ca vaut le coup.
L'app est deja legere — ne pas sur-optimiser.

---

## Verification

- [ ] Lighthouse Performance score > 90
- [ ] DevTools > Network > Disable cache → les preconnect reduisent le Waterfall
- [ ] Animations fluides a 60fps (DevTools > Performance > Frames)
- [ ] Pas de regression visuelle sur les transitions de boutons
- [ ] Toast apparait/disparait sans saccade

## Quand c'est fini

1. Commit : `perf: resource hints, specific transitions, will-change`
2. Push
3. Cocher Phase 6 dans `PLAN.md` + date
4. Afficher : "Phases 1-6 terminees — l'app est production-ready pour le web!"
5. Indiquer Phase 7 comme prochaine etape (evolution produit)
