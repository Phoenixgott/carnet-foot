/**
 * Mise en forme des nombres, à la française.
 * Reprend exactement les fonctions `fr`, `eur` et `pc` du carnet d'origine,
 * pour que les textes affichés restent identiques.
 */

/** Nombre avec `d` décimales et une virgule ; « ? » si le nombre est inconnu. */
export function fr(v: number, d = 2): string {
  return Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "?";
}

/** Montant en euros, avec le vrai signe moins (−) ; « — » si inconnu. */
export function eur(v: number): string {
  return Number.isFinite(v)
    ? (v < 0 ? "−" : "") + Math.abs(v).toFixed(2).replace(".", ",") + " €"
    : "—";
}

/** Proportion (0-1) affichée en pourcentage entier ; « ? » si inconnue. */
export function pc(v: number): string {
  return Number.isFinite(v) ? Math.round(v * 100) + " %" : "?";
}

/** Vrai si la valeur est un nombre fini (le `isN` du carnet d'origine). */
export function estNombre(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Nombre tapé par l'utilisateur (« 1,85 » ou « 1.85 »).
 * null si la case est vide ; undefined si ce n'est pas un nombre.
 */
export function lireSaisie(s: string): number | null | undefined {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d+([.,]\d+)?$/.test(t)) return undefined;
  return Number(t.replace(",", "."));
}

/** Date courte en français (« mar. 22 sept. ») ; la valeur brute si elle est illisible. */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
