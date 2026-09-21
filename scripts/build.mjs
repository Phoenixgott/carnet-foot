/**
 * Construction de l'application (remplace `vite build`, voir README).
 *
 *   node scripts/build.mjs            → dist/ prêt à héberger
 *   node scripts/build.mjs --watch    → reconstruit à chaque modification et sert dist/ sur http://localhost:5173
 *
 * Étapes : bundle JS/CSS avec esbuild (noms hachés), index.html, fichiers de public/,
 * puis service worker avec la liste des fichiers à mettre en cache pour le hors ligne.
 */
import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(RACINE, "dist");
const pkg = JSON.parse(await fs.readFile(path.join(RACINE, "package.json"), "utf8"));

async function listerFichiers(dossier, base = dossier) {
  const sortie = [];
  for (const e of await fs.readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...(await listerFichiers(p, base)));
    else sortie.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return sortie;
}

export async function construire({ dev = false } = {}) {
  const debut = Date.now();
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, "assets"), { recursive: true });
  const defines = {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
  };

  const resultat = await esbuild.build({
    absWorkingDir: RACINE,
    entryPoints: { app: "src/main.tsx" },
    bundle: true,
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    format: "esm",
    target: ["chrome109", "safari16", "firefox115"],
    outdir: path.join(DIST, "assets"),
    entryNames: "[name]-[hash]",
    assetNames: "[name]-[hash]",
    jsx: "automatic",
    charset: "utf8",
    legalComments: "none",
    metafile: true,
    logLevel: "warning",
    define: { ...defines, __APERCU__: "false" },
  });
  const sorties = Object.keys(resultat.metafile.outputs).map((f) => path.relative(DIST, path.resolve(RACINE, f)).split(path.sep).join("/"));
  const js = sorties.find((f) => f.endsWith(".js"));
  const css = sorties.find((f) => f.endsWith(".css"));

  let html = await fs.readFile(path.join(RACINE, "index.html"), "utf8");
  html = html
    .replace("<!--CSS-->", css ? `<link rel="stylesheet" href="./${css}">` : "")
    .replace("<!--JS-->", `<script type="module" src="./${js}"></script>`);
  await fs.writeFile(path.join(DIST, "index.html"), html);
  await fs.cp(path.join(RACINE, "public"), DIST, { recursive: true });

  // Service worker : met en cache tous les fichiers de l'app pour le hors ligne.
  const fichiers = (await listerFichiers(DIST)).filter((f) => f !== "sw.js").sort();
  const h = createHash("sha256");
  for (const f of fichiers) h.update(f).update(await fs.readFile(path.join(DIST, f)));
  const versionCache = h.digest("hex").slice(0, 12);
  await esbuild.build({
    absWorkingDir: RACINE,
    entryPoints: ["src/pwa/sw.ts"],
    bundle: true,
    minify: !dev,
    format: "iife",
    target: ["chrome109", "safari16"],
    outfile: path.join(DIST, "sw.js"),
    logLevel: "warning",
    define: {
      __PRECACHE__: JSON.stringify(["./", ...fichiers.map((f) => "./" + f)]),
      __CACHE_VERSION__: JSON.stringify(versionCache),
    },
  });

  let total = 0;
  for (const f of [...fichiers, "sw.js"]) total += (await fs.stat(path.join(DIST, f))).size;
  console.log(
    `Construit en ${Date.now() - debut} ms : ${fichiers.length + 1} fichiers, ${(total / 1024).toFixed(0)} Ko, cache ${versionCache}`,
  );
  return { versionCache, fichiers };
}

/**
 * Variante « aperçu » pour un artefact Claude : page sans <html>/<head> (la publication
 * ajoute son propre squelette), sans service worker ni manifeste, fichiers aux noms fixes.
 */
export async function construireApercu() {
  const SORTIE = path.join(RACINE, "dist-apercu");
  await fs.rm(SORTIE, { recursive: true, force: true });
  await fs.mkdir(path.join(SORTIE, "assets"), { recursive: true });
  await esbuild.build({
    absWorkingDir: RACINE,
    entryPoints: { app: "src/main.tsx" },
    bundle: true,
    minify: true,
    format: "esm",
    target: ["chrome109", "safari16", "firefox115"],
    outdir: path.join(SORTIE, "assets"),
    jsx: "automatic",
    charset: "utf8",
    legalComments: "none",
    logLevel: "warning",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __APERCU__: "true",
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });
  await fs.mkdir(path.join(SORTIE, "icons"), { recursive: true });
  await fs.copyFile(path.join(RACINE, "public/icons/icon-192.png"), path.join(SORTIE, "icons/icon-192.png"));
  const page = `<title>Nouveau Carnet Foot</title>
<link rel="stylesheet" href="assets/app.css">
<div id="app"><p style="padding:16px">Chargement…</p></div>
<script type="module" src="assets/app.js"></script>
`;
  await fs.writeFile(path.join(SORTIE, "index.html"), page);
  console.log("Aperçu construit dans dist-apercu/");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--apercu")) {
    await construireApercu();
    process.exit(0);
  }
  const surveiller = process.argv.includes("--watch");
  await construire({ dev: surveiller });
  if (surveiller) {
    let minuterie = null;
    const relancer = () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(() => construire({ dev: true }).catch((e) => console.error(e.message)), 120);
    };
    for (const d of ["src", "public", "index.html"]) watch(path.join(RACINE, d), { recursive: true }, relancer);
    spawn(process.execPath, [path.join(RACINE, "scripts/serve.mjs"), "dist", "5173"], { stdio: "inherit" });
  }
}
