# Over 1.5 – Méthode

Application Android qui choisit les matchs « plus de 1,5 but » et te guide pendant le match, selon la
méthode live de Steven (Team Soccer Bet). Thème sombre, plein écran, explications pas à pas. Les infos des matchs
sont cherchées par Claude (gratuit avec ton abonnement), tout le reste fonctionne hors ligne. **Réservée aux plus de 18 ans.**

## Télécharger l'APK

Lien direct vers la dernière version :
**https://github.com/Phoenixgott/carnet-foot/releases/latest/download/Over15-Methode.apk**

1. Ouvre le lien sur ton téléphone. Le téléchargement démarre.
2. Ouvre le fichier (notification, ou *Mes fichiers → Téléchargements*).
3. Si Android le demande, autorise l'installation depuis ton navigateur.
4. Touche **Installer** (ou **Mettre à jour** : tes données sont conservées).

Toutes les versions : https://github.com/Phoenixgott/carnet-foot/releases

## Comment ça marche (version 2 : la méthode live de la vidéo)

L'app suit la vidéo « Over 1.5 buts » de Steven (Team Soccer Bet) et te guide à chaque écran avec un encadré
**« 👉 Ce que tu fais maintenant »** : des étapes numérotées, en mots simples.

| Onglet | Ce qu'il fait |
| --- | --- |
| **Matchs** | 5 étapes guidées pour « Demander à Claude » : copier la demande → ouvrir Claude → coller et envoyer → copier la réponse → la coller dans l'app. Claude cherche les infos sur le web (toutes compétitions : championnats, Ligue des champions, Ligue Europa, Ligue des nations, Brésil…). L'app analyse chaque match et met un feu 🟢 🟠 🔴. |
| **Fiche d'un match** | Le feu, une phrase, « Le plan pour ce match », et les 4 critères expliqués (« Pourquoi c'est important ? »). On peut corriger une info à la main. |
| **Live** | Chrono depuis le coup d'envoi. Vers la 15e–20e minute : 0-0 ? match animé ? quelle cote ? → « C'est bon, mise X € » ou « Trop basse, attends ». Bouton **BUT !** → sécurisation (pari contraire « Moins de 1,5 but » ou cash-out) avec le montant exact et le gain garanti. |
| **Mes paris** | « Gagné X € » / « Perdu X € », courbe de ton argent, « La méthode marche-t-elle pour toi ? » (réussite contre 1 ÷ cote moyenne), limite de la semaine. |
| **Comprendre** | La méthode en 2 minutes, avec les chiffres de la recherche (où tombent les buts, pourquoi attendre le live, comment sécuriser). |
| **Réglages** | Ton argent et ta mise (2 %), limite par semaine (10 %), entraînement (20 paris pour de faux), règles du live (cote minimum 1,70, entrée 15e–20e, plus d'entrée après la 30e), sauvegarde, 18+ et Joueurs Info Service. |

### Les 4 critères (vidéo)

1. **Les deux équipes marquent ET encaissent** : au moins 1 but marqué et 1 encaissé par match (exemple de la vidéo : 27 marqués / 9 encaissés en 16 matchs = écarté).
2. **Les meilleurs buteurs jouent** : une absence en attaque = signal d'alarme (rouge si un meilleur buteur est absent).
3. **Beaucoup de matchs avec 2 buts ou plus** : 75 % des matchs de chaque équipe (réglable).
4. **Pas de pression excessive** : pas de finale, derby, maintien, montée, ni match sans enjeu.

Feu vert = les 4 sont bons. Orange = une info est moyenne ou manquante. Rouge = un critère n'est pas bon.

### Le live, en chiffres

- Les chances de voir 2 buts sont estimées par une loi de Poisson à partir des buts attendus (attaque et défense des deux équipes)
  et de la part des buts encore à venir à la minute donnée (répartition des buts par quart d'heure : 11,5 % avant la 15e,
  24,6 % après la 75e, Premier League 2024, SoccerSTATS).
- Cote minimum = 1,70 (règle de la méthode), ou plus si le match est moins prometteur (cote juste + 5 %).
- Sécurisation : mise contraire = mise × cote ÷ cote « Moins de 1,5 » ; le gain est le même quel que soit le résultat.

### Garde-fous

Paris simples uniquement (avertissement sur les combinés), avertissement sur le live, 20 paris d'entraînement,
mise fixe en % de la bankroll, paris réels bloqués quand la limite de pertes de la semaine est atteinte.

## Technique

- React 19 + Vite + TypeScript, emballé en application Android native avec **Capacitor 8**.
- Android 8+ (minSdk 26), cible Android 16 (API 36), portrait, plein écran bord à bord (encoches et barre de navigation gérées
  via les variables `--safe-area-inset-*` de Capacitor), bouton retour Android géré.
- Splash screen natif (API SplashScreen d'Android 12, rétrocompatible) de la même couleur que l'intro animée : pas d'écran blanc.
- « Demander à Claude » : la demande est copiée avec le plugin Presse-papiers de Capacitor, la réponse JSON est relue et vérifiée par l'app.
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
