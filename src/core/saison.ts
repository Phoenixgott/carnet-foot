/**
 * Saison de football d'après une date (le carnet écrivait « 2026-2027 » en dur).
 * Une saison européenne commence en juillet : du 1er juillet au 30 juin.
 */

/** Saison d'une date AAAA-MM-JJ : « 2026-2027 » pour le 22 septembre 2026, « 2025-2026 » pour le 3 mars 2026. */
export function saisonDe(dateIso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(dateIso);
  if (!m) throw new Error("Date illisible : " + dateIso);
  const annee = Number(m[1]);
  const debut = Number(m[2]) >= 7 ? annee : annee - 1;
  return `${debut}-${debut + 1}`;
}

/** Saison précédente : « 2025-2026 » pour « 2026-2027 ». */
export function saisonPrecedente(saison: string): string {
  const debut = Number(saison.slice(0, 4)) - 1;
  return `${debut}-${debut + 1}`;
}
