# Google Play — Data Safety form (contenu à reporter dans la Play Console)

> À saisir dans Play Console → Politique de l'application → Sécurité des données.
> Reflète exactement `privacy.html`. Mettre à jour les deux ensemble.

## Collecte et partage

| Type de données | Collectée | Partagée | Obligatoire | Finalité |
|---|---|---|---|---|
| Adresse e-mail | Oui | Non | Oui (compte) | Authentification du compte, synchronisation |
| Nom (displayName) | Oui (si fourni) | Non | Non | Affichage du compte |
| Activité in-app (entrées chien) | Oui | Non | Oui | Fonctionnalité principale de l'app |
| Identifiant d'achat (RevenueCat/Play) | Oui | Avec RevenueCat/Google | Non | Gestion de l'achat premium |

Aucune donnée : localisation, contacts, photos/médias, messages, identifiants
publicitaires, données de santé/financières personnelles.

## Pratiques de sécurité

- **Chiffrement en transit** : Oui (HTTPS / Firebase TLS).
- **L'utilisateur peut demander la suppression de ses données** : Oui
  (suppression in-app des entrées + demande de suppression de compte par e-mail).
- **Données chiffrées au repos** : géré par Firebase.

## Sous-traitants (third parties)

- **Google Firebase** — Auth + Realtime Database (hébergement, stockage).
- **RevenueCat** + **Google Play Billing** — traitement de l'achat premium.

## Liens requis par le store

- **Politique de confidentialité** : `https://<DOMAINE>/privacy.html`
  (héberger `privacy.html` sur le domaine public — ex. Netlify — et coller l'URL
  dans Play Console → Coordonnées + fiche du store).

## ⚠️ Avant publication

- [ ] Héberger `privacy.html` sur une URL publique stable.
- [ ] Renseigner cette URL dans la Play Console (fiche + Data safety).
- [ ] Vérifier que le tableau ci-dessus correspond à `privacy.html`.
