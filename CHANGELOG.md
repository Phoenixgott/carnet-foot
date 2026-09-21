# Journal des modifications

Format : chaque version liste ce qui a été ajouté, modifié ou corrigé.

## 0.4.0 — 22 septembre 2026 — Phase 4 : mode live

### Ajouté
- **Onglet Live +1.5**, pensé pour une main : gros boutons, champs de cote avec − et + (pas de 0,05),
  saisie au clavier numérique. Ouvert depuis un match (« Suivre en live (+1.5) ») ou sans match
  (buts attendus saisis à la main).
- **Chronomètre** : « Coup d'envoi », −1 / +1 min, calage sur la minute du match. Il garde l'heure du
  coup d'envoi (pas un compteur) : la minute est toujours juste, même écran éteint ou app fermée.
- **Fenêtre 15ᵉ-20ᵉ minute** : trop tôt, prépare-toi (dès la 12ᵉ), fenêtre ouverte (avec le temps restant),
  passée, trop tard. Alerte à chaque changement : bandeau, message, vibration, notification si l'app est
  en arrière-plan. Elles partent tant que l'app reste ouverte (le téléphone peut les retarder).
- **« J'entre ? »** avec le nouveau modèle : mêmes règles et mêmes textes que le carnet (0-0, critères du
  match, cote, match animé, trop tôt), chances avec fourchette à la minute exacte, cote juste, cote
  minimale, value. Entre la cote juste et la cote minimale : « Oui, mais mise la moitié ». Tableau de
  la cote minimale de la 15ᵉ à la 40ᵉ minute.
- **Pari pris → BUT !** : rappel de ce que rapporte un 2ᵉ but et de la cote « moins de 1,5 » à partir de
  laquelle couvrir rapportera ; « But annulé (VAR) » pour revenir en arrière.
- **Couverture instantanée** : pari contraire, exchange (lay, commission réglable) ou cash-out. Mise à
  placer, gain garanti, cote limite de rentabilité, et le **résultat de chaque scénario** (2ᵉ but / plus
  de but) sans couvrir et en couvrant, avec l'espérance (chances d'un 2ᵉ but d'après le modèle).
- L'état du live est gardé sur l'appareil (réglage local : ni dans la sauvegarde fichier, ni remplacé par
  une restauration). Un autre match demandé pendant un live ne l'efface qu'avec ton accord.

### Corrigé par rapport au carnet
- Quand la couverture par pari contraire n'est pas rentable, le carnet conseillait d'attendre que la cote
  « moins de 1,5 but » baisse. C'est l'inverse : sans nouveau but, cette cote baisse avec le temps et la
  couverture coûte plus cher. Les formules restent celles du carnet ; le texte dit maintenant la cote
  minimale à trouver et que l'attente n'aide pas.

### Choix
- Le pari pris en live n'est pas encore écrit dans le journal : l'ajout et la modification des paris sont
  prévus en phase 6 (et un réimport du carnet remplace le journal). Pour l'instant, le pari se note
  dans le carnet.
- « Match animé » est à valider à chaque fois (« Fermé » par défaut) : c'est ton appréciation, pas un calcul.

## 0.3.0 — 21 septembre 2026 — Phase 3 : analyse

### Ajouté
- **Nouveau modèle de buts attendus** (`src/core/modele-v2/`), affiché à côté des chiffres du carnet :
  forces d'attaque et de défense rapportées à la moyenne de la compétition et ramenées vers la moyenne
  (4 matchs fictifs), avantage du terrain du championnat tiré des historiques CSV (1,25 sinon, neutre
  pour une finale), forme récente (±15 % au plus), absents avec un poids réglable, et incertitude
  (erreur d'échantillonnage + 8 % d'erreur de modèle).
- Par méthode : probabilité et fourchette (± 1 écart type, environ 2 chances sur 3), cote juste,
  cote minimale (bas de la fourchette), value en % d'après la cote actuelle (+2.5), risque de 1 à 5,
  estimation du bookmaker marge retirée, avertissement si elle s'écarte de 10 points ou plus.
  Méthode +2.5 : modèle mélangé 70/30 avec la part réelle de matchs à 3+ buts des deux équipes.
- **Live (+1.5)** : répartition réelle des buts dans le temps (≈ 45 % en 1re mi-temps, plus en fin de
  mi-temps), ajustée au championnat quand les CSV donnent les mi-temps, et prise en compte du 0-0
  lui-même. Constat honnête : à la 20ᵉ minute, l'écart avec le calcul du carnet est faible (< 0,05 but).
- **Verdict ✅ / ⏳ / ❌ expliqué en une phrase**, qui tient compte des critères, de la fiabilité et de la
  cote (sous la cote juste : on passe ; entre cote juste et cote minimale : à revoir) ; « Pourquoi ? »
  détaille chaque critère et chaque étape du calcul.
- **Critères réglables** (Réglages → Analyse des matchs) : seuils +1.5 et +2.5, contextes acceptés,
  poids des absents ; retour aux critères du carnet en un geste.
- **Tri par intérêt** (verdict, value, probabilité prudente, fiabilité) et **comparaison de deux matchs**.
- **Fiche équipe** (touche le nom d'une équipe) : chiffres de la saison, 10 derniers matchs, bilan,
  séries en cours, confrontations directes ; noms reconnus entre la réponse de Claude et les CSV
  (PSG = Paris SG, OM = Marseille…), jamais devinés en cas de doute.

### Modifié
- Les critères du carnet acceptent des seuils ; avec ceux du carnet (par défaut), tout reste identique
  (tests de non-régression inchangés et verts).
- La cote minimale par défaut des alertes de cote est celle du nouveau modèle.

## 0.2.2 — 21 septembre 2026 — Correctif de mise à jour (cause réelle et réparation)

### Corrigé
- Cause réelle de l'écran blanc : à l'installation, le service worker mettait en cache la page gardée
  par le navigateur (GitHub Pages autorise 10 minutes), donc une page d'une version avec les scripts
  d'une autre. Les fichiers sont maintenant chargés sans passer par cette copie, et l'installation
  vérifie que la page appelle bien les scripts de sa version (sinon elle attend et réessaie).
- Réparation automatique : si la version en service a un cache abîmé, la nouvelle version prend le
  relais sans attendre « Mettre à jour » et recharge les fenêtres ouvertes.
- Le filet de sécurité active une version en attente avant de recharger la page.

## 0.2.1 — 21 septembre 2026 — Correctif de mise à jour

### Corrigé
- Écran blanc possible juste après une mise à jour (présent depuis la 0.1.0) : l'ancien service worker
  servait l'ancienne page pendant que le nouveau effaçait l'ancien cache ; le script de l'ancienne page,
  supprimé du serveur, était alors introuvable. Le cache de la version précédente est désormais gardé
  et consulté, et un filet de sécurité (`public/demarrage.js`) recharge la page une fois si
  l'application n'a pas démarré.
- Serveur local de test : un fichier introuvable renvoie 404, comme GitHub Pages.

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
