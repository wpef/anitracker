# Phase 2 — Service Worker robuste

> Prerequis : Phase 1
> Risque : faible — le SW se met a jour automatiquement
> Estimation : petit

## Objectif

Rendre le Service Worker resilient aux erreurs de cache, eviter de cacher
des reponses invalides, et s'assurer que la liste d'assets est complete.

---

## Taches

### 2.1 Gerer les erreurs dans `cache.addAll()`

**Fichier :** `sw.js` (evenement `install`)

**Probleme :** Si un seul asset echoue dans `cache.addAll()`, TOUT le
caching echoue silencieusement → pas d'offline du tout.

**Solution :** Remplacer `cache.addAll(ASSETS)` par :

```js
await Promise.allSettled(
  ASSETS.map(url =>
    cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
  )
);
```

Cela permet de cacher tous les assets disponibles meme si un echoue.

---

### 2.2 Valider les reponses CDN avant mise en cache

**Fichier :** `sw.js` (handler `fetch`, branche CDN cache-first)

**Probleme :** Si le CDN renvoie une 404 ou 500, la reponse est cachee
indefiniment (cache-first = on ne re-fetch jamais).

**Solution :** Dans le fallback fetch de la branche CDN, verifier `response.ok` :

```js
// Au lieu de : cached || fetch(e.request)
cached || fetch(e.request).then(response => {
  if (response.ok) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
  }
  return response;
})
```

---

### 2.3 Verifier et completer la liste ASSETS

**Fichier :** `sw.js`

1. Lister tous les fichiers reellement importes/utilises par l'app :
   - `index.html`, `quick.html` (si on veut le cache offline)
   - Tous les modules JS dans `js/`
   - `css/style.css`
   - `manifest.json`
   - `/icons/icon-192.png`, `/icons/icon-512.png`
2. Comparer avec la liste `ASSETS` actuelle dans `sw.js`
3. Ajouter les fichiers manquants, retirer ceux qui n'existent plus

**Methode de verification :**
```bash
# Lister les fichiers references
grep -oP "'/[^']+'" sw.js | sort
# Lister les fichiers reels
find . -name '*.js' -o -name '*.html' -o -name '*.css' -o -name '*.png' | sort
```

---

### 2.4 Ajouter une page de fallback offline (optionnel)

Si un utilisateur navigue vers une URL non-cachee en offline, il voit
une page blanche. Ajouter un fallback minimal :

**Fichier :** `sw.js` (dans le handler fetch, apres le catch)

```js
.catch(() => caches.match('/index.html'))
```

L'app etant une SPA, `index.html` est un fallback raisonnable pour
toute requete de navigation echouee.

---

## Verification

- [ ] Ouvrir DevTools > Application > Service Workers → SW installe sans erreur
- [ ] DevTools > Application > Cache Storage → tous les assets listes sont presents
- [ ] Mettre le reseau en offline → l'app se charge entierement
- [ ] Simuler un CDN down (bloquer jsdelivr dans DevTools) → les assets caches sont servis
- [ ] Verifier la console : pas de `[SW] Failed to cache` en conditions normales

## Quand c'est fini

1. Commit : `fix: robust SW caching with error handling and response validation`
2. Push
3. Cocher Phase 2 dans `PLAN.md` + date
4. Indiquer Phase 3 comme prochaine
