# Outsiders

Application Android qui dit si une **grosse cote est une bonne affaire ou un piège**, en mots simples.
Elle compare la chance donnée par ta cote (1 ÷ cote) à la **vraie chance** (cote Pinnacle sans sa marge,
sinon l'estimation de Claude ou la tienne). Thème sombre, plein écran, explications pas à pas à chaque écran.
**Réservée aux plus de 18 ans.**

## Télécharger l'APK

Lien direct vers la dernière version :
**https://github.com/Phoenixgott/carnet-foot/releases/latest/download/Outsiders.apk**

1. Ouvre le lien sur ton téléphone (Chrome). Le téléchargement démarre.
2. Ouvre le fichier (notification, ou *Mes fichiers → Téléchargements*).
3. Touche **Installer** (ou **Mettre à jour** : tes données sont conservées).

L'ancien lien (`…/Over15-Methode.apk`) fonctionne toujours et donne la même application.

## Les écrans

| Onglet | Ce qu'il fait |
| --- | --- |
| **Outsiders** | 5 étapes guidées pour « Demander à Claude » : copier la demande → ouvrir Claude → coller et envoyer → copier la réponse → la coller dans l'app. Claude cherche les outsiders du jour (cote d'au moins 3), leur cote chez Winamax/Unibet/Betclic, les cotes Pinnacle, et les signaux (xG, forme, Elo, absents du favori, fatigue, motivation, mouvement de cote). L'app calcule la value et classe : ✅ OK, ➖ Bof, ❌ Pas OK. |
| **Fiche d'un outsider** | Graphique « chance selon ta cote » contre « vraie chance », la value, une phrase simple, le plan (« vérifie que la cote est au moins à X, mise Y € »), les signaux, et « J'ai parié ». |
| **Calculer** | La calculatrice : ta cote + la cote Pinnacle (ou ton estimation en %) → ✅ bonne affaire ou ❌ piège, avec la cote minimum à exiger. |
| **Mes paris** | Anneau ✅ gagnés / ❌ perdus avec le % de réussite, « Est-ce que ça marche ? » (ta réussite contre le minimum 1 ÷ cote moyenne), bilan par tranche de cote (moins de 3, 3 à 5, 5 à 8, plus de 8), selon la value calculée et par championnat, courbe de ton argent. Bouton **« Trouver mes résultats »** : Claude trouve les scores, l'app met gagné/perdu toute seule. |
| **Comprendre** | La value en 2 minutes : 1 ÷ cote, l'astuce Pinnacle, quand parier, les signaux, la patience (séries de défaites normales), le bilan perso. |
| **Réglages** | Ton argent, ta mise (1 % conseillé), limite de pertes par semaine, entraînement (20 paris pour de faux), règles de la value (+5 %, cote d'outsider ≥ 3), sauvegarde, 18+ et Joueurs Info Service. |

## Le calcul

- Chance selon ta cote = 1 ÷ cote.
- Vraie chance = cotes Pinnacle 1-N-2 sans la marge (normalisation), ou une seule cote Pinnacle moins une marge de 3 %,
  sinon l'estimation de Claude, sinon la tienne.
- Value = vraie chance × cote − 1. ✅ OK à partir de +5 % (réglable), ➖ Bof entre 0 et +5 %, ❌ Pas OK en dessous.
- Cote minimum à exiger = (1 ÷ vraie chance) × 1,05.

## Garde-fous

Paris simples (avertissement sur les combinés), mise fixe en % de la bankroll, avertissement si la mise dépasse la mise fixe
ou si la value est négative, paris réels bloqués quand la limite de pertes de la semaine est atteinte, 20 paris d'entraînement.

## Technique

- React 19 + Vite + TypeScript, emballé en application Android native avec **Capacitor 8**.
- Android 8+ (minSdk 26), cible Android 16 (API 36), portrait, plein écran bord à bord, bouton retour Android géré.
- Splash screen natif assorti à l'intro animée (pas d'écran blanc), icône adaptative vectorielle « +EV » (avec version monochrome).
- « Demander à Claude » : la demande est copiée avec le plugin Presse-papiers de Capacitor ; la réponse JSON est relue,
  nettoyée (références de sources ajoutées par l'app Claude, virgules en trop) et vérifiée.
- Données stockées localement (aucun serveur), reprise automatique des données des versions précédentes.
  Sauvegarde : **Réglages → Sauvegarder mes données** (fichier JSON).

### Développement

```bash
cd over15-methode
npm install
npm run dev        # aperçu dans le navigateur
npm test           # tests du calcul de value, de la lecture des réponses de Claude et de la bankroll
npm run android    # build web + projet Android (généré) + cap sync
cd android && ./gradlew assembleRelease
```

Le dossier `android/` n'est pas versionné : il est recréé par `npx cap add android`, puis
`scripts/preparer-android.mjs` y applique les réglages de l'app (icône, splash, portrait, Android 8+, version, signature).

### Build et publication automatiques

Le workflow `.github/workflows/over15-android.yml` se lance à chaque push qui touche `over15-methode/` :
tests → build web → projet Android → `gradlew assembleRelease` → vérification de la signature → GitHub Release `outsiders-v3.0.<n>`.

**Signature** : l'APK est signée avec la clé `signature/over15-sideload.jks.b64` du dépôt, pour que chaque nouvelle version
s'installe par-dessus la précédente sans perdre les données. Cette clé est publique (le dépôt l'est). Pour utiliser une clé privée,
ajoute les secrets GitHub `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD`.

---

18+ · Les jeux d'argent comportent des risques : endettement, isolement, dépendance.
Joueurs Info Service : 09 74 75 13 13 (appel non surtaxé), https://www.joueurs-info-service.fr/
Application indépendante, non affiliée à un bookmaker.
