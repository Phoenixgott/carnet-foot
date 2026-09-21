/**
 * Réglages de l'analyse (phase 3) : poids des absents et seuils des critères.
 * Enregistrés dans les réglages de l'utilisateur (clé « analyse »), donc sauvegardés avec lui.
 */
import { SEUILS_CARNET, type SeuilsCriteres } from "../carnet-v1/criteres";

export interface ReglagesAnalyse {
  /** 0 = absents ignorés, 1 = effet normal, 2 = effet doublé. */
  poidsAbsents: number;
  seuils: SeuilsCriteres;
}

export const REGLAGES_ANALYSE_DEFAUT: ReglagesAnalyse = { poidsAbsents: 1, seuils: SEUILS_CARNET };

/** Réglages complets : ce qui manque (ancienne sauvegarde, nouveau seuil) prend la valeur par défaut. */
export function completerReglages(r: unknown): ReglagesAnalyse {
  const x = (r && typeof r === "object" ? r : {}) as Partial<ReglagesAnalyse> & { seuils?: Partial<SeuilsCriteres> };
  const nombre = (v: unknown, defaut: number) => (typeof v === "number" && Number.isFinite(v) ? v : defaut);
  const p15 = (x.seuils?.plus15 ?? {}) as Partial<SeuilsCriteres["plus15"]>;
  const p25 = (x.seuils?.plus25 ?? {}) as Partial<SeuilsCriteres["plus25"]>;
  const d15 = SEUILS_CARNET.plus15;
  const d25 = SEUILS_CARNET.plus25;
  return {
    poidsAbsents: Math.min(2, Math.max(0, nombre(x.poidsAbsents, 1))),
    seuils: {
      plus15: {
        butsParMatch: nombre(p15.butsParMatch, d15.butsParMatch),
        pctPlus15: nombre(p15.pctPlus15, d15.pctPlus15),
        contextesAcceptes: Array.isArray(p15.contextesAcceptes) ? p15.contextesAcceptes.map(String) : [...d15.contextesAcceptes],
      },
      plus25: {
        moyenneCompetition: nombre(p25.moyenneCompetition, d25.moyenneCompetition),
        formeMin: nombre(p25.formeMin, d25.formeMin),
        h2hMinMatchs: nombre(p25.h2hMinMatchs, d25.h2hMinMatchs),
        h2hBon: nombre(p25.h2hBon, d25.h2hBon),
        h2hMauvais: nombre(p25.h2hMauvais, d25.h2hMauvais),
        scoreOk: nombre(p25.scoreOk, d25.scoreOk),
      },
    },
  };
}
