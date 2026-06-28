# AniTracker V2.1 — Plan (refonte Stats + nouveau palier de tarif)

> **Propositions à valider AVANT implémentation.** Rien n'est codé tant que tu
> n'as pas tranché les points marqués 🟠. Structuré pour plan-executor.

---

## Partie A — Refonte de la page Statistiques

### Problèmes constatés (ton retour + analyse code)

1. **Mélange « aujourd'hui » / « période »** : le score du jour, les 3 badges et
   le résumé balades du jour cohabitent avec des graphes 7/14/30 j → confus.
2. **Les graphes n'apparaissent pas** : Chart.js est chargé depuis un **CDN**
   (jsdelivr). Dans la WebView native (ou hors-ligne) le CDN peut échouer →
   `Chart is not defined`, canvas vides. Une app store **ne doit pas** dépendre
   d'un CDN runtime pour son UI cœur.
3. **Aucune clarté pour les free** : la nav hebdo verrouillée s'affiche au milieu
   des graphes, sans expliquer ce que le free voit vraiment.
4. **Vue par défaut** : devrait être **Aujourd'hui**.

### Refonte proposée

**Deux onglets en haut de la page** (segment) :

- **« Aujourd'hui » (défaut)** : score de propreté du jour (anneau), les 3
  badges, résumé balades du jour, **frise Gantt** du jour. Que de l'instantané,
  zéro graphe multi-jours. Lisible d'un coup d'œil.
- **« Période »** : sélecteur 7/14/30 j + nav période (premium), graphe propreté,
  courbe balades, graphes de jauge. Tout le multi-jours regroupé ici.

**Fiabilité des graphes** : **bundler Chart.js en local** (fichier vendor dans
le repo, chargé en asset local + mis au cache SW) au lieu du CDN. Fallback :
message « graphique indisponible » si un canvas ne peut pas rendre.

**Clarté free** : sur « Période », le free voit la période courante avec un
libellé clair (« 7 derniers jours ») et un hint premium discret et
**non-bloquant** pour la navigation historique — pas un contrôle verrouillé au
milieu des graphes. États vides amicaux quand il n'y a pas de données.

### Lanes (plan-executor)

| Lane | Tâche | Risque | Modèle |
|---|---|---|---|
| **S1** | Onglets Aujourd'hui / Période (index.html + ui-stats.js), défaut = Aujourd'hui | moyen | Opus |
| **S2** | Bundler Chart.js en local (vendor + charts.js + SW + retrait du `<script>` CDN) | moyen | Sonnet |
| **S3** | Clarté free (libellés, hint non-bloquant, états vides) | faible | Sonnet |
| **S4** | Recette stats × tiers (navigateur) | faible | Opus |

🟠 **À confirmer** : garder 7/14/30 j accessibles à tous, ou lier la profondeur
de période au palier (voir Partie B) ? Reco : garder l'accès actuel sur les
**graphes** (pas de régression), et ne gater que la profondeur d'**historique**
(liste) comme aujourd'hui.

---

## Partie B — Nouveau palier de tarif (au-dessus de « paid »)

### Structure de tiers proposée

| Capacité | **Free** | **Paid** (one-shot, milieu) | **Pro** (one-shot, haut) |
|---|---|---|---|
| pipi / caca / walk | ✅ | ✅ | ✅ |
| Type **meal**, **occupation** | 🔒 | ✅ | ✅ |
| Navigation stats par semaine | 🔒 | ✅ | ✅ |
| Export des données | 🔒 | ✅ | ✅ |
| **Historique** | 7 jours | **3 mois (90 j)** | **illimité** |
| **Création de types personnalisés** | 🔒 | 🔒 | ✅ |

→ Le **Pro** débloque ce que tu as demandé : **types personnalisés** +
**historique illimité**. Le **Paid** reste utile (types meal/occupation, export,
stats hebdo, 3 mois d'historique) mais est **plafonné à 3 mois** et **sans types
custom**.

> ⚠️ Cohérence avec la règle « jamais payer du gratuit » : tu as déjà accepté
> (étape « garder main tel quel ») que `main` gate l'historique au-delà de 7 j.
> Ce plan **réorganise** ce gating déjà accepté entre Paid/Pro — aucun
> utilisateur payant existant n'est impacté (rien n'est encore publié).

### Impacts techniques

