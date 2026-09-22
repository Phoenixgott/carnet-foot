# Carnet de Paris Foot

Application privée et hors ligne pour les méthodes **+1.5** et **+2.5**. Réservée aux plus de 18 ans.
Tout reste sur ton téléphone : aucune donnée n'est envoyée à un serveur, et l'application
interdit elle-même toute connexion vers un autre site (règle de sécurité `connect-src 'self'`).

> Aucune méthode ne gagne à tous les coups : les chances affichées sont des estimations, qui
> peuvent se tromper. Réservé aux plus de 18 ans.

---

## Utilisation

### 0. Premier démarrage

L'accueil te pose une seule question : **combien as-tu pour parier ?** (ta bankroll de départ,
33 €, 200 €… c'est toi qui choisis). Ensuite, trois tuiles : noter un pari, trouver des matchs, ou
importer ton ancien carnet. Tu changes ta bankroll quand tu veux dans **Réglages → Ma bankroll**.

### 1. Récupérer tes données du carnet

1. Ouvre ton carnet (l'artefact « Carnet de Paris Foot »), onglet **Mes paris**.
2. Tout en bas, touche **Tout exporter** : le texte est copié (sinon, il s'affiche sélectionné, copie-le à la main).
3. Dans l'application, onglet **Données**, colle le texte dans « Importer depuis le carnet ».
4. L'aperçu montre ce qu'il y a de nouveau (paris, matchs) ; touche **Importer**.

L'import n'ajoute que ce que l'application ne connaît pas encore : il ne remplace ni n'efface jamais
un pari, même modifié dans l'application depuis (**l'application est désormais ton carnet de paris** ;
le carnet original reste une source que tu peux réimporter à tout moment sans rien perdre).
Une copie de sécurité est faite avant chaque import, et l'historique permet de revenir en arrière.

L'ancienne sauvegarde du carnet (bouton « Copier ma sauvegarde ») est aussi acceptée,
mais elle ne contient que les paris et les réglages.

### 2. Récupérer les matchs du jour

Onglet **Matchs → Récupérer les matchs** :

1. Choisis le jour, les compétitions et le nombre de matchs, puis **Copier la demande**.
2. Ouvre une nouvelle conversation Claude avec la **recherche web**, colle et envoie.
   Si Claude écrit « SUITE DISPONIBLE », réponds **continue**.
3. Colle chaque réponse dans « Réponse de Claude » : l'aperçu montre les nouveaux matchs,
   ceux complétés, les doublons et les valeurs écartées. Touche **Enregistrer**.

S'il manque des infos, copie la **demande de compléments** proposée. Le jour du match,
**Copier la demande de cotes** redemande les cotes et les absents : chaque changement de cote est
gardé dans « Cotes et suivi » (sur chaque match), où tu peux aussi taper les cotes à la main et
choisir ta cote minimale. Quand une cote l'atteint : alerte sur la carte, sur l'accueil, et
notification si elles sont activées.

**Historiques** : onglet Données, « Historiques de résultats (CSV) », choisis les fichiers
téléchargés sur football-data.co.uk (rubrique Data Files).

### 3. Lire l'analyse

Chaque match montre, pour +1.5 et +2.5 : le verdict (✅ On joue, ⏳ À revoir, ❌ On passe) et sa raison
en une phrase, les chances et leur fourchette, la cote juste et la cote minimale (à exiger par
prudence), la value quand la cote est connue, le risque sur 5, et les chiffres du carnet à côté.
« Pourquoi ? » détaille chaque critère et chaque étape du calcul. **Par intérêt** classe les matchs
du jour ; **Comparer** en met deux côte à côte ; le nom d'une équipe ouvre sa fiche (forme, séries,
confrontations, grâce aux historiques CSV). Les seuils des critères et le poids des absents se
règlent dans **Réglages → Analyse des matchs**.

Rappel : ces chances sont des estimations, elles peuvent se tromper.

### 4. Suivre un match en live (méthode +1.5)

Onglet **Live** (ou « Suivre en live » sur un match) :

1. **Coup d'envoi** au début du match ; cale le chronomètre si besoin (−1 / +1 min, ou « Caler »).
   La fenêtre **15ᵉ-20ᵉ minute** est annoncée par un bandeau, une vibration et une notification.
