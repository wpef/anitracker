# Phase 5 — UX reseau & resilience

> Prerequis : Phase 4
> Risque : moyen — touche l'UI et la gestion d'erreurs
> Estimation : moyen

## Objectif

Donner un feedback clair a l'utilisateur sur l'etat de sa connexion
et gerer les echecs de sauvegarde avec possibilite de retry.

---

## Taches

### 5.1 Detection online/offline avec indicateur visuel

**Fichier :** `js/app.js`

Ajouter les listeners au boot de l'app :

```js
window.addEventListener('offline', () => {
  setSyncState('error');
  showToast('Hors ligne');
});

window.addEventListener('online', () => {
  setSyncState('ok');
  showToast('Reconnecte');
});
```

**Fichier :** `js/toast.js` — s'assurer que `setSyncState` est exporte
et accessible depuis `app.js` (verifier l'import existant).

**Note :** Firebase Realtime DB gere deja la persistence offline et le
re-sync automatique. Ces listeners sont uniquement pour le feedback visuel.
Il n'y a rien a faire cote donnees.

---

### 5.2 Affiner l'indicateur sync pour distinguer les etats

**Fichier :** `js/toast.js` (ou le module qui gere `.sync-dot`)

Actuellement 3 etats : `sync-ok`, `sync-pending`, `sync-error`.
Ajouter un titre (tooltip) sur le dot pour plus de contexte :

```js
export function setSyncState(state) {
  const dot = document.querySelector('.sync-dot');
  if (!dot) return;
  dot.className = 'sync-dot sync-' + state;
  const titles = {
    ok: 'Synchronise',
    pending: 'Synchronisation...',
    error: 'Hors ligne'
  };
  dot.title = titles[state] || '';
}
```

---

### 5.3 Retry automatique sur erreur de sauvegarde

**Fichier :** `js/ui-new-entry.js` (dans le `catch` de `_handleAdd`)

**Probleme :** Quand `db.saveEntry()` echoue, on montre juste une erreur.
L'utilisateur perd son entree.

**Solution :** Retry automatique (1 tentative apres 2s) puis toast :

```js
catch (err) {
  // Premiere tentative echouee — retry apres 2s
  try {
    await new Promise(r => setTimeout(r, 2000));
    await db.saveEntry(entry);
    showToast('Enregistre (2e tentative)');
    return;
  } catch {
    showToast('Echec de sauvegarde — verifiez votre connexion');
    setSyncState('error');
  }
} finally {
  btn.disabled = false;
}
```

**Fichier :** `js/ui-quick.js` — meme pattern dans le handler de save.

---

### 5.4 Afficher "Derniere sync" dans le header (optionnel)

**Fichier :** `js/db.js`

Exporter un timestamp de derniere sync reussie :

```js
let lastSyncAt = null;
export function getLastSync() { return lastSyncAt; }

// Dans le callback onValue :
lastSyncAt = new Date();
```

**Fichier :** `js/app.js` ou `js/toast.js`

Afficher dans le tooltip du sync dot :
`Derniere sync : il y a ${minutesAgo} min`

---

## Verification

- [ ] Couper le WiFi → toast "Hors ligne" + sync dot rouge
- [ ] Reactiver le WiFi → toast "Reconnecte" + sync dot vert
- [ ] Sauvegarder une entry hors ligne → Firebase la sync au retour
- [ ] Forcer une erreur de save (ex: deconnecter Firebase) → retry auto
- [ ] Hover sur le sync dot → tooltip avec l'etat

## Quand c'est fini

1. Commit : `feat: online/offline detection, save retry, sync feedback`
2. Push
3. Cocher Phase 5 dans `PLAN.md` + date
4. Indiquer Phase 6 comme prochaine
