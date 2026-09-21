/**
 * Contexte d'analyse de l'utilisateur : ses réglages (poids des absents, seuils des critères)
 * et, pour chaque match, les chiffres de son championnat tirés des historiques CSV.
 */
import type { ContexteDe } from "../core/cotes";
import { statsChampionnat, type StatsChampionnat } from "../core/modele-v2/championnat";
import { completerReglages, type ReglagesAnalyse } from "../core/modele-v2/reglages";
import type { Resultat } from "../core/types";
import { reglage, type Contenu } from "./contenu";
import { lireContenu, lireResultats } from "./depot";

export function reglagesAnalyseDe(c: Contenu): ReglagesAnalyse {
  return completerReglages(reglage(c, "analyse"));
}

export function contexteAnalyse(c: Contenu, resultats: readonly Resultat[]): ContexteDe {
  const reglages = reglagesAnalyseDe(c);
  const parChampionnat = new Map<string, StatsChampionnat | null>();
  return (m) => {
    const cle = m.ligue ?? "";
    if (!parChampionnat.has(cle)) parChampionnat.set(cle, statsChampionnat(resultats, m.ligue));
    return { stats: parChampionnat.get(cle) ?? null, reglages };
  };
}

/** Contexte lu dans la base (pour les services, hors écran). */
export async function contexteDepuisBase(): Promise<ContexteDe> {
  const [c, rs] = await Promise.all([lireContenu(), lireResultats()]);
  return contexteAnalyse(c, rs);
}