- **`permissions.js`** : passer d'un booléen `isPremium` à un **niveau de tier**
  (`free`=0, `paid`=1, `pro`=2). Nouvelles fonctions : `getTier()`,
  `canCreateCustomType()` (≥ pro), `getMaxHistoryDays()` (7 / 90 / ∞),
  `canUseType`/`canSwipeStats`/`canExportData` (≥ paid). L'override de test gère
  `free|paid|pro`.
- **`household.js` / nœud subscription** : stocker le niveau
  (`plan: 'paid' | 'pro'`). `onSubscriptionChange` mappe vers le tier.
- **`billing.js` / RevenueCat** : **deux produits non-consommables** (paid, pro)
  → deux entitlements (`premium`, `pro`). Gérer l'**upgrade** paid→pro
  (pro supersede paid). Restore gère les deux.
- **Founders** : le grandfathering accorde le tier **Pro** à vie (le plus haut).
- **`ui-premium.js` / modal** : présenter **deux offres** (Paid vs Pro) avec
  leurs avantages ; la CTA contextualise le bon palier (ex. types perso →
  « Passez en Pro »).
- **`ui-custom-type.js`** : la gate passe de `isPremium()` à `canCreateCustomType()`.
- **`test-mode.js`** : switcher `OFF / FREE / PAID / PRO / FOUNDER`.

### Lanes (plan-executor)

| Lane | Tâche | Dépend | Risque | Modèle |
|---|---|---|---|---|
| **T1** | `permissions.js` : modèle de tier + history 7/90/∞ + canCreateCustomType | — | moyen | Opus |
| **T2** | subscription node + onSubscriptionChange (niveau) + founder→pro | T1 | moyen | Opus |
| **T3** | billing.js : 2 produits/entitlements + upgrade + restore | T2 | élevé | Opus |
| **T4** | Modal 2 offres + CTA contextuelle + gate custom-type → pro | T1 | moyen | Sonnet |
| **T5** | test-mode switcher free/paid/pro/founder | T1 | faible | Sonnet |
| **T6** | Recette 4 tiers (free/paid/pro/founder) + non-régression | T1-T5 | moyen | Opus |
| **T7** | security-review (billing multi-produits) | T3 | — | Opus |

### 🟠 Décisions à trancher avant que je code

1. **Noms des paliers** : « Paid » et « Pro » ? (ou « Plus » / « Illimité », etc.)
2. **Plafond Paid** = **3 mois (90 j)** confirmé ?
3. **Founders → Pro** (tier max) à vie, confirmé ?
4. **Prix** des deux achats one-shot (toi seul — montants RevenueCat/Play).
5. Profondeur des **graphes** stats (Partie A 🟠) liée au tier ou libre ?

---

---

# ANNEXES DÉTAILLÉES

## Annexe A.1 — Détail refonte Stats

**`index.html`** (page stats) : ajouter un segment `[Aujourd'hui | Période]` en
haut + 2 conteneurs `#stats-today` / `#stats-period`.
- `#stats-today` : 3 badges du jour, anneau de score, `score-details`, résumé
  balades du jour, **Gantt** du jour.
- `#stats-period` : sélecteur 7/14/30 j, nav période, graphe propreté, courbe
  balades, graphes de jauge.

**`ui-stats.js`** : état `_view = 'today'` (défaut) ; `renderStats()` se scinde
en `renderToday()` / `renderPeriod()` ; ne rend que l'onglet actif ; listener de
switch d'onglet.

**Chart.js en local** : vendoré dans `js/vendor/chart.umd.min.js`, le
`<script src="cdn…chart">` de `index.html` remplacé par le fichier local, ajouté
au cache SW. Fallback « graphique indisponible » si un canvas ne rend pas.
→ corrige définitivement « les graphes n'apparaissent pas ».

**Clarté free** : onglet Période → libellé clair (« 7 derniers jours »), hint
premium **non-bloquant** (pas de contrôle verrouillé au milieu), états vides
amicaux.

---

## Annexe B.1 — TOUS les points de paywall (avant → après)