2. **J'entre ?** : tape la cote « plus de 1,5 but », choisis 0-0 et « Animé » ou « Fermé ». Tu vois le
   verdict, la cote juste et la cote minimale à cette minute, la value, et le tableau jusqu'à la 40ᵉ.
   Touche **J'ai parié** (mise conseillée par défaut).
3. **BUT !** dès qu'un but est marqué : choisis pari contraire, exchange ou cash-out, tape la cote
   proposée. L'écran donne la mise à placer, le gain garanti et le résultat de chaque scénario, avec et
   sans couverture.

Le live est gardé sur ton téléphone : tu peux fermer l'app et la rouvrir. Il n'est pas dans la
sauvegarde. **Noter ce pari dans mon journal** prépare l'ajout dans l'onglet Paris avec la cote, la
mise et (si tu as couvert) le gain garanti déjà remplis ; il ne reste qu'à confirmer.

### 5. Mes paris (journal et bankroll)

Onglet **Paris**, trois sous-écrans :

- **Journal** : ajoute, modifie ou supprime un pari (match, méthode, cote, mise, statut, notes,
  photo du ticket). Lier un match chargé remplit le texte et la date. Un pari « gain sécurisé »
  (couverture, cash-out…) se note avec son propre résultat plutôt que la formule de la méthode.
- **Statistiques** : courbe de bankroll, drawdown maximal, séries en cours, ROI, taux de réussite,
  et répartition des gains par méthode, compétition, jour de la semaine et tranche de cote.
- **Simulateur** : rejoue tes paris déjà notés avec une autre mise (fixe ou % de la bankroll de
  départ) pour comparer au résultat réel, sans toucher à tes vraies données.

La mise conseillée suit le réglage choisi dans **Réglages → Mises et objectifs** : mise fixe ou
Kelly fractionné, avec un plafond par pari et par jour (avertissement, jamais un blocage) et un
objectif de gain / budget du mois.

### 6. Jeu responsable, recherche et aide

- **Réglages → Jeu responsable** : un rappel peut s'afficher sur l'accueil après un nombre de
  défaites d'affilée ou un plafond du jour dépassé (à toi de les régler, désactivés par défaut).
  Tu peux aussi te mettre en pause toi-même (24 h, 3 jours, 7 jours ou une durée choisie) : pendant
  une pause, tu ne peux plus ajouter de nouveau pari (modifier ou supprimer ceux déjà notés reste
  possible), et tu l'arrêtes quand tu veux, avec une confirmation.
