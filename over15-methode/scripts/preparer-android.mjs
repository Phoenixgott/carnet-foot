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

// 2. Logo « +EV » (Barlow Condensed ExtraBold vectorisé) dans un carré de 108.
const TEXT = 'M43.88 53.30Q44.05 53.30 44.17 53.42Q44.30 53.55 44.30 53.72L44.30 57.22Q44.30 57.39 44.17 57.52Q44.05 57.64 43.88 57.64L39.75 57.64Q39.57 57.64 39.57 57.81L39.57 61.95Q39.57 62.12 39.45 62.24Q39.33 62.37 39.15 62.37L35.62 62.37Q35.44 62.37 35.32 62.24Q35.20 62.12 35.20 61.95L35.20 57.81Q35.20 57.64 35.02 57.64L30.89 57.64Q30.72 57.64 30.59 57.52Q30.47 57.39 30.47 57.22L30.47 53.72Q30.47 53.55 30.59 53.42Q30.72 53.30 30.89 53.30L35.02 53.30Q35.20 53.30 35.20 53.13L35.20 48.96Q35.20 48.78 35.32 48.66Q35.44 48.54 35.62 48.54L39.15 48.54Q39.33 48.54 39.45 48.66Q39.57 48.78 39.57 48.96L39.57 53.13Q39.57 53.30 39.75 53.30L43.88 53.30ZM59.70 46.30Q59.70 46.47 59.57 46.60Q59.45 46.72 59.28 46.72L52.24 46.72Q52.07 46.72 52.07 46.89L52.07 51.30Q52.07 51.48 52.24 51.48L56.09 51.48Q56.27 51.48 56.39 51.60Q56.51 51.72 56.51 51.90L56.51 56.06Q56.51 56.24 56.39 56.36Q56.27 56.48 56.09 56.48L52.24 56.48Q52.07 56.48 52.07 56.66L52.07 61.10Q52.07 61.28 52.24 61.28L59.28 61.28Q59.45 61.28 59.57 61.40Q59.70 61.52 59.70 61.70L59.70 65.83Q59.70 66.00 59.57 66.13Q59.45 66.25 59.28 66.25L46.68 66.25Q46.50 66.25 46.38 66.13Q46.26 66.00 46.26 65.83L46.26 42.17Q46.26 41.99 46.38 41.87Q46.50 41.75 46.68 41.75L59.28 41.75Q59.45 41.75 59.57 41.87Q59.70 41.99 59.70 42.17L59.70 46.30ZM66.56 66.25Q66.17 66.25 66.10 65.86L61.13 42.20L61.10 42.06Q61.10 41.75 61.48 41.75L66.91 41.75Q67.33 41.75 67.36 42.13L69.36 56.10Q69.39 56.24 69.48 56.22Q69.57 56.20 69.57 56.10L71.42 42.13Q71.46 41.75 71.88 41.75L77.16 41.75Q77.62 41.75 77.51 42.20L72.51 65.86Q72.44 66.25 72.05 66.25L66.56 66.25Z';
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
            <gradient android:type="linear" android:startX="32" android:startY="40" android:endX="76" android:endY="68">
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
