/**
 * Contrastes des couleurs (norme WCAG AA : 4,5 pour le texte courant),
 * calculés à partir des jetons de styles.css, en clair et en sombre.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../../src/ui/styles.css", import.meta.url)), "utf8");

function jetons(bloc: string): Record<string, string> {
  const r: Record<string, string> = {};
  for (const m of bloc.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) r[m[1]] = m[2];
  return r;
}
const clair = jetons(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const sombre = jetons(css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("*, *::before")));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Paires texte / fond réellement utilisées dans l'interface. */
const PAIRES: Array<[string, string]> = [
  ["ink", "bg"], ["ink", "surface"], ["ink", "surface2"], ["muted", "bg"], ["muted", "surface"], ["muted", "surface2"],
  ["accent", "surface"], ["accent", "bg"], ["accent-ink", "accent"], ["good", "good-soft"], ["warn", "warn-soft"],
  ["bad", "bad-soft"], ["surface", "good"], ["onturf", "turf1"], ["onturf", "turf2"], ["accent", "accent-soft"],
];

for (const [nom, t] of [["clair", clair], ["sombre", sombre]] as const) {
  test(`Contrastes AA en thème ${nom}`, () => {
    // Depuis la carte bankroll « tableau de bord » (toujours sombre, jetons turf* non réécrits par thème),
    // le bloc sombre a moins de jetons propres que le bloc clair : seuil bas commun aux deux.
    assert.ok(Object.keys(t).length >= 15, "jetons introuvables");
    const faibles = PAIRES.map(([a, b]) => ({ a, b, c: contraste(t[a], t[b]) })).filter((x) => !(x.c >= 4.5));
    assert.deepEqual(faibles.map((x) => `${x.a} sur ${x.b} : ${x.c.toFixed(2)}`), []);
  });
}
