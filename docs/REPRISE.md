# Reprise du projet — à lire en premier

Ce fichier permet à une nouvelle session Claude de reprendre le projet exactement là où il en est.
Le cahier des charges complet, tel que l'utilisateur l'a écrit, est dans `docs/CAHIER-DES-CHARGES.md`.
Il fait foi.

## Qui, quoi

- **Utilisateur** : francophone, téléphone **Samsung (Android)**, pas d'ordinateur mentionné.
  Il délègue : Claude est le « lead développeur ». Réponses en français, courtes, orientées résultat.
- **Compte GitHub** : `Phoenixgott`. Dépôt prévu : `Phoenixgott/carnet-foot` (public, obligatoire
  pour GitHub Pages gratuit ; le code est public, les données de l'utilisateur ne sont jamais dans le dépôt).
- **Carnet d'origine** : artefact Claude « Carnet de Paris Foot »
  (https://claude.ai/artifact/BWzFcaBTUGK8724meP21Sd). Il reste l'outil quotidien de l'utilisateur
  jusqu'à ce que la nouvelle app couvre ses besoins. Copie exacte dans `tests/fixtures/carnet-original.html`.
- **Aperçu de la nouvelle app** : artefact « Nouveau Carnet Foot »
  (https://claude.ai/artifact/874dtaEEP3TZkxYn2dEAJ6), variante sans service worker (`npm run build:apercu`).

## Décisions déjà prises (validées par l'utilisateur)

1. Plan en 8 phases du cahier des charges, validé tel quel avec ces ajustements :
   - migration via le bouton « Tout exporter » ajouté au carnet (le stockage du carnet n'est pas lisible
     depuis une autre adresse) ;
   - le format JSON des matchs reste compatible avec la demande actuelle du carnet ; en phase 2, ajouter
     les cotes « moins de 1,5 / 2,5 » (marge du bookmaker) et calculer la saison d'après la date
     (le carnet écrit « 2026-2027 » en dur) ;
   - phase 3 : nouveau modèle utilisant `moyenneButsLigue` et `pctOver25` (collectés mais inutilisés
     par le carnet), avantage du terrain par championnat depuis les CSV ; ancien modèle affiché à côté
     pendant la transition ; répartition réelle des buts dans le temps pour le live (le carnet suppose
     un rythme uniforme + 3 min d'arrêts, ce qui rend la cote mini du live trop prudente) ;
   - phase 5 : ajouter le freebet remboursé (le carnet ne gère que le non remboursé) ;
   - phase 6 : mise fixe 2 % par défaut, Kelly fractionné en option.
2. Noms des méthodes : exactement « +1.5 », « +2.5 », « Freebet » (avec un point, comme le cahier des
   charges ; le carnet affichait « +1,5 »). Codes du carnet : m1 = +1.5, m3 = +2.5, m2 = Freebet.
3. Hébergement : **GitHub Pages** (l'utilisateur a refusé Cloudflare et préfère GitHub).
4. Outils : l'environnement de la phase 1 n'avait pas accès au registre npm. Construit avec esbuild,
   lanceur de tests de Node, Playwright, React 19, types React minimaux (`src/types/react-shim.d.ts`).
   Si le registre npm est accessible dans la nouvelle session, on peut passer à Vite, Vitest et
   `@types/react` (voir README, « Choix techniques et écarts ») : proposer à l'utilisateur, ne pas
   imposer.
5. Aucune donnée envoyée à un serveur ; aucune clé d'API payante ; champ manquant affiché ⏳ ;
   seul le Freebet est présenté comme garanti.

## État actuel

- **Phase 6 terminée** (étiquette `v0.6.0`, 22 septembre 2026) : voir `CHANGELOG.md`.
  Phases précédentes : `v0.1.0`, `v0.2.0` (+ correctifs `v0.2.1`, `v0.2.2` : écran blanc après mise à jour),
  `v0.3.0`, `v0.4.0`, `v0.5.0`. 116 tests unitaires + 57 tests de bout en bout, tous verts. En ligne sur
  https://phoenixgott.github.io/carnet-foot/ (dépôt `Phoenixgott/carnet-foot`, branche `gh-pages`).
- **Prochaine étape : phase 7 (backtest), seulement après l'accord de l'utilisateur.**
- **Décision prise en phase 6** (question posée à l'utilisateur, réponse « L'app devient le carnet ») :
  l'application est désormais le carnet de paris principal. Le journal se modifie dans l'app (ajout,
  modification, suppression, Live et Freebet y notent directement) ; réimporter le carnet original reste
  possible à tout moment mais n'ajoute que ce qu'il connaît de nouveau — il ne remplace ni n'efface plus
  jamais un pari. Les bénéfices réels des offres de freebet (`beneficeReel`) alimentent le journal via
  une proposition à l'enregistrement de l'offre (pas d'automatisme silencieux).
- Navigation : 6 onglets (Accueil, Matchs, Live, Freebet, Paris, Données) ; Réglages est l'engrenage de
  l'en-tête. Prévoir où mettre un éventuel 7ᵉ écran sans surcharger la barre.
- Ressenti de l'utilisateur après la phase 1 : l'app « ne ressemble en rien » à son carnet et ne lui
  sert à rien pour l'instant. Il a choisi de continuer le plan. Garder en tête : lui rendre vite un
  usage quotidien (récupérer les matchs, analyser, noter ses paris) et rester proche du carnet.
  Depuis la phase 6, l'app couvre tout le cycle (analyse → live/freebet → journal → statistiques) :
  vérifier au prochain échange que ce ressenti s'est amélioré.
- Poste de travail (Windows) : dépôt dans `C:\Users\larri\Desktop\CLAUDE`. Git portable dans
  `%LOCALAPPDATA%\Programs\PortableGit` (pas dans le PATH ; `bin\bash.exe` pour publier-pages.sh).
  Le Chromium de Playwright ne démarre pas sur ce PC : `PW_CANAL=chrome npm run e2e`.

## Reprise du 21 septembre 2026 (fait, gardé pour mémoire)

1. **Publier le code** : l'archive `carnet-paris-foot-code-source.zip` a été soit déposée par
   l'utilisateur à la racine du dépôt (via « Add file → Upload files » sur GitHub), soit jointe à la
   conversation. La décompresser **hors du dépôt** (elle contient `carnet-foot-app/` avec son `.git`),
   puis, depuis le dépôt de la session :
   `git fetch <dossier>/carnet-foot-app main --tags && git checkout -B main FETCH_HEAD && git push -f -u origin main --tags`
   (`-f` remplace le commit d'envoi du zip : le zip disparaît ainsi du dépôt ; ne rien perdre d'autre).
   Si la poussée vers `main` est refusée, pousser la branche de la session et demander à l'utilisateur
   de fusionner la pull request.
2. **Installer et vérifier** : `npm install` si le registre est accessible (sinon, les paquets exacts
   sont listés dans `package.json`), puis `npm run check`. Tout doit être vert.
3. **Mettre en ligne** : `bash scripts/publier-pages.sh`. Il construit `dist/` et pousse une branche
   `gh-pages`. Activer ensuite GitHub Pages sur cette branche : essayer l'API
   (`POST repos/Phoenixgott/carnet-foot/pages` avec `{"source":{"branch":"gh-pages","path":"/"}}`) ;
   si c'est refusé, demander à l'utilisateur : dépôt → Settings → Pages → Branch : `gh-pages` / `root` → Save.
   Si la poussée de `gh-pages` elle-même est refusée : publier depuis `main`, dossier `/docs`
   (renommer alors le dossier `docs/` actuel en `documentation/` et y copier `dist/`).
4. **Donner l'adresse** à l'utilisateur : https://phoenixgott.github.io/carnet-foot/ , puis lui expliquer :
   l'ouvrir dans Chrome, onglet Réglages → « Installer l'application », puis importer ses données
   (carnet → « Tout exporter » → onglet Données).
5. **Attendre son accord** avant de commencer la phase 2 (règle du cahier des charges : résumé de fin
   de phase, puis accord).

## Méthode de travail attendue

- Phase par phase : implémenter, tester, mettre à jour `CHANGELOG.md` et le README, commit, puis
  résumé court (ce qui marche, ce qui reste, recommandation) et attente de l'accord.
- Après chaque phase : `bash scripts/publier-pages.sh` pour mettre l'app à jour ; l'app propose alors
  « Mettre à jour » à l'utilisateur. Les données restent liées à l'adresse : ne jamais la changer.
- Toute modification d'un calcul du carnet v1 doit garder `tests/unit/non-regression-carnet.test.ts`
  vert ; un nouveau modèle se place à côté (`src/core/`), pas à la place.
