# Phase 4 — Debounce Firebase & optimisation stats

> Prerequis : Phase 3
> Risque : moyen — touche la couche donnees et le calcul de stats
> Estimation : moyen

## Objectif

Reduire les re-renders inutiles causes par les updates Firebase rapides,
et optimiser le calcul de stats en un seul passage sur les donnees.

---

## Taches

### 4.1 Debouncer le callback `onValue`

**Fichier :** `js/db.js`

**Probleme :** Chaque changement Firebase declenche `onValue` → `onUpdate()`
→ re-render complet de la page (stats, historique, charts). Si 5 entries
sont sync en meme temps, on a 5 re-renders en cascade.

**Solution :** Ajouter un debounce simple (pas de dependance externe) :

```js
// En haut du fichier, fonction utilitaire locale
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

Dans `initDB` :
```js
export async function initDB(onUpdate) {
  await migrateFromLocalStorage();

  const debouncedUpdate = typeof onUpdate === 'function'
    ? debounce(onUpdate, 300)
    : null;

  onValue(ref(fbDb, ENTRIES_PATH), snapshot => {
    const data = snapshot.val() || {};
    entriesCache = Object.values(data)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (debouncedUpdate) debouncedUpdate();
  });
}
```

**300ms** est suffisamment court pour sembler instantane, mais regroupe
les updates rapides en un seul re-render.

---

### 4.2 Optimiser `getStats()` en single-pass

**Fichier :** `js/stats.js`

**Probleme actuel :** La fonction fait potentiellement plusieurs `.filter()`
imbriques dans des boucles sur les types et les jours → O(n * k * 7)
ou n = entries, k = nombre de types.

**Solution :** Refactorer en un seul passage :

```js
export function getStats(entries, typeDefs) {
  const now = new Date();
  // Pre-calculer les bornes des 7 fenetres de jours (5h30 → 5h30)
  const dayBounds = [];
  for (let i = 0; i < 7; i++) {
    const start = new Date(now);
    start.setDate(start.getDate() - i);
    start.setHours(5, 30, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    dayBounds.push({ start, end, dayIndex: i });
  }

  // Accumulateurs par jour et par type
  const counters = new Map(); // key: `${dayIndex}_${type}` → count

  // UN SEUL passage sur toutes les entries
  for (const entry of entries) {
    const ts = new Date(entry.timestamp);
    // Trouver dans quelle fenetre de jour tombe cette entree
    for (const { start, end, dayIndex } of dayBounds) {
      if (ts >= start && ts < end) {
        const key = `${dayIndex}_${entry.type}`;
        counters.set(key, (counters.get(key) || 0) + 1);
        // Accumuler aussi les valeurs specifiques (walk duration, gauge, etc.)
        break;
      }
    }
  }

  // Extraire les metriques finales depuis la Map
  // ... (adapter selon la structure de retour actuelle de getStats)
}
```

**Important :** Lire le code actuel de `stats.js` AVANT d'implementer
pour comprendre exactement la structure de retour attendue par `ui-stats.js`.
Ne pas changer l'interface publique — seulement l'implementation interne.

---

### 4.3 Cache les resultats de stats (optionnel)

Si le calcul de stats est toujours appele avec les memes entries
(entre deux updates Firebase), on peut memoizer le resultat :

```js
let _statsCache = { hash: null, result: null };

export function getStats(entries, typeDefs) {
  const hash = entries.length + '_' + (entries[0]?.id || '');
  if (hash === _statsCache.hash) return _statsCache.result;
  // ... calcul ...
  _statsCache = { hash, result };
  return result;
}
```

Le hash est simpliste mais suffisant : si le nombre d'entries ou la
premiere entree change, on recalcule.

---

## Verification

- [ ] Ajouter 3 entries rapidement → un seul re-render visible (pas de flash)
- [ ] Les stats affichees sont identiques avant/apres le refactoring
- [ ] Le score ring et les charts montrent les memes valeurs
- [ ] Performance : ouvrir DevTools > Performance > enregistrer un ajout d'entry
  → le temps de render doit etre < 50ms
- [ ] Tester avec 0 entries, 1 entry, 100+ entries

## Quand c'est fini

1. Commit : `perf: debounce Firebase listener, single-pass stats computation`
2. Push
3. Cocher Phase 4 dans `PLAN.md` + date
4. Indiquer Phase 5 comme prochaine
