/**
 * Génère les icônes de l'application (à lancer une fois, résultat versionné dans public/icons).
 *   node scripts/icones.mjs
 * Nécessite le paquet « sharp » (installé globalement ici, non requis pour construire l'app).
 *
 * Motif : un terrain rayé comme le tableau de bord du carnet d'origine,
 * avec la ligne médiane, le rond central et le point d'engagement.
 */
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = require("/home/claude/.npm-global/lib/node_modules/sharp");
}

const DOSSIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");
const VERT = "#17663F";
const VERT2 = "#1C7249";

/** Dessin de l'icône ; `echelle` < 1 resserre le motif (zone sûre des icônes « maskable »). */
function svg({ arrondi, echelle }) {
  const bandes = Array.from({ length: 8 }, (_, i) => (i % 2 ? `<rect x="${i * 64}" y="0" width="64" height="512" fill="${VERT2}"/>` : "")).join("");
  const r = 100 * echelle;
  const trait = 22 * echelle;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><clipPath id="c"><rect width="512" height="512" rx="${arrondi}"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="512" height="512" fill="${VERT}"/>
    ${bandes}
    <line x1="256" y1="0" x2="256" y2="512" stroke="#FFFFFF" stroke-width="${trait}"/>
    <circle cx="256" cy="256" r="${r}" fill="none" stroke="#FFFFFF" stroke-width="${trait}"/>
    <circle cx="256" cy="256" r="${30 * echelle}" fill="#FFFFFF"/>
  </g>
</svg>`;
}

await fs.mkdir(DOSSIER, { recursive: true });
const normal = svg({ arrondi: 112, echelle: 1 });
const masquable = svg({ arrondi: 0, echelle: 0.82 });
await fs.writeFile(path.join(DOSSIER, "icon.svg"), normal);
await sharp(Buffer.from(normal)).resize(192, 192).png().toFile(path.join(DOSSIER, "icon-192.png"));
await sharp(Buffer.from(normal)).resize(512, 512).png().toFile(path.join(DOSSIER, "icon-512.png"));
await sharp(Buffer.from(masquable)).resize(512, 512).png().toFile(path.join(DOSSIER, "icon-maskable-512.png"));
// Badge de notification Android : silhouette blanche sur fond transparent (seule la transparence compte).
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <line x1="48" y1="4" x2="48" y2="92" stroke="#FFFFFF" stroke-width="8"/>
  <circle cx="48" cy="48" r="26" fill="none" stroke="#FFFFFF" stroke-width="8"/>
  <circle cx="48" cy="48" r="8" fill="#FFFFFF"/>
</svg>`;
await sharp(Buffer.from(badge)).resize(96, 96).png().toFile(path.join(DOSSIER, "badge-96.png"));
console.log("Icônes générées dans", DOSSIER);
