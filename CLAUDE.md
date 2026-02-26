# Instructions pour Claude Code

## Après chaque push

Toujours afficher le lien de création de PR sous forme de bouton markdown :

```
**[→ Créer la PR sur GitHub](https://github.com/wpef/anitracker/pull/new/BRANCH_NAME)**
```

Remplacer `BRANCH_NAME` par le nom de la branche courante (ex: `claude/dog-habit-tracker-g7Eem`).

- `gh` n'est pas disponible dans cet environnement → impossible de créer la PR automatiquement
- Le bouton "voir la PR" généré par Claude Code pointe vers une ancienne PR fermée → l'ignorer
- Toujours fournir le lien `/pull/new/BRANCH` pour que l'utilisateur crée la PR en un clic
