/** Constantes injectées au moment de la construction (scripts/build.mjs). */
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
/** Vrai pour la variante « aperçu » publiée comme artefact Claude (sans service worker ni téléchargement). */
declare const __APERCU__: boolean;

/** Feuilles de style importées pour leur effet (regroupées par esbuild). */
declare module "*.css";
