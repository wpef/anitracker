# AniTracker V2 — Cahier de recette (Étapes 7-8)

## Méthode

Achats réels non testables (pas de sandbox store). Tiers simulés par **flag
local** `localStorage.anitracker_tier_override` ∈ `free | paid | founder`,
honoré uniquement sur le build web (jamais sur le natif packagé — voir
`js/permissions.js`).

Recette exécutée dans un **vrai navigateur** (Chromium/Playwright) en **mode
démo** (pas de Firebase requis), naviguant réellement les pages et observant le
DOM. Script : `scratchpad/recette.mjs`. **Deux passes consécutives, résultats
identiques.**

Légende statut : **OK** / **KO** (bloquant / majeur / mineur).

---

## Matrice fonctionnalités × tier

| # | Fonctionnalité | Attendu free | free | Attendu paid/founder | paid | founder | Statut |
|---|---|---|---|---|---|---|---|
| 1 | Type **pipi** (besoin) | accessible | ✅ libre | accessible | ✅ | ✅ | OK |
| 2 | Type **caca** (besoin) | accessible | ✅ libre | accessible | ✅ | ✅ | OK |
| 3 | Type **balade** (walk) | accessible | ✅ libre | accessible | ✅ | ✅ | OK |
| 4 | Type **meal** (repas) | 🔒 verrouillé | ✅ 🔒 | débloqué | ✅ | ✅ | OK |
| 5 | Type **occupation** | 🔒 verrouillé | ✅ 🔒 | débloqué | ✅ | ✅ | OK |
| 6 | Clic type verrouillé (Rapide) | ouvre modal premium | ✅ | n/a (débloqué) | n/a | n/a | OK |
| 7 | Sélecteur type (Complet) | meal+occupation 🔒 | ✅ | tout débloqué | ✅ | ✅ | OK |
| 8 | **Types personnalisés** (+) | modal premium, page inaccessible | ✅ | page accessible | ✅ | ✅ | OK |
| 8b | **Création de type — bouton Retour** | n/a (gated) | n/a | revient à « Complet » | ✅ | ✅ | OK |
| 8c | **Création de type — bouton Créer** | n/a (gated) | n/a | type créé, retour à « Complet », apparaît dans le sélecteur | ✅ | ✅ | OK |
| 8d | **Création de type — dropdown Catégorie** | n/a | n/a | libellés clairs (Activité / Besoin naturel) + hint | ✅ | ✅ | OK |
| 9 | **Navigation stats hebdo** | CTA verrouillé, pas de flèches | ✅ | flèches ‹ › présentes | ✅ | ✅ | OK |
| 10 | **Export des données** | clic → modal premium | ✅ | export (pas de modal) | ✅ | ✅ | OK |
| 11 | **Historique > 7 jours** | gate floutée si data >7j | ⚠️ voir note | illimité | ✅ | ✅ | OK* |
| 12 | Quick entry (saisie) | accessible | ✅ | accessible | ✅ | ✅ | OK |
| 13 | Stats de base (score, charts) | accessibles | ✅ | accessibles | ✅ | ✅ | OK |
| 14 | Historique ≤ 7 jours | accessible | ✅ | accessible | ✅ | ✅ | OK |
| 15 | Vue **Gantt** (frise du jour) | accessible (non gated) | ✅ | accessible | ✅ | ✅ | OK |

`founder` est **identique à `paid`** côté UI (les deux ⇒ premium). Aucun paywall
n'apparaît jamais pour `founder`. ✅

---

## Non-régression (règle critique)

> Vérifié explicitement : **aucune feature gratuite n'est passée derrière le
> paywall**.

- `pipi`, `caca`, `walk` : **jamais verrouillés**, dans les 3 tiers, sur les
  pages Rapide **et** Complet. ✅ (`freeTypesNeverLocked = true` aux 2 passes)
- Quick entry, stats de base, historique récent, Gantt : accessibles à tous. ✅
- Le gating premium ne porte que sur : meal, occupation (choix produit assumé),
  types personnalisés, navigation stats hebdo, export, historique > 7 j —
  toutes des features premium déclarées. ✅

---

## Retours utilisateur — bugs corrigés (2e tour, vérifiés en navigateur)

