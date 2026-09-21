/**
 * Classement des matchs par intérêt : quel match regarder en premier ?
 *
 * Pour chaque méthode : le verdict compte le plus (On joue > À revoir > On passe), puis la value
 * quand la cote est connue, puis la probabilité basse (le cas prudent) et la fiabilité des données.
 * Le match prend la note de sa meilleure méthode.
 */
import { LIBELLE_VERDICT } from "../carnet-v1/analyse";
import type { AnalyseV2 } from "./analyse";

const RANG = { ok: 2, mid: 1, ko: 0 } as const;

export function noteMethode(a: AnalyseV2): number {
  const value = Number.isFinite(a.value) ? Math.max(-0.3, Math.min(0.3, a.value)) : 0;
  const pBas = Number.isFinite(a.pBas) ? a.pBas : 0;
  return RANG[a.v] * 100 + value * 60 + pBas * 20 + a.rel.f * 10;
}

export interface Interet {
  note: number;
  meilleure: AnalyseV2;
  /** Pourquoi ce rang, en quelques mots. */
  raison: string;
}

export function interet(analyses: readonly AnalyseV2[]): Interet {
  const meilleure = [...analyses].sort((x, y) => noteMethode(y) - noteMethode(x))[0];
  const morceaux = [`${meilleure.methode} : ${LIBELLE_VERDICT[meilleure.v]}`];
  if (Number.isFinite(meilleure.value)) morceaux.push(`value ${meilleure.value >= 0 ? "+" : "−"}${Math.abs(Math.round(meilleure.value * 100))} %`);
  if (Number.isFinite(meilleure.p)) morceaux.push(`${Math.round(meilleure.p * 100)} % de chances`);
  return { note: noteMethode(meilleure), meilleure, raison: morceaux.join(", ") };
}
