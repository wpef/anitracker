# Instructions pour Claude Code

## ⚠️ Règle OBLIGATOIRE — Service Worker / Cache

**Le hook `pre-commit` bumpe automatiquement `CACHE_NAME` dans `sw.js` à chaque commit.**

- Hook installé dans `.githooks/pre-commit`
- Git configuré avec `git config core.hooksPath .githooks` (config locale du repo)
- Le hook incrémente `anitracker-vN` → `anitracker-v(N+1)` et re-stage `sw.js`

**Si tu travailles sur une nouvelle machine / session :** relancer une seule fois :
```
git config core.hooksPath .githooks
```

Ne jamais modifier `CACHE_NAME` à la main — le hook s'en charge.

---

## Après chaque push

Toujours afficher le lien de création de PR sous forme de bouton markdown :

```
**[→ Créer la PR sur GitHub](https://github.com/wpef/anitracker/pull/new/BRANCH_NAME)**
```

Remplacer `BRANCH_NAME` par le nom de la branche courante (ex: `claude/dog-habit-tracker-g7Eem`).

- `gh` n'est pas disponible dans cet environnement → impossible de créer la PR automatiquement
- Le bouton "voir la PR" généré par Claude Code pointe vers une ancienne PR fermée → l'ignorer
- Toujours fournir le lien `/pull/new/BRANCH` pour que l'utilisateur crée la PR en un clic

## Architecture

### Modules JS (`js/`)

| Module            | Rôle |
|-------------------|------|
| `app.js`          | Boot, setup Firebase, quick-entry URL (`?quick=`), orchestration |
| `db-context.js`   | Singleton `db` populé après dynamic import — partagé par tous les modules |
| `navigation.js`   | `showPage()` + registre de renderers `onShowPage()` |
| `utils.js`        | Helpers DOM (`$`, `setActive`), formatters, **typedefs `Entry`**, `normalizeEntry`, `TYPE_DEF` |
| `toast.js`        | `showToast()`, `setSyncState()` |
| `stats.js`        | `getStats(entries)` — logique pure, zéro DOM, zéro DB. Score propreté = 100 − (dedans/total besoins × 100). Fenêtres 7h→7h (nuit = veille). |
| `charts.js`       | `renderScoreRing/BarChart/LineChart` — wrapper Chart.js |
| `ui-new-entry.js` | Formulaire nouvelle entrée (state local : type/action/location/anchor) |
| `ui-history.js`   | Liste historique groupée par jour |
| `ui-edit.js`      | Page édition + boutons persistants (save/delete/back) |
| `ui-stats.js`     | Page statistiques (appelle stats.js puis charts.js) |
| `db.js`           | Firebase Realtime DB — chargé dynamiquement par app.js |
| `demo-db.js`      | Données démo in-memory — chargé dynamiquement par app.js |

### Pattern `db-context`

`app.js` charge `db.js` ou `demo-db.js` via `import()` dynamique, puis :
```js
Object.assign(db, module); // peuple le singleton partagé
```
Tous les autres modules importent `{ db }` depuis `db-context.js` et appellent
`db.saveEntry()`, `db.getAllEntries()` etc. Les propriétés sont `null` au démarrage
mais peuplées avant tout interaction utilisateur (garantie par boot).

### Pattern navigation / renderer registry

`showPage(id)` appelle `_renderers[id]()` si enregistré — aucun import des modules UI.
`app.js` enregistre les renderers via `onShowPage('stats', renderStats)`.
→ Évite les dépendances circulaires : `ui-edit.js` importe `showPage` sans que
`navigation.js` ait besoin d'importer les modules UI.

### Ordre de `boot()`

1. Vérifie config Firebase → sinon affiche setup screen + mode démo
2. `loadDb()` → `Object.assign(db, module)`
3. `db.initDB(onUpdate)` — `onUpdate` re-rend la page active à chaque sync Firebase
4. `initNewEntry()` — attache les listeners du formulaire une seule fois
5. `showPage('new')`

### Schéma de données

Voir `js/utils.js` — typedefs `BaseEntry`.
Pour tout nouveau type d'entrée, suivre `BaseEntry` (champs `text_val` / `num_val`).
Les types `bathroom` et `walk` sont legacy (champs nommés spécifiques).
