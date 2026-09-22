/**
 * Simulateur « et si j'avais parié X » (phase 6) : rejoue le journal terminé avec une autre
 * façon de miser, et compare au résultat réel.
 *
 * Limite honnête : un pari « manuel » (Freebet, cash-out…) n'a pas de mise qu'on peut agrandir
 * ou réduire proportionnellement comme un pari classique — son gain garanti est celui obtenu avec
 * le montant réellement disponible (le freebet offert, la mise déjà engagée). Ces paris gardent
 * donc leur gain réel dans la simulation, non recalculé, et c'est écrit clairement au résultat.
 */
import { drawdownMax, type Drawdown } from "./bankroll";
import { gainPari, parisTermines } from "./paris";
import type { Pari } from "./types";

export type StrategieSimulation = { type: "fixe"; montant: number } | { type: "pourcent"; pct: number; bankrollDepart: number };

export interface PointSimule {
  n: number;
  pariId: string;
  date: string;
  miseSimulee: number;
  gainSimule: number;
  bankroll: number;
  /** Vrai pour un pari « manuel » : son gain n'a pas pu être recalculé (voir l'en-tête du fichier). */
  rejoue: boolean;
}

export interface ResultatSimulation {
  strategie: StrategieSimulation;
  nb: number;
  gainsSimules: number;
  miseSimuleeTotale: number;
  roiSimule: number;
  bankrollFinale: number;
  drawdown: Drawdown;
  points: PointSimule[];
  /** Nombre de paris « manuel » dont le gain réel a été gardé tel quel. */
  nbNonRejoues: number;
  /** Pour comparer : les mêmes chiffres avec ce qui s'est vraiment passé. */
  reel: { gains: number; mise: number; roi: number };
}

/** Mise simulée pour ce pari selon la stratégie (avant le pari, donc sans son propre gain). */
function miseSimulee(strategie: StrategieSimulation, bankrollAvant: number): number {
  if (strategie.type === "fixe") return strategie.montant;
  return Math.max(0, (bankrollAvant * strategie.pct) / 100);
}

export function simuler(paris: readonly Pari[], strategie: StrategieSimulation): ResultatSimulation {
  const termines = [...parisTermines(paris)].sort((a, b) => a.ordre - b.ordre);
  const points: PointSimule[] = [];
  let bankroll = strategie.type === "pourcent" ? strategie.bankrollDepart : 0;
  let nbNonRejoues = 0;

  for (const p of termines) {
    const rejoue = p.statut === "gagne" || p.statut === "perdu";
    let mise: number;
    let gain: number;
    if (rejoue) {
      mise = miseSimulee(strategie, bankroll);
      gain = p.statut === "gagne" ? mise * (p.cote - 1) : -mise;
    } else {
      // Pari « manuel » (Freebet, cash-out…) : gain réel gardé, non recalculé.
      mise = 0;
      gain = gainPari(p);
      nbNonRejoues++;
    }
    bankroll += gain;
    points.push({ n: points.length + 1, pariId: p.id, date: p.date, miseSimulee: mise, gainSimule: gain, bankroll, rejoue });
  }

  const gainsSimules = points.reduce((s, pt) => s + pt.gainSimule, 0);
  const miseSimuleeTotale = points.reduce((s, pt) => s + pt.miseSimulee, 0);
  const gainsReels = termines.reduce((s, p) => s + gainPari(p), 0);
  const miseReelle = termines.reduce((s, p) => s + (p.methode === "Freebet" ? 0 : p.mise), 0);
  const courbe = [{ n: 0, pariId: null, date: "", bankroll: strategie.type === "pourcent" ? strategie.bankrollDepart : 0 }, ...points.map((pt) => ({ n: pt.n, pariId: pt.pariId, date: pt.date, bankroll: pt.bankroll }))];

  return {
    strategie,
    nb: termines.length,
    gainsSimules,
    miseSimuleeTotale,
    roiSimule: miseSimuleeTotale ? gainsSimules / miseSimuleeTotale : NaN,
    bankrollFinale: bankroll,
    drawdown: drawdownMax(courbe),
    points,
    nbNonRejoues,
    reel: { gains: gainsReels, mise: miseReelle, roi: miseReelle ? gainsReels / miseReelle : NaN },
  };
}
