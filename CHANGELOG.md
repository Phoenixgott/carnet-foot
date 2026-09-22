# Journal des modifications

Format : chaque version liste ce qui a été ajouté, modifié ou corrigé.

## 0.7.0 — 22 septembre 2026 — Phase 8 : jeu responsable et confort

Dernière phase du cahier des charges (la phase 7, backtest, a été mise de côté par l'utilisateur
pour l'instant). Il n'a pas été possible de lier l'application à un compte de bookmaker (Unibet) :
aucun export d'historique n'est proposé publiquement, et la seule solution (identifiants du compte
stockés dans l'app, connexion automatisée) est refusée — contraire à la promesse « zéro connexion
externe » et aux conditions d'utilisation des bookmakers.

### Ajouté
- **Jeu responsable** (Réglages → Jeu responsable) : rappel doux sur l'accueil après un nombre de
  défaites d'affilée ou un plafond du jour dépassé (réglables, désactivés par défaut) ; pause
  (auto-exclusion) que l'utilisateur pose lui-même (durée rapide ou personnalisée) et retire
  lui-même (avec une confirmation, pour éviter un arrêt sur un geste distrait). Pendant une pause,
  seul l'ajout d'un **nouveau** pari est concerné : modifier ou supprimer un pari déjà noté reste
  toujours possible. Jamais de mine triste ni de discours culpabilisant : un rappel factuel, une
  pause que l'utilisateur choisit.
- **Bilan hebdomadaire** (accueil) : paris terminés, gagné/perdu, taux de réussite, méthode qui a le
  mieux et le moins bien marché cette semaine, comparaison à la semaine précédente.
- **Recherche globale** (Réglages, ou lien sur l'accueil) : retrouve un match, un pari ou une offre
  freebet par un mot (insensible aux accents et à la casse).
- **Tutoriel intégré** (Réglages → « Comment ça marche ? ») : chaque méthode (+1.5, +2.5, Freebet) et
  chaque chiffre affiché dans l'app (chances, cote juste, cote minimale, value, risque, fiabilité,
  ROI, drawdown, séries, Kelly, plafonds…) expliqué en une phrase, dans des sections repliables.

### Corrigé
- Dans le journal des paris, passer directement de « Ajouter un pari » à « Modifier » un pari
  existant (sans fermer le formulaire entre les deux) affichait un formulaire de modification vide
  au lieu des valeurs du pari : le formulaire garde maintenant une identité propre par pari (et par
  l'ajout), pour toujours repartir de la bonne saisie.

### Choix
- Rien n'est un vrai blocage technique tant que l'utilisateur ne l'a pas posé lui-même (la pause) :
  cohérent avec les plafonds de mise de la phase 6, jamais un blocage forcé sans son accord.

## 0.6.2 — 22 septembre 2026 — Palette « tableau de bord » bleu et noir

Retour de l'utilisateur sur la 0.6.1 (« c'est moche ») : plus de couleur, plus lisible, esprit
tableau de bord bleu et noir plutôt que vert gazon.

### Modifié
- **Nouvelle palette** dans les deux thèmes : le bleu remplace le vert comme couleur de marque et
  d'action (boutons, liens, onglet actif, courbe de bankroll…). Le vert/l'ambre/le rouge restent
  réservés à leur sens habituel (gagné/attention/perdu) : rien ne change dans ce qu'ils signifient.
- **Carte bankroll** : fond bleu-noir avec une grille fine façon tableau de bord (au lieu des rayures
  d'un terrain), toujours sombre quel que soit le thème choisi. Les trois chiffres ont chacun leur
  couleur et leur icône (flèche verte/rouge pour gagné/perdu, % bleu-cyan pour la rentabilité, étoile
  or pour le taux de réussite) pour se lire d'un coup d'œil.

## 0.6.1 — 22 septembre 2026 — Nouveau look de l'accueil (3D, animations, mascotte)

Hors plan des 8 phases, à la demande de l'utilisateur : un style plus spectaculaire, en commençant
par l'écran d'accueil pour valider la direction avant de l'étendre aux autres écrans.

### Ajouté
- **Carte bankroll en relief** : légère inclinaison 3D qui suit la souris (immobile au doigt), lueurs
  animées à la dérive, reflet qui balaie la carte, chiffres (bankroll, gagné/perdu, rentabilité, taux
  de réussite) qui comptent jusqu'à leur valeur au lieu d'apparaître d'un coup.
- **Mascotte** : un petit ballon animé et décoratif, qui rebondit et cligne des yeux. Sourire et
  étincelles quand le bilan est positif ; jamais de mine triste sur une perte (encourageant, jamais
  culpabilisant). Présent sur l'écran d'accueil vide (accueil) et sur la carte bankroll.

### Choix
- Tout est fait en CSS et SVG « maison » (aucune bibliothèque 3D) : ça reste léger, ça marche hors
  ligne sans rien télécharger, et ça respecte immédiatement « Réduire les animations » du téléphone
  (déjà coupé partout dans l'app) ainsi que les cibles tactiles et contrastes déjà vérifiés.

## 0.6.0 — 22 septembre 2026 — Phase 6 : paris et bankroll

### Ajouté
- **Journal des paris** (onglet Paris) : ajout, modification, suppression à la main, avec compétition
  et match liés (facultatif, remplit automatiquement le texte et la date). Une photo du ticket peut être
  jointe (redimensionnée sur le téléphone, jamais dans la sauvegarde fichier ni l'historique des versions).
- **Statistiques** : courbe de bankroll, drawdown maximal, séries gagnantes/perdantes en cours et
  records, ROI et taux de réussite, ventilations par méthode, compétition, jour de la semaine et
  tranche de cote (avec un tableau accessible en plus de la courbe).
- **Mises conseillées** : Kelly fractionné réglable, en plus de la mise fixe existante ; plafond par
  pari et par jour avec avertissement doux dans le formulaire d'ajout (jamais un blocage).
- **Objectifs et budget mensuels** : objectif de gain et budget maximal du mois, réglables et suivis.
- **Simulateur** : rejoue les paris déjà notés avec une mise fixe ou un pourcentage de la bankroll de
  départ, comparé au résultat réel (gains, ROI, drawdown). Les résultats qui ne suivent pas une formule
  (manuel, freebet, cash-out) gardent leur gain réel plutôt que d'être recalculés au hasard.
- **Live** et **Freebet** notent maintenant directement dans le journal : bouton « Noter ce pari »
  depuis l'écran Live (gain garanti déjà rempli si le pari a été couvert), et proposition d'ajouter au
  journal dès qu'une offre de freebet est enregistrée terminée avec un bénéfice.

### Modifié — l'application devient le carnet de paris
- **L'import du carnet devient additif** : il n'ajoute plus que les paris et matchs que l'application
  ne connaît pas encore, et ne remplace ni n'efface plus jamais un pari, même modifié dans
  l'application depuis. Un pari importé est reconnu par sa position **et** son contenu au moment de
  l'import (date, méthode, cote, mise) pour ne jamais en perdre un si le carnet est réordonné ou
  qu'un pari y est supprimé entre deux imports.
- En conséquence, le contrôle strict champ par champ contre les totaux du carnet (qui supposait un
  remplacement complet à chaque import) a été retiré : l'aperçu montre maintenant ce qui est nouveau
  (paris, matchs) et ce qui est déjà présent, et l'import reste toujours possible puisqu'il ne peut
  plus rien effacer.

### Corrigé
- Le gain pré-rempli en notant un pari sécurisé depuis le Live affichait parfois un nombre à
  virgule flottante brut (ex. `1,1692307692307686 €`) ; il est maintenant arrondi au centime.

## 0.5.0 — 22 septembre 2026 — Phase 5 : Freebet

### Ajouté
- **Onglet Freebet** (calculateur, comparateur, offres) ; « Réglages » passe en engrenage dans l'en-tête
  pour garder 6 onglets lisibles dans la barre du bas.
- **Calculateur** : le pari qui débloque le freebet et le freebet, chacun couvert chez un autre
  bookmaker ou en lay sur un exchange (commission réglable). Chaque pari se calcule seul, sans attendre
  l'autre. Donne : mises de couverture, somme à bloquer sur l'exchange, **coût du pari qui débloque**,
  **bénéfice garanti**, **taux de conversion** (brut, et net une fois le coût compté) avec l'appréciation
  du carnet (70 % bon, 60 % correct). **Freebet remboursé** en plus du non remboursé (cas courant).
  Les champs démarrent vides : aucun chiffre d'exemple pris pour une vraie cote. Saisies impossibles :
  message clair, jamais de chiffre inventé. Les formules du carnet sont inchangées (non-régression verte).
- **Comparateur** : pour chaque match à venir qui a les cotes « plus de » et « moins de » d'une même
  ligne (1,5 ou 2,5), classe les combinaisons par taux de conversion, avec la mise de couverture, le gain
  garanti et la marge du bookmaker ; cote minimale exigée par l'offre ; « Calculer avec ce match » envoie
  les cotes vers le calculateur. Limite dite à l'écran : le pari inverse est supposé à la cote du même
  bookmaker.
- **Suivi des offres** : bookmaker, intitulé, montant, mise du pari qui débloque, cote minimale, date
  limite, conditions, remboursé ou non, statut (À faire → Pari placé → Freebet reçu → Terminée) et
  bénéfice réel. Délais lisibles (« expire dans 2 jours »), états Urgent (≤ 2 j), Bientôt (≤ 7 j),
  Expirée. Bilan : offres en cours, freebets à utiliser, bénéfice réalisé, conversion moyenne.
  « Calculer » ouvre le calculateur avec le montant, la mise et la cote minimale de l'offre (avertit si
  la cote du freebet est en dessous).
- **Rappels avant expiration** : offres qui expirent dans les 3 jours signalées sur l'accueil et dans
  l'onglet ; une notification par jour quand l'app est ouverte (si autorisées) ; et **« Ajouter à
  l'agenda »** : fichier .ics avec deux alarmes (la veille et 3 jours avant, à 9 h) que le téléphone
  rappelle même application fermée, ce qu'une application sans serveur ne peut pas faire seule.
- Les offres sont enregistrées avec les réglages : elles sont dans la sauvegarde fichier et
  l'historique des versions, sans changer le format de la sauvegarde.

### Corrigé
- **Réimporter le carnet effaçait les réglages de l'application** (thème, critères d'analyse, choix de
  la demande…), et aurait effacé les offres de freebet saisies à la main. L'import ne remplace plus que
  ce que le carnet fournit (matchs, paris, bankroll, compétitions).

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
