// Prépare le projet Android généré par Capacitor (`npx cap add android`) :
// icônes vectorielles, splash screen assorti à l'intro, portrait, Android 8+, version et signature.
// Le script est idempotent : on peut le relancer sans risque.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
const res = join(android, 'app/src/main/res');
if (!existsSync(join(android, 'app'))) {
  console.error("Projet Android absent : lance d'abord « npx cap add android ».");
  process.exit(1);
}

const write = (rel, content) => {
  const f = join(android, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, content);
};
const patch = (rel, fn) => {
  const f = join(android, rel);
  writeFileSync(f, fn(readFileSync(f, 'utf8')));
};
const replaceOnce = (s, re, by, label) => {
  if (!re.test(s)) throw new Error('Motif introuvable : ' + label);
  return s.replace(re, by);
};

// 1. Ressources du gabarit à remplacer (images Capacitor par défaut).
for (const dir of readdirSync(res)) {
  const full = join(res, dir);
  if (/^drawable-(land|port)-/.test(dir) || dir === 'drawable-v24' || dir === 'mipmap-anydpi-v26') rmSync(full, { recursive: true, force: true });
  else if (/^mipmap-/.test(dir)) for (const f of readdirSync(full)) if (/^ic_launcher.*\.png$/.test(f)) rmSync(join(full, f));
}
for (const f of ['drawable/splash.png', 'drawable/ic_launcher_background.xml', 'values/ic_launcher_background.xml']) rmSync(join(res, f), { force: true });

// 2. Logo « +1.5 » (Barlow Condensed ExtraBold vectorisé) dans un carré de 108.
const TEXT = 'M43.02 53.14Q43.20 53.14 43.33 53.26Q43.45 53.39 43.45 53.57L43.45 57.17Q43.45 57.35 43.33 57.47Q43.20 57.60 43.02 57.60L38.77 57.60Q38.59 57.60 38.59 57.78L38.59 62.03Q38.59 62.21 38.47 62.33Q38.34 62.46 38.16 62.46L34.52 62.46Q34.34 62.46 34.22 62.33Q34.09 62.21 34.09 62.03L34.09 57.78Q34.09 57.60 33.91 57.60L29.66 57.60Q29.48 57.60 29.36 57.47Q29.23 57.35 29.23 57.17L29.23 53.57Q29.23 53.39 29.36 53.26Q29.48 53.14 29.66 53.14L33.91 53.14Q34.09 53.14 34.09 52.96L34.09 48.67Q34.09 48.49 34.22 48.37Q34.34 48.24 34.52 48.24L38.16 48.24Q38.34 48.24 38.47 48.37Q38.59 48.49 38.59 48.67L38.59 52.96Q38.59 53.14 38.77 53.14L43.02 53.14ZM47.59 41.36Q47.88 41.26 48.13 41.26L53.39 41.26Q53.57 41.26 53.69 41.38Q53.82 41.51 53.82 41.69L53.82 66.02Q53.82 66.20 53.69 66.33Q53.57 66.46 53.39 66.46L48.28 66.46Q48.10 66.46 47.97 66.33Q47.84 66.20 47.84 66.02L47.84 47.05Q47.84 46.87 47.66 46.87L45 47.02Q44.57 47.02 44.57 46.62L44.50 42.80Q44.50 42.44 44.86 42.34L47.59 41.36ZM59.04 66.67Q57.67 66.67 56.79 65.79Q55.91 64.91 55.91 63.54Q55.91 62.14 56.79 61.27Q57.67 60.41 59.04 60.41Q60.41 60.41 61.27 61.27Q62.14 62.14 62.14 63.54Q62.14 64.91 61.25 65.79Q60.37 66.67 59.04 66.67ZM78.70 56.77Q78.77 57.31 78.77 58.54Q78.77 59.90 78.73 60.59Q78.70 63.47 76.72 65.11Q74.74 66.74 71.42 66.74Q68.36 66.74 66.47 65.25Q64.58 63.76 64.22 60.77L64.15 59.76Q64.15 59.33 64.58 59.33L69.70 59.33Q70.09 59.33 70.13 59.65L70.13 59.87L70.20 60.26Q70.38 61.63 71.42 61.63Q72 61.63 72.34 61.25Q72.68 60.88 72.76 60.16Q72.79 59.65 72.79 58.54Q72.79 57.53 72.72 57.13Q72.65 56.48 72.31 56.09Q71.96 55.69 71.42 55.69Q70.96 55.69 70.61 55.93Q70.27 56.16 70.16 56.56Q70.06 56.95 69.70 56.95L64.55 56.95Q64.37 56.95 64.24 56.83Q64.12 56.70 64.12 56.52L64.12 41.69Q64.12 41.51 64.24 41.38Q64.37 41.26 64.55 41.26L78.19 41.26Q78.37 41.26 78.50 41.38Q78.62 41.51 78.62 41.69L78.62 45.94Q78.62 46.12 78.50 46.24Q78.37 46.37 78.19 46.37L70.27 46.37Q70.09 46.37 70.09 46.55L70.09 51.62Q70.09 51.73 70.16 51.75Q70.24 51.77 70.31 51.70Q71.57 50.54 73.33 50.54Q75.78 50.54 77.22 52.20Q78.66 53.86 78.70 56.77Z';
const NS = 'xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt"';
const ring = (mono) =>
  `<path android:pathData="M54,22.5a31.5,31.5 0 1,1 0,63a31.5,31.5 0 1,1 0,-63" android:fillColor="#00000000" android:strokeColor="${mono ? '#FFFFFF' : '#3DFF9F'}" android:strokeAlpha="${mono ? 1 : 0.55}" android:strokeWidth="${mono ? 2.6 : 1.8}"/>`;
