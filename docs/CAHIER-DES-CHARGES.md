RÔLE : tu es mon lead développeur. Tu transformes mon site d'aide aux paris football (fichier unique carnet-paris-foot.html) en application complète, privée et hors ligne. Lis d'abord le fichier, résume-le, propose un plan par phases, attends mon accord, puis implémente phase par phase avec tests et commit à chaque fin de phase.

RÈGLES FIXES
- Les méthodes s'appellent exactement "+1.5", "+2.5" et "Freebet". Ne jamais les renommer.
- +1.5 : pari live à 0-0 vers la 15e-20e minute, puis couverture après le premier but.
- +2.5 : pari avant-match selon critères d'équipes et de championnat.
- Freebet : match betting, profit garanti par couverture chez un autre bookmaker.
- Aucune clé API payante. Les données arrivent par import JSON/CSV. Un champ manquant est affiché ⏳, jamais inventé ni traité comme une erreur.
- Tout reste local (IndexedDB), aucune donnée envoyée à un serveur.
- Honnêteté : seul le Freebet est garanti mathématiquement. Affiche toujours la marge du bookmaker et la marge d'erreur des estimations.

PHASE 1 : FONDATIONS
- Projet Vite propre, TypeScript, tests unitaires sur tous les calculs.
- PWA installable, hors ligne, notifications locales.
- Stockage IndexedDB (au lieu de localStorage) avec migration automatique de mes données actuelles.
- Sauvegarde/restauration complète en un fichier, sauvegarde auto quotidienne, historique des versions.
- Mode sombre/clair, mobile d'abord, accessibilité correcte.

PHASE 2 : DONNÉES ET IMPORT
- Import JSON avec validation, aperçu avant import, détection des doublons, fusion intelligente.
- Import CSV de football-data.co.uk pour les historiques.
- Générateur du prompt à copier vers mon autre chat Claude : choix de la date, des compétitions (clubs, sélections, féminin), du nombre de matchs, pagination "SUITE DISPONIBLE".
- Score de fiabilité de chaque match (nombre de champs remplis sur 8) et liste claire de ce qui manque.
- Suivi des cotes dans le temps si je les ressaisis, avec alerte quand une cote atteint ma cote minimale.

PHASE 3 : ANALYSE
- Modèle de Poisson amélioré (forces d'attaque et de défense, avantage du terrain, moyenne de la compétition).
- Probabilités +1.5 et +2.5, cote juste, cote minimale, value en %, indice de risque de 1 à 5.
- Impact des absents pris en compte, avec réglage manuel du poids.
- Filtres critères +1.5 et +2.5 réglables (seuils modifiables) avec verdict ✅ On joue / ⏳ À revoir / ❌ On passe et explication en une phrase de chaque verdict.
- Classement des matchs du jour par intérêt, comparaison côte à côte de deux matchs.
- Fiche équipe : forme sur 10 matchs, buts, séries, confrontations directes.

PHASE 4 : MODE LIVE
- Écran live pour +1.5 : chronomètre, minute d'entrée, cote saisie, alerte "fenêtre 15-20 min", calcul instantané de la couverture après le premier but (cash-out ou pari contraire) avec profit ou perte dans chaque scénario.
- Gros boutons utilisables d'une main sur téléphone, saisie ultra rapide.

PHASE 5 : FREEBET
- Calculateur : freebet remboursé ou non, commission d'exchange, mise de couverture, coût du pari qualificatif, profit garanti, taux de conversion du freebet.
- Suivi des offres (bonus, date limite, conditions, statut) avec rappel avant expiration.
- Comparateur pour choisir le meilleur match pour utiliser un freebet.

PHASE 6 : PARIS ET BANKROLL
- Journal des paris : méthode, match, cote, mise, résultat, notes, capture optionnelle du ticket.
- Bankroll : courbe, drawdown maximal, séries gagnantes/perdantes, ROI, taux de réussite, tout ventilé par méthode, compétition, jour de la semaine, tranche de cote.
- Mises : Kelly fractionné réglable, plafond par pari et par jour, blocage doux avec avertissement quand je dépasse.
- Objectifs et budget mensuel, avec suivi et alertes.
- Simulateur : "et si j'avais parié X" sur mes paris passés.

PHASE 7 : BACKTEST
- Tester +1.5 et +2.5 sur des saisons passées (CSV importés) avec critères réglables.
- Résultats honnêtes : nombre de paris, taux de réussite, ROI, pire série, intervalle de confiance, et avertissement si l'échantillon est trop petit.
- Comparaison de variantes de critères pour voir ce qui change vraiment.

PHASE 8 : JEU RESPONSABLE ET CONFORT
- Rappels discrets, pause forcée après série de pertes ou dépassement de plafond, auto-exclusion temporaire que je peux régler moi-même.
- Bilan hebdomadaire lisible (gains, pertes, ce qui a marché, ce qui a échoué).
- Recherche globale, raccourcis, tutoriel intégré expliquant chaque méthode et chaque chiffre.

QUALITÉ
- Code modulaire et commenté, fichier CHANGELOG, README d'utilisation.
- Tests automatiques sur les formules (Poisson, couverture, Kelly, ROI) avec cas connus.
- Aucune régression sur mes données existantes : migration testée avant de remplacer quoi que ce soit.
- À la fin de chaque phase : résumé court de ce qui marche, de ce qui reste, et ce que tu me recommandes ensuite.

Commence maintenant : lis le fichier, résume ce que tu comprends, puis donne-moi le plan détaillé des 8 phases. N'écris pas de code avant mon accord.