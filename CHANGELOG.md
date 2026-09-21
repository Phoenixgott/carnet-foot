# Journal des modifications

Format : chaque version liste ce qui a été ajouté, modifié ou corrigé.

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
