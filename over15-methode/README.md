# Outsiders

Application Android qui dit si une **grosse cote est une bonne affaire ou un piège**, en mots simples.
Elle compare la chance donnée par ta cote (1 ÷ cote) à la **vraie chance** (cote Pinnacle sans sa marge,
sinon l'estimation de Claude ou la tienne). Design clair et coloré, gros boutons, un coach animé et des mini-vidéos qui montrent quoi faire.
**Réservée aux plus de 18 ans.**

## Télécharger l'APK

Lien direct vers la dernière version :
**https://github.com/Phoenixgott/carnet-foot/releases/latest/download/Outsiders.apk**

1. Ouvre le lien sur ton téléphone (Chrome). Le téléchargement démarre.
2. Ouvre le fichier (notification, ou *Mes fichiers → Téléchargements*).
3. Touche **Installer** (ou **Mettre à jour** : tes données sont conservées).

L'ancien lien (`…/Over15-Methode.apk`) fonctionne toujours et donne la même application.

## Les écrans (design v4 : clair, gros boutons, un coach qui te guide)

| Écran | Ce qu'il fait |
| --- | --- |
| **Accueil** | Le coach (un ballon animé) + 4 grosses tuiles : Trouver, Vérifier, Système, Mes paris, et « Comment ça marche ? ». |
| **🔎 Trouver** | Mini-vidéo + 3 gros boutons : **Copier** → **Ouvrir Claude** → **Coller la réponse**. Claude cherche les outsiders du jour, leurs cotes et la cote Pinnacle ; l'app affiche ✅ bonne affaire, ➖ bof ou ❌ piège, et ce qu'il faut miser. |
| **✅ Vérifier** | 2 questions (ta cote, puis la cote Pinnacle ou ton estimation en %) → un gros verdict ✅/❌ et « J'ai parié ». |
| **🎯 Système** | Système de doubles : nombre de matchs (6 = 15 doubles), mise par double (0,10 € à 1 €), cote minimum pour être remboursé avec 2 bons (≈ 3,90 pour 6 matchs), le tableau « cote du 1er match → cote minimum du 2e » (2,00 → 7,50 … 5,00 → 3,00), les minimums avec 3, 4, 5 bons (2,25 · 1,60 · 1,25), et un vérificateur (tape tes cotes, touche ✅/❌ → remboursé ou pas, et combien). |
| **📊 Mes paris** | Anneau ✅/❌ avec le % de réussite, « Est-ce que ça marche ? », bilan par tranche de cote, selon la value et par championnat, courbe de ton argent, et « Trouver mes résultats » avec Claude. |
| **🎬 Comment ça marche** | 3 mini-vidéos animées (Claude, bonne affaire ou piège, système de doubles) et les règles d'or. |
| **⚙️ Réglages** | Ton argent, ta mise (1 % conseillé), limite par semaine, entraînement, règles de la value, sauvegarde, 18+ et Joueurs Info Service. |

### Le système de doubles

Avec N matchs, on joue C(N, 2) doubles (6 matchs = 15 doubles). Si seulement 2 matchs sont gagnés, un seul double rapporte :
il faut cote 1 × cote 2 ≥ nombre de doubles pour récupérer la mise totale, quelle que soit la mise par double.
Avec k bons pronostics de cotes proches : cote minimum ≈ √(doubles ÷ C(k, 2)), arrondie au 0,05 supérieur.

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
