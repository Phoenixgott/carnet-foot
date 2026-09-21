/**
 * Générateurs de données de test reproductibles (graine fixe) :
 * des matchs et des paris variés, avec des champs manquants, nuls ou inattendus,
 * pour comparer l'ancien et le nouveau code sur des centaines de cas.
 */
import type { Match, Pari } from "../../src/core/types";
import { CODE_CARNET_VERS_METHODE } from "../../src/core/methodes";

/** Générateur pseudo-aléatoire mulberry32 (reproductible). */
export function aleatoire(graine: number) {
  let a = graine >>> 0;
  const suivant = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    suivant,
    entier: (min: number, max: number) => min + Math.floor(suivant() * (max - min + 1)),
    reel: (min: number, max: number, dec = 2) => +(min + suivant() * (max - min)).toFixed(dec),
    chance: (p: number) => suivant() < p,
    choix: <T>(l: readonly T[]) => l[Math.floor(suivant() * l.length)],
  };
}

type Alea = ReturnType<typeof aleatoire>;

const NOMS = ["Lens", "Brest", "Augsbourg", "Francfort", "Inter", "Sassuolo", "Metz", "Lille", "Brighton", "Fulham", "PSG", "OM"];
const CONTEXTES = ["normal", "finale", "derby", "maintien", "montee", "sans_enjeu", "retour_coupe_retard"];

function peutEtre<T>(r: Alea, v: () => T, pNull = 0.12): T | null | undefined {
  const x = r.suivant();
  if (x < pNull / 2) return null;
  if (x < pNull) return undefined;
  return v();
}

function equipe(r: Alea): Match["domicile"] {
  if (r.chance(0.03)) return null;
  const joues = peutEtre(r, () => r.entier(0, 12));
  return {
    nom: peutEtre(r, () => r.choix(NOMS), 0.05) as string | undefined,
    joues,
    marques: peutEtre(r, () => r.entier(0, 30)),
    encaisses: peutEtre(r, () => r.entier(0, 30)),
    pctOver15: peutEtre(r, () => r.entier(0, 100)),
    pctOver25: peutEtre(r, () => r.entier(0, 100)),
    derniersButsMarques: peutEtre(r, () =>
      Array.from({ length: r.entier(0, 5) }, () => (r.chance(0.08) ? null : r.entier(0, 5))),
    ),
  };
}

/**
 * Équipe complète dont les chiffres tombent près des seuils des méthodes
 * (1 but par match, 70 % de matchs à 2+ buts, forme à 70 % de la moyenne).
 */
function equipeLimite(r: Alea): NonNullable<Match["domicile"]> {
  const joues = r.choix([5, 6, 10]);
  return {
    nom: r.choix(NOMS),
    joues,
    marques: r.entier(Math.max(0, joues - 2), joues * 2 + 2),
    encaisses: r.entier(Math.max(0, joues - 2), joues * 2 + 2),
    pctOver15: r.choix([50, 60, 69, 70, 71, 80, 90, 100]),
    pctOver25: r.choix([30, 50, 60, 67, 80]),
    derniersButsMarques: Array.from({ length: 4 }, () => r.entier(0, 3)),
  };
}

/** Match complet, sans donnée manquante, construit autour des seuils. */
function matchLimite(r: Alea, i: number): Match {
  const h2hJoues = r.choix([3, 5, 6]);
  return {
    id: "m" + i,
    date: "2026-09-" + String(r.entier(1, 28)).padStart(2, "0"),
    heure: "21:00",
    ligue: r.choix(["Ligue 1", "Serie A", "Bundesliga"]),
    selection: r.chance(0.2),
    feminin: false,
    moyenneButsLigue: r.choix([2.5, 2.69, 2.7, 2.71, 2.85, 3.1]),
    domicile: equipeLimite(r),
    exterieur: equipeLimite(r),
    h2h: { joues: h2hJoues, over25: r.entier(0, h2hJoues) },
    contexte: r.chance(0.8) ? "normal" : r.choix(CONTEXTES),
    absents: [],
    absenceOffensive: r.chance(0.15),
    meilleurButeurAbsent: r.chance(0.1),
    defenseAffaiblie: r.chance(0.3),
    cotes: { over15: r.reel(1.1, 1.5), over25: r.reel(1.5, 2.4) },
  };
}

export function matchAleatoire(r: Alea, i: number): Match {
  if (r.chance(0.5)) return matchLimite(r, i);
  const h2hJoues = r.entier(0, 8);
  return {
    id: "m" + i,
    date: "2026-09-" + String(r.entier(1, 28)).padStart(2, "0"),
    heure: r.choix(["18:30", "20:45", "21:00"]),
    ligue: peutEtre(r, () => r.choix(["Ligue 1", "Serie A", "Bundesliga"]), 0.1) as string | undefined,
    selection: r.chance(0.2),
    feminin: r.chance(0.1),
    moyenneButsLigue: peutEtre(r, () => r.reel(1.8, 3.6)),
    domicile: equipe(r),
    exterieur: equipe(r),
    h2h: r.chance(0.2) ? null : { joues: peutEtre(r, () => h2hJoues), over25: peutEtre(r, () => r.entier(0, h2hJoues)) },
    contexte: r.chance(0.05) ? (r.chance(0.5) ? undefined : "inconnu") : r.choix(CONTEXTES),
    absents: r.chance(0.3) ? null : r.chance(0.2) ? undefined : [],
    absenceOffensive: r.chance(0.25),
    meilleurButeurAbsent: r.chance(0.15),
    defenseAffaiblie: r.chance(0.2),
    cotes: r.chance(0.25) ? null : { over15: peutEtre(r, () => r.reel(1.05, 1.6)), over25: peutEtre(r, () => r.reel(1.4, 2.6)) },
  } as Match;
}

/** Pari au format du carnet d'origine (code de méthode m1/m2/m3/autre). */
export function pariCarnetAleatoire(r: Alea) {
  const statut = r.choix(["attente", "gagne", "perdu", "manuel", "rembourse"] as const);
  const p: Record<string, unknown> = {
    date: "2026-09-" + String(r.entier(1, 28)).padStart(2, "0"),
    match: r.choix(NOMS) + " – " + r.choix(NOMS),
    methode: r.choix(["m1", "m2", "m3", "autre"]),
    cote: r.reel(1.1, 6),
    mise: r.reel(0, 120, 1),
    statut,
  };
  if (statut === "manuel" || r.chance(0.1)) p.pnl = r.reel(-50, 80);
  return p;
}

/** Conversion d'un pari du carnet vers le modèle de l'app (pour les tests de calcul). */
export function versPari(p: Record<string, unknown>, i: number): Pari {
  return {
    id: "p" + i,
    ordre: i,
    date: String(p.date),
    match: String(p.match),
    methode: CODE_CARNET_VERS_METHODE[String(p.methode)] ?? "Autre",
    cote: p.cote as number,
    mise: p.mise as number,
    statut: p.statut as Pari["statut"],
    ...(p.pnl !== undefined ? { pnl: p.pnl as number } : {}),
    creeLe: "",
    modifieLe: "",
  };
}