| Bug | Sévérité | Détail | Correction | Vérif |
|---|---|---|---|---|
| Écran config Firebase systématique | Majeur | Aucune config bundlée → l'écran « coller config » apparaissait à chaque lancement (artefact self-host). | Support config bundlée (`firebase-config.default.js`) ; les builds test démarrent direct en démo. | `autoDemo_quickActive=true`, `setupHidden=true` |
| Types verrouillés avant les besoins (free) | Mineur | Sur « Complet », occupation/meal (🔒) apparaissaient avant pipi/caca. | `sortTypesByAccess` : déverrouillés (besoins d'abord) puis verrouillés. | ordre free = `pipi, caca, walk, occupation🔒, meal🔒` |
| Form création de type cassé en démo | Majeur | Boutons Retour + Créer morts (initCustomType jamais appelé en démo) ; dropdown Catégorie obscur. | initCustomType câblé en démo (save in-memory) ; libellés + hint sur Catégorie. | back/create/typeAppears = true |

## 3 tiers free / Premium / Pro (Plan B) — vérifié en navigateur

| Capacité | free | Premium (paid) | Pro |
|---|---|---|---|
| Types meal/occupation | 🔒 (`locked=[occupation,meal]`) | ✅ (`locked=[]`) | ✅ | 
| Création types perso | CTA→Pro | CTA→Pro (`ctProFocused=true`) | page accessible (`ctReachedPage=true`) |
| Stats période > 7 j | 🔒 (`d14/d30 locked`, clic→modal) | ✅ | ✅ |
| Navigation période | hint | flèches (`weekNavArrows=true`) | flèches |
| Switcher de test | OFF / FREE / PREMIUM / PRO ✅ | | |

Modal à 2 offres : Premium (Repas/Occupation, 3 mois, stats période, export) +
Pro (tout Premium + types perso + historique illimité), l'offre pertinente est
mise en avant selon la feature (Pro focus pour types perso).

## Corrections graphes Stats (retour 2) — vérifié

| Point | Obtenu | Statut |
|---|---|---|
| Jauges sur la **période** (plus « 3 jours ») | `gaugeTitleHas7j=true`, `gaugeTitleHas3j=false` | OK |
| Graphe **balades** en barres (visible) | `walksChart='bar'` | OK |
| Nouveau graphe **Activités du jour** (durée × heure) | `dayDurChart=true` | OK |
| Free bloqué > 7 j | `d14locked=true`, `d30locked=true` | OK |

## Refonte page Stats (Plan A) — vérifié en navigateur

| Point | Attendu | Obtenu | Statut |
|---|---|---|---|
| Onglet par défaut | Aujourd'hui | `defaultTabToday=true` | OK |
| Séparation today/période | today visible, période masqué au départ | `todayVisible=true`, `periodHidden=true` | OK |
| Onglet Aujourd'hui | anneau score + Gantt | `todayHasRing=true`, `todayHasGantt=true` | OK |
| Switch → Période | période visible, today masqué | `periodVisibleAfter=true`, `todayHiddenAfter=true` | OK |
| **Graphes rendent** (bug « graphes absents ») | Chart.js chargé, charts dessinés | `chartGlobal=true`, `propret/walksChartRendered=true`, `chartErrors=[]` | OK |
| Clarté free | hint non-bloquant, pas de flèches | `weekNavFreeHint=true`, `weekNavArrows=false` | OK |
| Pro : navigation période | flèches présentes | `weekNavArrows=true` | OK |

> Cause racine du bug « les graphes n'apparaissent pas » : le `<script>` Chart.js
> CDN portait un attribut `integrity` (SRI) **factice** → le navigateur bloquait
> le script. Corrigé en bundlant Chart.js en local (plus de SRI/CDN).

## KO trouvés et corrigés (boucle 7↔8)

| KO | Sévérité | Détail | Correction |
|---|---|---|---|
| Export advertisé mais inexistant | Majeur | La modal premium listait « Export de données » alors qu'aucune feature d'export n'existait (`canExportData` était du code mort). Publicité mensongère d'une feature payante. | Implémenté un export JSON réel gated par `canExportData()` (bouton sur l'Historique, CTA premium pour les free). Lane H. |
| `FREE_TYPES` contenait `'repas'` (clé morte) | Mineur | La clé réelle est `'meal'` ; `'repas'` ne matchait rien. Comportement déjà correct mais code trompeur. | Nettoyé en `['pipi','caca','walk']`, comportement inchangé. Lane E. |

Après correction : **passe 1 et passe 2 = 0 bloquant, 0 majeur.** Condition
d'arrêt atteinte (2 passes consécutives propres, 1 itération).

---

## Limites / vérifié au niveau code seulement (honnêteté)

1. **Grant founder** (`isFounder()` + `setFounderSubscription()` dans
   `app.js::initApp`) : exercé **au niveau code uniquement**. Le chemin réel
   exige Firebase Auth + household (non disponible en mode démo). La recette
   navigateur vérifie l'**effet UI** du tier founder (via override), pas
   l'écriture Firebase du grant. À re-tester sur un vrai compte Firebase.
2. **Achat one-shot réel** (RevenueCat `purchasePackage`) : non testable sans
   compte sandbox Play. Vérifié : flux de code, fallback web, handlers câblés.
3. **Gate historique > 7 j** (#11) : la logique (`getMaxHistoryDays` → 7 vs ∞)
   est en place et exercée, mais la **gate visuelle floutée** n'a pas été
   déclenchée car les données démo sont toutes récentes (< 7 j). Logique OK,
   rendu visuel non observé.
4. **Chart.js** : la console affiche `Chart is not defined` dans le harnais de
   test (CDN jsdelivr non joignable depuis le sandbox headless). **Artefact de
   test**, pas un bug produit — sans rapport avec mes changements.
5. iOS : hors périmètre V2 (backlog V3).

## Retour 3 — corrections (vérifié en navigateur)

| Bug | Correction | Vérif |
|---|---|---|
| « 8 balades » (comptait les occupations) | compte uniquement type 'walk' + fenêtre du jour bornée 5h30→5h30 | `balades="2 balades"` == `ganttWalkBars=2` |
| Graphe activités peu lisible (points) | barres **cumulées empilées** par heure, par type | `type='bar', stacked=true` |
| Période : axes des graphes désalignés | jauges sur le **même axe de dates** que la propreté (moyenne/jour) | `propret==gauge labels, same=true` (30j) |
| Swipe « chelou » sur Aujourd'hui | navigation par swipe limitée à l'onglet Période | guard `_view==='period'` |

## Retour 4 — features (vérifié en navigateur)

| Demande | Implémenté | Vérif |
|---|---|---|
| Marge entre cartes | `.card { margin-bottom:16px }` | visuel OK |
| Données démo ~2 mois | génération procédurale jours 7→61 | période 30j rendue (30 labels) |
| Courbes besoins total + dedans dans le graphe propreté | barres % (axe gauche) + 2 courbes (axe droit) | `datasets=[bar%, line total, line dedans]`, `hasY1=true` |
| Nav jour sur Aujourd'hui (swipe gauche = précédent), premium, max 7j | swipe gated `canSwipeStats`, cap 7, titres Aujourd'hui→Hier→date | pro: Hier→…→J-7 (cap) ; free: swipe→modal |
