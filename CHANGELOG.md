# Journal des modifications

Format : chaque version liste ce qui a été ajouté, modifié ou corrigé.

## 0.2.0 — 21 septembre 2026 — Phase 2 : données et import

### Ajouté
- **Récupérer les matchs** (onglet Matchs, en 3 étapes comme dans le carnet) :
  - générateur de la demande pour l'autre conversation Claude : jour, un seul match au choix,
    compétitions (clubs, sélections, féminin), nombre de matchs par réponse (4 à 12), nombre total
    facultatif, pagination « SUITE DISPONIBLE » ; les choix sont gardés ;
  - import de la réponse : blocs JSON trouvés même entourés de texte, validation champ par champ
    (une valeur impossible est écartée, signalée et affichée ⏳, jamais corrigée), aperçu avant import
    (nouveaux, complétés avec la liste des champs, inchangés, ignorés), détection des doublons
    (même id, ou même date et mêmes équipes, y compris dans une même réponse), fusion du carnet
    (une info reçue remplace l'ancienne, une info absente ou null n'efface rien) ;
  - demande de compléments pour les matchs incomplets ; demande de cotes et d'absents du jour J.
- **Fiabilité** : score sur 8 et fiabilité en %, liste de ce qui manque séparée entre « à compléter »
  et « publié plus tard » (cotes, absents).
- **Cotes** : cotes « moins de 1,5 / 2,5 » demandées en plus, marge du bookmaker affichée ;
  suivi dans le temps (un relevé daté à chaque changement, par import ou saisie à la main, flèches de
  hausse et de baisse) ; cote minimale par marché (celle choisie, sinon la cote mini +2.5 du carnet) ;
  alerte quand une cote l'atteint : sur la carte, sur l'accueil, filtre « Cote atteinte » et notification.
- **Historiques CSV** de football-data.co.uk (onglet Données) : les deux formats de fichiers du site,
  plusieurs fichiers à la fois, matchs pas encore joués ignorés, doublons reconnus, résumé par
  championnat et saison (moyenne de buts, parts à 2+ et 3+ buts), suppression par saison.
- Saison calculée d'après la date (le carnet écrivait « 2026-2027 » en dur).
- Base IndexedDB version 2 (magasin `resultats`), mise à niveau automatique sans perte.

### Modifié
- La demande est celle du carnet, au mot près, sauf : saison calculée, nombre de matchs réglable,
  cotes « moins de » (vérifié par test contre le code d'origine).
- Un match complété garde son identifiant (le carnet le remplaçait par celui de la réponse).
- `PW_CANAL=chrome npm run e2e` lance les tests dans le Google Chrome installé.

### Choix
- Les historiques CSV sont des données publiques réimportables : ils ne sont ni dans la sauvegarde
  fichier ni dans l'historique des versions (qui grossirait de plusieurs Mo par copie).

## 0.1.0 — 21 septembre 2026 — Phase 1 : fondations

### Ajouté
- Projet TypeScript strict, construit avec esbuild, interface React, organisé en modules
  (`core/` calculs, `data/` stockage, `pwa/` hors ligne, `ui/` écrans).
- Calculs du carnet d'origine repris à l'identique : loi de Poisson, buts attendus, fiabilité sur 8,
  critères et verdicts +1.5 et +2.5, décisions « j'entre ? » et « je parie ? », couverture +1.5
  (pari contraire, exchange, cash-out), Freebet, gains, bankroll et bilan.
- Stockage IndexedDB versionné (matchs, paris, réglages, versions), écritures en une seule transaction.
- Import depuis le carnet (export complet et ancienne sauvegarde) avec aperçu, contrôles avant import,
  relecture et nouveaux contrôles après import, retour automatique à l'état précédent en cas d'écart.
- Sauvegarde complète en un fichier (enregistrer, partager, copier) avec empreinte SHA-256,
  restauration vérifiée, rappel après 7 jours sans sauvegarde fichier.
- Historique des versions : copie quotidienne automatique (30 gardées), copie avant import ou
  restauration (15 gardées), copie manuelle, retour à une version.
- Protection du stockage contre l'effacement (demande au navigateur) et affichage de l'espace utilisé.
- Application installable (manifeste, icônes dont une « maskable » pour Android), hors ligne
  (service worker), proposition de mise à jour quand une nouvelle version est en ligne.
- Notifications locales via le service worker (activation et notification de test).
- Thème automatique, clair ou sombre ; écrans pensés pour le téléphone ; accessibilité (titres,
  étiquettes, cibles ≥ 44 px, lien d'évitement, focus, boîtes de dialogue natives, contrastes AA).
- Écrans : Accueil (bankroll, rappels), Matchs (analyse du carnet, ⏳ pour les données inconnues),
  Mes paris (bilan et journal, lecture seule), Données, Réglages.
- Aucune connexion vers un autre site (règle de sécurité de la page) ; police du téléphone.
- Variante « aperçu » publiable comme artefact Claude.
- Tests : 32 tests unitaires (dont non-régression contre le code original du carnet sur plus de 1 000 matchs,
  cas connus calculés à la main, contrastes) et 22 tests de bout en bout dans Chromium (migration réelle
  depuis le carnet, sauvegarde et restauration, hors ligne, mise à jour, thème, notifications, accessibilité).

### Modifié dans le carnet d'origine (artefact)
- Ajout du bouton « Tout exporter » (onglet Mes paris), qui exporte matchs, paris, réglages et
  compétitions avec des valeurs de contrôle. Rien d'autre n'a changé ; les données sont intactes.

### Écarts avec la demande initiale
- esbuild au lieu de Vite, lanceur de tests de Node au lieu de Vitest, types React minimaux :
  le registre npm était inaccessible depuis l'environnement de construction (voir README).
- Police du téléphone au lieu d'Atkinson Hyperlegible (non téléchargeable ici).
