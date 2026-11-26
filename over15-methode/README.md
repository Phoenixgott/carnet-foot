# Over 1.5 – Méthode

Application Android d'aide à l'analyse des paris **« plus de 1,5 but »**, construite autour de la
méthode de Steven (Team Soccer Bet). Thème sombre, plein écran, 100 % hors ligne, avec un mode automatique
optionnel via une API football gratuite. **Réservée aux plus de 18 ans.**

## Télécharger l'APK

Lien direct vers la dernière version :
**https://github.com/Phoenixgott/carnet-foot/releases/latest/download/Over15-Methode.apk**

1. Ouvre le lien sur ton téléphone. Le téléchargement démarre.
2. Ouvre le fichier (notification, ou *Mes fichiers → Téléchargements*).
3. Si Android le demande, autorise l'installation depuis ton navigateur.
4. Touche **Installer** (ou **Mettre à jour** : tes données sont conservées).

Toutes les versions : https://github.com/Phoenixgott/carnet-foot/releases

## Écrans

| Onglet | Contenu |
| --- | --- |
| **Accueil** | Bankroll (réelle ou fictive) et sa courbe, réussite, bénéfice, ROI, cote moyenne, **taux minimum rentable (1 ÷ cote)**, mise fixe conseillée, limite de pertes de la semaine, matchs du jour (mode auto), derniers paris. |
| **Analyser** | Les 6 étapes obligatoires : Championnat → Équipes → Domicile/Extérieur → Blessés → Confrontations directes → Cote. Puis le score sur 100 et le verdict **FEUX OUVERTS** (vert), **PRUDENCE** (orange) ou **NE PAS PARIER** (rouge). |
| **Ligues** | % de matchs +1.5 sur 90 min (Ligue 1 89 %, Bundesliga 87 %, Premier League 81 %, Serie A 78 %, Liga 75 %), modifiables. Seuil réglable (85 % par défaut). Ajout de ligues « hors méthode ». |
| **Historique** | Tous les paris (match, cote, mise, verdict de l'app, résultat), réussite par couleur de verdict, saisie des résultats. |
| **Réglages** | Bankroll, % de mise, limite hebdo, mode TEST, pondérations, critères bloquants, clé d'API, export/import JSON, 18+ et Joueurs Info Service. |

## Règles appliquées

- **Critère bloquant non respecté = rouge forcé** : buteur clé absent (toujours), ligue hors méthode et
  équipes qui ne marquent ET n'encaissent pas (par défaut), les autres sont activables dans les réglages.
- **Paris en SIMPLE uniquement** : enregistrer un combiné déclenche un avertissement.
- **Pari live** : avertissement « déconseillé si tu t'emportes facilement ».
- **Mode TEST** activé par défaut : les 20 premiers paris sont fictifs, sur une bankroll d'entraînement séparée.
- **Bankroll** : mise fixe en % de la bankroll (2 % par défaut) et limite de pertes par semaine (10 % par défaut).
  Une fois la limite atteinte, les paris réels sont bloqués jusqu'au lundi.

### Calcul du score

Chaque étape reçoit une note de 0 à 1, multipliée par son poids (réglable) :
Championnat 20, Équipes 20, Domicile/Extérieur 25, Blessés 10, Confrontations 15, Cote 10.
Vert à partir de 75/100 sans critère raté, orange à partir de 55/100, rouge en dessous ou si un critère bloquant n'est pas respecté.
L'écran du verdict affiche aussi une probabilité estimée (mélange championnat, domicile/extérieur, loi de Poisson sur les buts attendus et confrontations), la cote juste et la value. Ce sont des estimations indicatives.

## Mode automatique (optionnel)

Dans **Réglages → Données automatiques**, choisis une API et colle ta clé gratuite :

- **API-Football** (api-sports.io) : offre gratuite de 100 requêtes par jour, avec tous les endpoints : matchs du jour,
  résultats de la saison (stats domicile/extérieur, buts, forme), **blessés**, meilleurs buteurs, confrontations directes et cotes.
  L'offre gratuite peut limiter les saisons accessibles : l'app affiche clairement l'erreur si c'est le cas.
- **football-data.org** : offre gratuite avec les 5 grands championnats (matchs, résultats, buteurs, confrontations),
  10 requêtes par minute, sans blessés ni cotes.

Les réponses sont mises en cache dans le téléphone (matchs du jour 30 min, saison 12 h, buteurs 24 h, blessés 3 h,
confrontations 24 h, cotes 1 h) pour économiser le quota. Le préremplissage est toujours vérifiable et modifiable étape par étape.

## Technique

- React 19 + Vite + TypeScript, emballé en application Android native avec **Capacitor 8**.
- Android 8+ (minSdk 26), cible Android 16 (API 36), portrait, plein écran bord à bord (encoches et barre de navigation gérées
  via les variables `--safe-area-inset-*` de Capacitor), bouton retour Android géré.
- Splash screen natif (API SplashScreen d'Android 12, rétrocompatible) de la même couleur que l'intro animée : pas d'écran blanc.
- Données stockées localement (aucun serveur). Sauvegarde : **Réglages → Exporter** (partage du fichier JSON vers Fichiers, Drive, mail…).

### Développement

```bash
cd over15-methode
npm install
npm run dev        # aperçu dans le navigateur
npm test           # tests de la méthode et de la bankroll
npm run android    # build web + projet Android (généré) + cap sync
cd android && ./gradlew assembleRelease
```

Le dossier `android/` n'est pas versionné : il est recréé par `npx cap add android`, puis
`scripts/preparer-android.mjs` y applique les réglages de l'app (icône vectorielle « +1.5 », splash screen
assorti à l'intro, portrait, Android 8+, numéro de version, signature).

### Build et publication automatiques

Le workflow `.github/workflows/over15-android.yml` se lance à chaque push qui touche `over15-methode/` :
tests → build web → projet Android → `gradlew assembleRelease` → vérification de la signature → GitHub Release `over15-v1.0.<n>`.

**Signature** : l'APK est signée avec la clé `signature/over15-sideload.jks.b64` du dépôt, pour que chaque nouvelle version
s'installe par-dessus la précédente sans perdre les données. Cette clé est publique (le dépôt l'est). Pour utiliser une clé privée,
ajoute les secrets GitHub `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD` :
le workflow les utilisera automatiquement. Il faudra alors désinstaller une fois l'ancienne version, après avoir exporté ses données.

---

18+ · Les jeux d'argent comportent des risques : endettement, isolement, dépendance.
Joueurs Info Service : 09 74 75 13 13 (appel non surtaxé), https://www.joueurs-info-service.fr/
Application indépendante, non affiliée à Team Soccer Bet.