const ball = (mono) =>
  `<path android:pathData="M54,19a3.6,3.6 0 1,1 0,7.2a3.6,3.6 0 1,1 0,-7.2" android:fillColor="#FFFFFF"${mono ? '' : ' android:strokeColor="#0A2416" android:strokeWidth="0.9"'}/>`;
const glow = `<path android:pathData="${TEXT}" android:fillColor="#00000000" android:strokeColor="#3DFF9F" android:strokeAlpha="0.16" android:strokeWidth="4.2" android:strokeLineJoin="round"/>
    <path android:pathData="${TEXT}" android:fillColor="#00000000" android:strokeColor="#3DFF9F" android:strokeAlpha="0.3" android:strokeWidth="2" android:strokeLineJoin="round"/>`;
const text = (mono) =>
  mono
    ? `<path android:pathData="${TEXT}" android:fillColor="#FFFFFF"/>`
    : `<path android:pathData="${TEXT}">
        <aapt:attr name="android:fillColor">
            <gradient android:type="linear" android:startX="30" android:startY="41" android:endX="78" android:endY="67">
                <item android:offset="0" android:color="#FFE8FFA0"/>
                <item android:offset="0.4" android:color="#FFC9FF52"/>
                <item android:offset="1" android:color="#FF3DFF9F"/>
            </gradient>
        </aapt:attr>
    </path>`;
const logo = (mono = false) => [ring(mono), mono ? '' : glow, text(mono), ball(mono)].filter(Boolean).join('\n    ');

write('app/src/main/res/drawable/o15_icon_fg.xml', `<?xml version="1.0" encoding="utf-8"?>
<vector ${NS} android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    ${logo()}
</vector>
`);
write('app/src/main/res/drawable/o15_icon_mono.xml', `<?xml version="1.0" encoding="utf-8"?>
<vector ${NS} android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    ${logo(true)}
</vector>
`);
write('app/src/main/res/drawable/o15_icon_bg.xml', `<?xml version="1.0" encoding="utf-8"?>
<vector ${NS} android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient android:type="radial" android:centerX="54" android:centerY="41" android:gradientRadius="76">
                <item android:offset="0" android:color="#FF14522F"/>
                <item android:offset="0.55" android:color="#FF0B2B19"/>
                <item android:offset="1" android:color="#FF06150D"/>
            </gradient>
        </aapt:attr>
    </path>
    <path android:pathData="M6,0h10v108h-10z M26,0h10v108h-10z M46,0h10v108h-10z M66,0h10v108h-10z M86,0h10v108h-10z" android:fillColor="#FFFFFF" android:fillAlpha="0.03"/>
</vector>
`);
// Icône du splash Android 12+ : toile de 288 dp, logo dans le cercle central de 192 dp.
write('app/src/main/res/drawable/splash_icon.xml', `<?xml version="1.0" encoding="utf-8"?>
<vector ${NS} android:width="288dp" android:height="288dp" android:viewportWidth="162" android:viewportHeight="162">
    <group android:translateX="27" android:translateY="27">
    ${logo()}
    </group>
</vector>
`);
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/o15_icon_bg"/>
    <foreground android:drawable="@drawable/o15_icon_fg"/>
    <monochrome android:drawable="@drawable/o15_icon_mono"/>
