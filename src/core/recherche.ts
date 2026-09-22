/**
 * Recherche globale (phase 8) : retrouve un match, un pari ou une offre par un mot. Tout est
 * comparé localement (minuscules, accents ignorés) ; rien n'est envoyé nulle part.
 */
import type { OffreFreebet } from "./offres";
import type { Match, Pari } from "./types";

export function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type TypeResultat = "match" | "pari" | "offre";

export interface ResultatRecherche {
  type: TypeResultat;
  id: string;
  titre: string;
  detail: string;
  lien: string;
}

const nomMatch = (m: Match) => `${m.domicile?.nom ?? "?"} – ${m.exterieur?.nom ?? "?"}`;

/** Recherche sur les 3 sources à la fois ; vide si la requête fait moins de 2 caractères utiles. */
export function rechercher(
  q: string,
  matchs: readonly Match[],
  paris: readonly Pari[],
  offres: readonly OffreFreebet[],
): ResultatRecherche[] {
  const mot = normaliser(q.trim());
  if (mot.length < 2) return [];
  const contient = (s: string | null | undefined) => !!s && normaliser(s).includes(mot);
  const r: ResultatRecherche[] = [];

  for (const m of matchs) {
    const nom = nomMatch(m);
    if (contient(nom) || contient(m.ligue)) {
      r.push({ type: "match", id: m.id, titre: nom, detail: [m.ligue, m.date].filter(Boolean).join(" · "), lien: "#/matchs" });
    }
  }
  for (const p of paris) {
    if (contient(p.match) || contient(p.ligue) || contient(p.notes)) {
      r.push({ type: "pari", id: p.id, titre: p.match, detail: `${p.methode} · ${p.date}`, lien: "#/paris" });
    }
  }
  for (const o of offres) {
    if (contient(o.bookmaker) || contient(o.titre)) {
      r.push({ type: "offre", id: o.id, titre: o.bookmaker, detail: o.titre, lien: "#/freebet?vue=offres" });
    }
  }
  return r;
}