- **Recherche** (lien sur l'accueil, ou dans Réglages) : retrouve un match, un pari ou une offre en
  tapant un mot.
- **Comment ça marche ?** (Réglages) : chaque méthode et chaque chiffre affiché dans l'app, expliqué
  en une phrase.
- **Tout remettre à zéro** (Réglages, en bas) : efface paris, matchs, bankroll et réglages pour
  repartir comme au premier jour. Une copie de sécurité reste dans Données → Historique des versions.

### 7. Sauvegarder

- **Données → Sauvegarde en un fichier** : « Enregistrer le fichier », « Partager (Drive, mail…) »
  ou « Copier le texte ». Garde ce fichier hors du téléphone : si le navigateur efface ses
  données, c'est ta seule copie. L'accueil te le rappelle après 7 jours sans sauvegarde.
- **Copies automatiques** : une par jour (30 gardées) et une avant chaque import ou restauration
  (15 gardées), dans **Données → Historique des versions**.
- **Restaurer** : choisis le fichier ou colle son texte. Une empreinte vérifie que le fichier
  n'a pas été abîmé ou modifié ; sinon il est refusé.

### 8. Installer sur Android (version hébergée)

L'application est hébergée sur GitHub Pages : https://phoenixgott.github.io/carnet-foot/
Ouvre cette adresse dans Chrome, puis **Réglages → Installer l'application**
(ou menu ⋮ → « Installer l'application »). Elle fonctionne ensuite sans réseau.
Tes données sont liées à cette adresse : garde toujours la même.

### Notifications

Elles sont créées sur le téléphone, sans serveur : une alerte ne peut partir que si
l'application est ouverte ou vient d'être utilisée. Active-les dans **Réglages**.

---

## Développement

Prérequis : Node.js 22.

```bash
npm install          # si le registre npm est accessible (voir plus bas)
npm run dev          # reconstruit à chaque modification, sert sur http://localhost:5173
npm run build        # construit dist/ (à héberger tel quel, en HTTPS)
npm run preview      # construit puis sert dist/ sur http://localhost:4173
npm run typecheck    # TypeScript strict : app, service worker, tests
npm test             # tests unitaires (lanceur intégré à Node)
npm run e2e          # tests de bout en bout dans Chromium (Playwright)
                     # PW_CANAL=chrome : avec le Google Chrome installé
npm run check        # tout : types + unitaires + bout en bout
bash scripts/publier-pages.sh   # construit et publie sur la branche gh-pages (GitHub Pages)
```

Pour reprendre le projet dans une nouvelle session : lire `docs/REPRISE.md`.

### Organisation du code

```
src/
  core/            calculs purs, sans écran, entièrement testés
    carnet-v1/     modèle du carnet d'origine, repris à l'identique (buts attendus,
                   fiabilité sur 8, critères +1.5/+2.5, verdicts, décisions live/avant-match)
    poisson.ts     loi de Poisson
    couverture.ts  couverture +1.5 (pari contraire, lay, cash-out)
    paris.ts       gains, bankroll, bilan, ROI
    bankroll.ts    courbe de bankroll, drawdown maximal, séries, ventilations (méthode, compétition,
                   jour de semaine, tranche de cote)
    mises.ts       mise conseillée (fixe ou Kelly fractionné), plafonds par pari/jour (alerte, jamais
                   un blocage)
    objectifs.ts   objectif de gain et budget du mois
    simulateur.ts  rejoue les paris notés avec une autre mise, sans toucher aux vraies données
    jeu-responsable.ts  rappels (défaites d'affilée, plafond du jour), pause/auto-exclusion posée
                   et retirée par l'utilisateur
    bilan-hebdo.ts bilan de la semaine en cours et de la précédente
    recherche.ts   recherche globale (matchs, paris, offres), insensible aux accents
    methodes.ts    noms exacts des méthodes et codes du carnet (m1 = +1.5, m3 = +2.5, m2 = Freebet)
    demande.ts     demande à l'autre conversation Claude (jour, compléments, cotes du jour J)
    cotes.ts       suivi des cotes, cote minimale, alertes ; marge.ts : marge du bookmaker
    saison.ts      saison d'après la date
    modele-v2/     nouveau modèle (phase 3) : buts attendus et incertitude (modele.ts), analyse par
                   méthode (analyse.ts), répartition des buts dans le temps (temps.ts), chiffres
                   des championnats (championnat.ts), intérêt, fiches équipe, réglages,
                   live +1.5 : fenêtre, décision d'entrée, couverture et scénarios (live.ts)
  data/            stockage IndexedDB, import du carnet (fusion additive : n'efface ni ne remplace un
                   pari déjà connu), import des matchs (import-matchs.ts), historiques CSV
                   (import-csv.ts), sauvegardes, versions, photo du ticket (magasin à part, hors
                   sauvegarde)
  pwa/             service worker (hors ligne), installation, notifications
  ui/              interface (React), écrans, styles (dont ui/paris/ : journal, statistiques,
                   simulateur ; ui/jeu-responsable/ : pause active)
tests/
  unit/            tests unitaires, dont la non-régression contre le code original du carnet
  e2e/             tests dans Chromium : migration réelle, sauvegarde, hors ligne, accessibilité
  fixtures/        copie exacte de l'artefact du carnet d'origine
```

### Garde-fous

- **Non-régression** : `tests/helpers/carnet-original.ts` extrait le JavaScript de l'artefact
  d'origine (sans le modifier) et l'exécute à côté du code porté, sur plus de 1 000 matchs
  générés, dont des cas construits sur les seuils. Chiffres, verdicts et textes doivent être identiques.
- **Migration réelle** : `tests/e2e/migration.spec.ts` ouvre le vrai carnet dans Chromium,
  clique « Tout exporter », importe dans l'application et compare bankroll, gains par méthode
  et chances de chaque match affichés des deux côtés.
- **Accessibilité** : audit automatique à 360 et 412 px, en clair et en sombre (noms accessibles,
  étiquettes, cibles tactiles ≥ 44 px, pas de défilement horizontal), contrastes AA calculés
  sur les jetons de couleur, navigation au clavier.
- **Fusion additive du carnet** : un pari importé est reconnu par sa position **et** son contenu
  (date, méthode, cote, mise) au moment de l'import, pour ne jamais en perdre un si le carnet est
  réordonné ou qu'un pari y est supprimé entre deux imports (`tests/unit/donnees.test.ts`).

### Choix techniques et écarts

- **esbuild au lieu de Vite** : l'environnement de construction n'avait pas accès au registre npm.
  esbuild (le moteur de Vite) était disponible. `scripts/build.mjs` fait le travail de
  `vite build` et du plugin PWA (noms hachés, liste de mise en cache du service worker).
  Pour passer à Vite : `npm i -D vite @vitejs/plugin-react vite-plugin-pwa`, créer
  `vite.config.ts` (plugins react et VitePWA en mode `injectManifest` avec `src/pwa/sw.ts`),
  et remplacer `__PRECACHE__` par `self.__WB_MANIFEST`.
- **Types React** : `src/types/react-shim.d.ts` remplace `@types/react`, non installable ici.
  À remplacer par `npm i -D @types/react @types/react-dom` dès que possible.
- **Tests unitaires** : lanceur intégré à Node (`node --test`) au lieu de Vitest, même raison.
- **Police** : celle du téléphone (Roboto sur Android). Aucune police téléchargée.

### Variante « aperçu »

`npm run build:apercu` produit `dist-apercu/`, publiable comme artefact Claude pour essayer
l'application sans hébergement. Le bac à sable des artefacts bloque le service worker et les
téléchargements : pas de hors ligne, pas d'installation, sauvegarde par copie du texte seulement.

---

## Formats de données

- **Match** : le format du carnet d'origine (voir `src/core/types.ts`), plus `cotes.under15` et
  `cotes.under25`, et deux champs propres à l'application : `historiqueCotes` (relevés datés) et
  `coteCible` (cote minimale choisie). Un champ absent ou `null` est une donnée inconnue, affichée ⏳.
- **Résultat** (historiques CSV) : magasin `resultats` à part, hors sauvegarde (données publiques).
- **Live** : réglage local `live` (`src/data/live.ts`), hors sauvegarde et jamais remplacé par une restauration.
- Un réimport du carnet ne touche pas aux réglages que le carnet ne fournit pas, ni à la bankroll
  déjà choisie dans l'application.
- **Pari** (`src/core/types.ts`) : ceux du carnet, plus `ligue` et `matchId` (facultatifs, remplis en
  liant un match chargé) et `origine.carnet` (index et empreinte du contenu au moment de l'import,
  pour la fusion additive — absent pour un pari ajouté dans l'application). Réglages `mises` et
  `objectifs` (Kelly, plafonds, objectif/budget du mois) dans la sauvegarde ; `brouillonPari` (pari
  préparé depuis le Live, en attente d'être confirmé dans le journal) hors sauvegarde.
- **Photo du ticket** : magasin IndexedDB `tickets` à part (JPEG redimensionné), hors sauvegarde
  fichier et hors historique des versions — elle ne quitte jamais le téléphone.
- **Jeu responsable** : réglage `jeuResponsable` (seuils de rappel, durée de pause proposée) et
  réglage `pause` (`{ debut, fin, raison }` ou `null`), tous deux dans la sauvegarde — une pause
  posée reste posée même après une restauration. Voir `src/core/jeu-responsable.ts`.
- **Sauvegarde** : `{ app: "carnet-foot", type: "sauvegarde", schema: 1, creeLe, versionApp,
  contenu: { matchs, paris, reglages }, controle: { nbMatchs, nbParis, bankroll, gainsTotal, empreinte } }`.
  L'empreinte est un SHA-256 du contenu trié.
- **Export du carnet** : `{ app: "carnet-paris-foot", type: "export-complet", version: 1, cles: {...}, controle: {...} }`.

## Jeu responsable

Jouer comporte des risques : endettement, dépendance… Appelle le 09 74 75 13 13
(appel non surtaxé) ou va sur joueurs-info-service.fr.