</adaptive-icon>
`;
write('app/src/main/res/mipmap-anydpi/ic_launcher.xml', adaptive);
write('app/src/main/res/mipmap-anydpi/ic_launcher_round.xml', adaptive);

// 3. Couleurs, thème et splash (aucun écran blanc : tout est sur le fond de l'intro).
write('app/src/main/res/values/o15_colors.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="o15_bg">#050B08</color>
    <color name="o15_green">#3DFF9F</color>
</resources>
`);
write('app/src/main/res/drawable/splash.xml', `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/o15_bg"/>
    <item android:drawable="@drawable/splash_icon" android:gravity="center" android:width="192dp" android:height="192dp"/>
</layer-list>
`);
write('app/src/main/res/values/styles.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
        <item name="colorPrimary">@color/o15_bg</item>
        <item name="colorPrimaryDark">@color/o15_bg</item>
        <item name="colorAccent">@color/o15_green</item>
        <item name="android:windowBackground">@color/o15_bg</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">@color/o15_bg</item>
        <item name="colorAccent">@color/o15_green</item>
    </style>

    <!-- Splash screen natif (API SplashScreen d'Android 12, rétrocompatible Android 8+). -->
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/o15_bg</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="windowSplashScreenAnimationDuration">300</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:windowBackground">@color/o15_bg</item>
    </style>
</resources>
`);

// 4. Manifeste : portrait, clavier, vibrations.
patch('app/src/main/AndroidManifest.xml', (s) => {
  if (!s.includes('screenOrientation')) s = replaceOnce(s, /android:launchMode="singleTask"/, 'android:launchMode="singleTask"\n            android:screenOrientation="portrait"\n            android:windowSoftInputMode="adjustResize"', 'launchMode');
  if (!s.includes('android.permission.VIBRATE')) s = replaceOnce(s, /(<uses-permission android:name="android.permission.INTERNET" \/>)/, '$1\n    <uses-permission android:name="android.permission.VIBRATE" />', 'INTERNET');
  return s;
});

// 5. Android 8+ (API 26).
patch('variables.gradle', (s) => replaceOnce(s, /minSdkVersion = \d+/, 'minSdkVersion = 26', 'minSdkVersion'));

// 6. Version (numéro de build GitHub) et signature.
patch('app/build.gradle', (s) => {
  if (s.includes('signingConfigs')) return s;
  s = replaceOnce(s, /versionCode \d+/, 'versionCode((System.getenv("VERSION_CODE") ?: "1").toInteger())', 'versionCode');
  s = replaceOnce(s, /versionName "[^"]*"/, 'versionName(System.getenv("VERSION_NAME") ?: "1.0.0")', 'versionName');
  s = replaceOnce(
    s,
    /buildTypes \{\s*release \{/,
    `signingConfigs {
        release {
            // Secrets GitHub (ANDROID_KEYSTORE_*) si définis, sinon la clé « sideload » du dépôt,
            // pour que chaque nouvelle APK s'installe par-dessus la précédente.
            def ksFile = System.getenv("ANDROID_KEYSTORE_FILE")
            storeFile(ksFile ? file(ksFile) : file("over15-sideload.jks"))
            storePassword(System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: "over15-sideload")
            keyAlias(System.getenv("ANDROID_KEY_ALIAS") ?: "over15")
            keyPassword(System.getenv("ANDROID_KEY_PASSWORD") ?: "over15-sideload")
            enableV1Signing true
            enableV2Signing true
            enableV3Signing true
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release`,
    'buildTypes',
  );
  return s;
});
const b64 = readFileSync(join(root, 'signature/over15-sideload.jks.b64'), 'utf8').replace(/\s+/g, '');
writeFileSync(join(android, 'app/over15-sideload.jks'), Buffer.from(b64, 'base64'));

console.log('Projet Android prêt : icônes, splash, portrait, Android 8+, signature.');
