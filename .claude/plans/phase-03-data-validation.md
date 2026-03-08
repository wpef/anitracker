# Phase 3 — Validation des donnees

> Prerequis : Phase 2
> Risque : faible — ajout de gardes, pas de changement de logique
> Estimation : moyen

## Objectif

Empecher la corruption de donnees en validant les entrees avant
sauvegarde, et eviter les double-saves accidentels.

---

## Taches

### 3.1 Prevention des double-saves (formulaire complet)

**Fichier :** `js/ui-new-entry.js` (fonction `_handleAdd`)

**Probleme :** `ui-quick.js` desactive le bouton pendant le save
(lignes 167-169), mais `ui-new-entry.js` ne le fait pas → double-tap
= double entree.

**Solution :**
```js
async function _handleAdd() {
  const btn = $('btn-add');        // ou le selecteur du bouton submit
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    // ... logique existante de save ...
  } catch (err) {
    // ... gestion erreur existante ...
  } finally {
    btn.disabled = false;
  }
}
```

---

### 3.2 Fonction de validation commune

**Fichier :** `js/utils.js` (ajouter a la fin, exporter)

Creer une fonction `validateEntry(entry, typeDef)` reutilisable :

```js
/**
 * Validates an entry before save. Returns null if valid,
 * or a French error message string if invalid.
 */
export function validateEntry(entry, typeDef) {
  // num_val in range
  if (typeDef.gauge && (entry.num_val < 0 || entry.num_val > 100))
    return 'Valeur hors limites (0-100)';

  // text_val matches textOptions
  if (typeDef.textOptions) {
    const validValues = typeDef.textOptions.map(o => o.value);
    if (entry.text_val && !validValues.includes(entry.text_val))
      return 'Option invalide';
  }

  // note max length
  if (entry.note && entry.note.length > 500)
    return 'Note trop longue (max 500 caracteres)';

  // future date check (5 min tolerance)
  const ts = new Date(entry.timestamp).getTime();
  if (ts > Date.now() + 5 * 60 * 1000)
    return 'La date ne peut pas etre dans le futur';

  return null; // valid
}
```

---

### 3.3 Appeler la validation dans ui-new-entry.js

**Fichier :** `js/ui-new-entry.js` (`_handleAdd`)

Apres la construction de l'objet `entry` et avant `db.saveEntry()` :

```js
import { validateEntry } from './utils.js';

// Dans _handleAdd, apres construction de entry :
const error = validateEntry(entry, TYPE_DEF[currentType]);
if (error) {
  showToast(error);
  btn.disabled = false;
  return;
}
```

---

### 3.4 Appeler la validation dans ui-quick.js

**Fichier :** `js/ui-quick.js` (handler de save, vers la ligne 166)

Meme pattern que 3.3 : importer `validateEntry`, appeler avant save,
toast si invalide.

---

### 3.5 Valider les parametres URL du quick-entry

**Fichier :** `js/app.js` (fonction `handleQuickEntry`, vers la ligne 111)

**Probleme :** `params.get('loc')` est utilise tel quel sans verifier
qu'il fait partie des `textOptions` du type.

**Solution :**
```js
const loc = params.get('loc');
if (loc && def.textOptions) {
  const validValues = def.textOptions.map(o => o.value);
  if (!validValues.includes(loc)) {
    showToast('Option invalide');
    return;
  }
}
```

---

## Verification

- [ ] Double-clic rapide sur "Ajouter" → une seule entree creee
- [ ] Entrer une note > 500 caracteres → toast "Note trop longue"
- [ ] Modifier le timestamp en date future → toast "La date ne peut pas..."
- [ ] Quick-entry avec `?loc=INVALIDE` → toast "Option invalide"
- [ ] Entree normale → save OK, pas de regression
- [ ] Mode demo → meme validation appliquee

## Quand c'est fini

1. Commit : `feat: input validation and double-save prevention`
2. Push
3. Cocher Phase 3 dans `PLAN.md` + date
4. Indiquer Phase 4 comme prochaine