| Point de gate | Fichier(s) | Avant (free / premium) | Après (free / paid / pro) | Δ |
|---|---|---|---|---|
| Types **meal / occupation** (sélecteur + clic) | `ui-new-entry`, `ui-quick` | 🔒 / ✅ | 🔒 / ✅ / ✅ | — |
| **Création** de type perso (bouton +) | `ui-custom-type` | 🔒 / ✅ | 🔒 / **🔒** / ✅ | **Paid perd → Pro** |
| **Historique** (profondeur) | `ui-history`, `permissions` | 7 j / ∞ | 7 j / **90 j** / ∞ | **Paid plafonné, nouveau mur 90 j** |
| **Nav stats** hebdo | `ui-stats` | 🔒 / ✅ | 🔒 / ✅ / ✅ | — |
| **Export** données | `ui-history` | 🔒 / ✅ | 🔒 / ✅ / ✅ | — |
| **Utiliser** un type perso existant | `canUseType` | premium | ≥ paid 🟠 | à confirmer |

→ **Seules 2 vraies nouveautés** : (a) création de types perso passe à **Pro**
(le Paid la perd) ; (b) historique Paid **plafonné à 90 j** avec un **nouveau
mur** (CTA Pro). **Free strictement inchangé.**

## Annexe B.2 — Messages CTA à modifier

| Déclencheur | Message après |
|---|---|
| Type meal/occupation verrouillé (free) | « Débloquez ce type avec **Premium** » (niveau Paid) |
| Bouton + types perso (free **et paid**) | « Créez vos propres types avec **Pro** » |
| Mur historique côté **free** (7 j) | « **Premium** : 3 mois · **Pro** : illimité » |
| Mur historique côté **paid** (90 j) — NOUVEAU | « Passez en **Pro** pour l'historique illimité » |
| Nav hebdo / export (free) | inchangés (niveau Paid) |

## Annexe B.3 — `permissions.js` (nouvelles signatures)

```
getTier()            → 'free' | 'paid' | 'pro'
isPaid()             → tier ≥ paid
isPro()              → tier ≥ pro
isPremium()          → isPaid()                 // alias compat (call sites existants)
canUseType(key)      → free types ⇒ true ; sinon ≥ paid
canCreateCustomType()→ ≥ pro                     // NOUVEAU (remplace isPremium dans ui-custom-type)
getMaxHistoryDays()  → free 7 · paid 90 · pro ∞
canSwipeStats()      → ≥ paid
canExportData()      → ≥ paid
override test        → 'free' | 'paid' | 'pro'
```

## Annexe B.4 — Billing & subscription

- **RevenueCat** : 2 produits **non-consommables** → entitlements `premium`
  (paid) et `pro`. Tier = `pro` si entitlement pro actif, sinon `paid` si
  `premium` actif, sinon `free`.
- **`households/{id}/subscription`** = `{ plan: 'paid' | 'pro', source, … }`.
  `onSubscriptionChange` mappe `plan` → tier (pro > paid).
- **Upgrade** paid → pro = achat du produit pro (les 2 entitlements coexistent,
  pro l'emporte ; pas de proratisation pour un one-shot).
- **Founders** : le grandfathering écrit `plan:'pro'` (tier max à vie).
- **Modal premium** : 2 offres (Paid / Pro) + CTA contextuelle selon la feature
  demandée. `ui-custom-type` gate sur `canCreateCustomType()`.

## Annexe B.5 — Migration & non-régression

- Aucun utilisateur payant existant (rien n'est publié) → le plafond 90 j et le
  déplacement des types perso n'ont **aucun impact réel**.
- Legacy `plan:'premium'` éventuel (données de test) : traité comme `pro` si
  `source:'founder'`, sinon `paid`.
- **Free strictement inchangé** : pipi/caca/walk, 7 j d'historique, stats de
  base, Gantt, quick — rien retiré.

## Annexe B.6 — Fichiers touchés (récap)

`permissions.js` (cœur tier) · `household.js` (plan paid/pro, founder→pro) ·
`billing.js` (2 produits/entitlements, upgrade, restore) · `ui-premium.js` +
`index.html` (modal 2 offres) · `ui-custom-type.js` (gate → pro) ·
`ui-history.js` (mur 90 j + CTA Pro) · `test-mode.js` (switcher pro) ·
`recette.md` (4 tiers).

---

## Séquencement proposé

1. **Partie A (Stats)** d'abord — corrige un bug visible (graphes), indépendante
   du billing. Livrable rapide et testable.
2. **Partie B (Tiers)** ensuite — touche au billing, nécessite tes décisions 🟠
   + une revue sécurité.

Je peux faire A puis B, ou seulement A pour l'instant. **Dis-moi.**
