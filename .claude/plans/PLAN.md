# AniTracker — Plan d'evolution

## Comment utiliser ce dossier

**Pour continuer le plan**, ouvre une nouvelle conversation Claude et dis :

> Continue le plan

Claude lira ce fichier, identifiera la prochaine phase `[ ]` non cochee,
ouvrira le prompt correspondant dans `.claude/plans/`, et executera les taches.

**Apres chaque phase terminee**, Claude doit :
1. Cocher la phase dans ce fichier (`[ ]` → `[x]`)
2. Ajouter la date de completion
3. Commit + push les changements
4. Indiquer la prochaine phase a attaquer

---

## Regles pour Claude

- Lis **toujours** ce fichier en premier pour savoir ou on en est
- Ouvre le prompt de la phase en cours (`.claude/plans/phase-XX-*.md`)
- Suis les instructions du prompt a la lettre
- A la fin de chaque phase : coche-la ici, commit, push
- Ne saute jamais une phase sauf si l'utilisateur le demande explicitement
- Respecte les conventions du projet (voir `CLAUDE.md` et `js/CLAUDE.md`)
- Chaque phase doit etre testable independamment avant de passer a la suivante

---

## Vue d'ensemble

| # | Phase | Fichier prompt | Statut | Date |
|---|-------|----------------|--------|------|
| 1 | Securite & deploiement | `phase-01-security.md` | [x] | 2026-03-08 |
| 2 | Service Worker robuste | `phase-02-service-worker.md` | [x] | 2026-03-08 |
| 3 | Validation des donnees | `phase-03-data-validation.md` | [x] | 2026-03-09 |
| 4 | Debounce Firebase & stats | `phase-04-perf-data.md` | [x] | 2026-03-09 |
| 5 | UX reseau & resilience | `phase-05-network-ux.md` | [x] | 2026-03-09 |
| 6 | Performance CSS/HTML | `phase-06-perf-frontend.md` | [ ] | — |
| 7 | Gestion utilisateurs & auth | `phase-07-auth.md` | [ ] | — |
| 8 | Modele freemium / premium | `phase-08-freemium.md` | [ ] | — |
| 9 | Nouvelles features | `phase-09-features.md` | [ ] | — |
| 10 | App native & CI/CD | `phase-10-native-cicd.md` | [ ] | — |

---

## Dependances entre phases

```
Phase 1 (securite)
  └─> Phase 2 (SW)
        └─> Phase 3 (validation)
              └─> Phase 4 (perf data)
                    └─> Phase 5 (UX reseau)
                          └─> Phase 6 (perf CSS)

Phase 7 (auth) ← prerequis pour Phase 8
Phase 8 (freemium) ← prerequis pour Phase 9 (certaines features)
Phase 10 (native) ← a faire en dernier, depend de tout le reste
```

Phases 1–6 = production-ready pour le web (deploiement public).
Phases 7–10 = evolution produit (features, monetisation, app native).

---

## Architecture cible (apres toutes les phases)

```
anitracker/
├── index.html                 SPA principale
├── quick.html                 Quick-entry (raccourci Android)
├── showcase.html              Showcase UI components
├── css/style.css              Stylesheet unique
├── sw.js                      Service Worker (cache robuste)
├── manifest.json              PWA manifest
├── netlify.toml               Config deploiement + headers securite
├── .gitignore                 Fichiers ignores
├── CLAUDE.md                  Instructions projet pour Claude
├── AGENT-NEW-ACTION.md        Prompt agent "nouveau type"
├── .claude/plans/             << CE DOSSIER — plan d'evolution
│   ├── PLAN.md                Vue d'ensemble + statut
│   └── phase-XX-*.md          Prompts par phase
├── .githooks/pre-commit       Auto-bump CACHE_NAME
└── js/
    ├── CLAUDE.md              Architecture JS detaillee
    ├── app.js                 Boot + routing + online/offline
    ├── db.js                  Firebase adapter + debounce + cache
    ├── db-demo.js             Mode demo (memoire)
    ├── utils.js               TYPE_DEF + helpers + validation
    ├── firebase-config.js     Config Firebase (localStorage)
    ├── auth.js                [Phase 7] Auth Firebase
    ├── permissions.js         [Phase 8] Gestion freemium/premium
    ├── navigation.js          Navigation SPA
    ├── toast.js               Toasts + sync indicator
    ├── stats.js               Calcul stats (optimise single-pass)
    ├── charts.js              Chart.js wrappers
    ├── ui-new-entry.js        Formulaire complet (avec validation)
    ├── ui-quick.js            Quick entry (avec validation)
    ├── ui-history.js          Historique
    ├── ui-edit.js             Edition
    ├── ui-stats.js            Page stats
    └── ui-gauge.js            Composant gauge
```
