# Phase 1 — Securite & deploiement

> Prerequis : aucun
> Risque : nul — aucune logique applicative touchee
> Estimation : petit

## Objectif

Ajouter les protections de securite minimales requises pour un deploiement
public et corriger les problemes de configuration existants.

---

## Taches

### 1.1 Ajouter le header Content-Security-Policy

**Fichier :** `netlify.toml`

Ajouter dans le bloc `[headers] for = "/*"` :

```
Content-Security-Policy = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com; img-src 'self' data:; frame-ancestors 'none'"
```

**Pourquoi :** Empeche l'injection de scripts tiers, le clickjacking,
et les fuites de donnees vers des domaines non autorises.

---

### 1.2 Ajouter l'attribut SRI sur Chart.js CDN

**Fichier :** `index.html` (la balise `<script>` Chart.js)

1. Recuperer le hash SRI de `chart.js@4.4.3/dist/chart.umd.min.js` :
   ```bash
   curl -s https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js | openssl dgst -sha384 -binary | openssl base64 -A
   ```
2. Ajouter `integrity="sha384-<hash>"` et `crossorigin="anonymous"` sur la balise.

**Pourquoi :** Protege contre la compromission du CDN (supply chain attack).

---

### 1.3 Creer `.gitignore`

**Fichier :** `.gitignore` (nouveau fichier a la racine)

Contenu :
```
.env
.env.*
.DS_Store
node_modules/
*.log
.vscode/
.idea/
thumbs.db
```

**Pourquoi :** Empeche de commit accidentellement des secrets ou des
fichiers systeme.

---

### 1.4 Aligner `theme-color`

**Fichier :** `quick.html`

Changer `<meta name="theme-color" content="#0f0f1a">` en
`<meta name="theme-color" content="#1a1a2e">` pour matcher `index.html`
et `manifest.json`.

**Pourquoi :** Incoherence visuelle sur Android quand on switch entre les pages.

---

### 1.5 Corriger le regex dans `firebase-config.js`

**Fichier :** `js/firebase-config.js` (vers la ligne 46)

Remplacer :
```js
.replace(/^\s*\/\V[^\n]*/gm)
```
Par :
```js
.replace(/^\s*\/\/[^\n]*/gm, '')
```

Deux bugs : `\V` n'est pas un escape JS valide (matche le literal `V`),
et le second argument de `.replace()` est manquant (devrait etre `''`).

**Pourquoi :** Le parsing de config Firebase plante silencieusement sur
les configs collees avec des commentaires.

---

## Verification

- [ ] `curl -I https://<site>.netlify.app/` → header CSP present
- [ ] Ouvrir la console DevTools → pas d'erreur CSP
- [ ] `index.html` charge Chart.js sans erreur d'integrite
- [ ] `.gitignore` bloque les fichiers attendus (`git status` propre)
- [ ] `quick.html` et `index.html` ont le meme `theme-color`
- [ ] Coller une config Firebase avec des commentaires `//` → parsing OK

## Quand c'est fini

1. Commit : `feat: add security headers, SRI, gitignore, fix config regex`
2. Push sur la branche en cours
3. Ouvrir `.claude/plans/PLAN.md` → cocher Phase 1 + ajouter la date
4. Indiquer a l'utilisateur que la Phase 2 est la prochaine
