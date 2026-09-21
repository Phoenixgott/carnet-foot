/**
 * Petit serveur statique local (sans dépendance), pour essayer l'app et pour les tests.
 *   node scripts/serve.mjs dist 4173
 * Toute adresse inconnue renvoie index.html (navigation dans l'app).
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const dossier = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      let fichier = path.join(dossier, decodeURIComponent(url.pathname));
      if (!fichier.startsWith(dossier)) throw new Error("hors du dossier");
      let stat = await fs.stat(fichier).catch(() => null);
      if (stat?.isDirectory()) {
        fichier = path.join(fichier, "index.html");
        stat = await fs.stat(fichier).catch(() => null);
      }
      if (!stat) fichier = path.join(dossier, "index.html");
      const corps = await fs.readFile(fichier);
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(fichier)] ?? "application/octet-stream",
        "Cache-Control": fichier.endsWith("sw.js") || fichier.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable",
      });
      res.end(corps);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Introuvable");
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`Carnet de Paris Foot : http://localhost:${port}/`));
