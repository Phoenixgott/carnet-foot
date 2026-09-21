#!/usr/bin/env bash
# Met l'application en ligne sur GitHub Pages.
#   bash scripts/publier-pages.sh
# Construit dist/ puis le pousse (seul, sans historique) sur la branche gh-pages du dépôt « origin ».
# GitHub Pages doit être réglé sur : branche gh-pages, dossier / (racine).
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RACINE"
DEPOT="$(git remote get-url origin)"

node scripts/build.mjs

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -r dist/. "$TMP"/
touch "$TMP/.nojekyll"   # sert les fichiers tels quels, sans traitement Jekyll

cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$RACINE" config user.name)" -c user.email="$(git -C "$RACINE" config user.email)" \
  commit -q -m "Publication de la version $(node -p "require('$RACINE/package.json').version") ($(date -u +%Y-%m-%dT%H:%MZ))"
git push -f "$DEPOT" gh-pages

echo "Publié sur la branche gh-pages de $DEPOT"
