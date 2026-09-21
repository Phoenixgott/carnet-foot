/**
 * Suivi des offres de freebet : bonus, date limite, conditions, statut, et rappel avant expiration.
 * Fonctions pures. Les offres sont enregistrées avec les réglages de l'utilisateur (donc dans ses
 * sauvegardes), sous la clé « offres ».
 */
import { estNombre } from "./format";

export type StatutOffre = "a-faire" | "qualif-placee" | "freebet-recu" | "terminee";

export const STATUTS_OFFRE: ReadonlyArray<{ statut: StatutOffre; libelle: string }> = [
  { statut: "a-faire", libelle: "À faire" },
  { statut: "qualif-placee", libelle: "Pari qui débloque placé" },
  { statut: "freebet-recu", libelle: "Freebet reçu" },
  { statut: "terminee", libelle: "Terminée" },
];

export const LIBELLE_STATUT_OFFRE: Readonly<Record<StatutOffre, string>> = {
  "a-faire": "À faire",
  "qualif-placee": "Pari qui débloque placé",
  "freebet-recu": "Freebet reçu",
  terminee: "Terminée",
};

export interface OffreFreebet {
  id: string;
  bookmaker: string;
  /** Intitulé libre : « Freebet 10 € pour 10 € misés ». */
  titre: string;
  /** Montant du freebet en euros (null : pas encore connu). */
  montant: number | null;
  /** Mise du pari qui débloque, en euros. */
  qualifMise: number | null;
  /** Cote minimale exigée par l'offre. */
  coteMin: number | null;
  /** Date limite AAAA-MM-JJ (dernier jour pour utiliser le freebet). */
  dateLimite: string | null;
  conditions: string;
  /** Le freebet rend la mise en cas de gain (rare). */
  rembourse: boolean;
  statut: StatutOffre;
  /** Bénéfice réellement obtenu, à la fin (peut être négatif). */
  beneficeReel: number | null;
  creeLe: string;
  modifieLe: string;
}

const MS_JOUR = 864e5;

/** Nombre de jours entiers de `aujourdhui` à `date` (AAAA-MM-JJ) : 0 le jour même, négatif si passé. */
export function joursRestants(date: string, aujourdhui: string): number {
  const a = Date.parse(date + "T12:00:00Z");
  const b = Date.parse(aujourdhui + "T12:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((a - b) / MS_JOUR);
}

export type EtatOffre = "terminee" | "expiree" | "urgente" | "bientot" | "en-cours";

/** Urgente : 2 jours ou moins. Bientôt : 7 jours ou moins. */
export const JOURS_URGENT = 2;
export const JOURS_BIENTOT = 7;

export function etatOffre(o: Pick<OffreFreebet, "statut" | "dateLimite">, aujourdhui: string): EtatOffre {
  if (o.statut === "terminee") return "terminee";
  if (!o.dateLimite) return "en-cours";
  const j = joursRestants(o.dateLimite, aujourdhui);
  if (!Number.isFinite(j)) return "en-cours";
  if (j < 0) return "expiree";
  if (j <= JOURS_URGENT) return "urgente";
  if (j <= JOURS_BIENTOT) return "bientot";
  return "en-cours";
}

/** « aujourd'hui », « demain », « dans 5 jours », « expirée depuis 3 jours »… */
export function texteDelai(dateLimite: string, aujourdhui: string): string {
  const j = joursRestants(dateLimite, aujourdhui);
  if (!Number.isFinite(j)) return "date illisible";
  if (j === 0) return "dernier jour : aujourd'hui";
  if (j === 1) return "expire demain";
  if (j > 1) return `expire dans ${j} jours`;
  if (j === -1) return "expirée depuis hier";
  return `expirée depuis ${-j} jours`;
}

/** Jours avant l'expiration à partir desquels on rappelle. */
export const RAPPEL_OFFRES_JOURS = 3;

/** Offres à rappeler : pas terminées, dont la date limite tombe dans les `jours` jours (aujourd'hui compris). */
export function offresARappeler(offres: readonly OffreFreebet[], aujourdhui: string, jours = RAPPEL_OFFRES_JOURS): OffreFreebet[] {
  return trierOffres(
    offres.filter((o) => {
      if (o.statut === "terminee" || !o.dateLimite) return false;
      const j = joursRestants(o.dateLimite, aujourdhui);
      return Number.isFinite(j) && j >= 0 && j <= jours;
    }),
    aujourdhui,
  );
}

/** En cours d'abord (date limite la plus proche en premier, sans date à la fin), puis les terminées (récentes d'abord). */
export function trierOffres(offres: readonly OffreFreebet[], aujourdhui: string): OffreFreebet[] {
  const rang = (o: OffreFreebet) => (o.statut === "terminee" ? 2 : etatOffre(o, aujourdhui) === "expiree" ? 1 : 0);
  return [...offres].sort((a, b) => {
    if (rang(a) !== rang(b)) return rang(a) - rang(b);
    if (rang(a) === 2) return b.modifieLe.localeCompare(a.modifieLe);
    return (a.dateLimite ?? "9999-99-99").localeCompare(b.dateLimite ?? "9999-99-99") || a.creeLe.localeCompare(b.creeLe);
  });
}

export interface BilanOffres {
  enCours: number;
  /** Total des freebets encore à utiliser (offres en cours, non expirées, avec montant). */
  aUtiliser: number;
  expirees: number;
  terminees: number;
  /** Somme des bénéfices réels saisis. */
  benefice: number;
  /** Bénéfice ÷ montants des freebets, sur les offres terminées avec un bénéfice saisi (NaN si aucune). */
  conversionMoyenne: number;
}

export function bilanOffres(offres: readonly OffreFreebet[], aujourdhui: string): BilanOffres {
  const etat = (o: OffreFreebet) => etatOffre(o, aujourdhui);
  const actives = offres.filter((o) => etat(o) !== "terminee" && etat(o) !== "expiree");
  const faites = offres.filter((o) => o.statut === "terminee" && estNombre(o.beneficeReel));
  const montant = faites.reduce((s, o) => s + (o.montant ?? 0), 0);
  const benefice = faites.reduce((s, o) => s + (o.beneficeReel ?? 0), 0);
  return {
    enCours: actives.length,
    aUtiliser: actives.reduce((s, o) => s + (o.montant ?? 0), 0),
    expirees: offres.filter((o) => etat(o) === "expiree").length,
    terminees: offres.filter((o) => o.statut === "terminee").length,
    benefice,
    conversionMoyenne: montant > 0 ? benefice / montant : NaN,
  };
}

/* ------------------------------------------------------------------ */
/* Saisie et lecture                                                   */

export interface SaisieOffre {
  bookmaker: string;
  titre: string;
  montant: string;
  qualifMise: string;
  coteMin: string;
  dateLimite: string;
  conditions: string;
  rembourse: boolean;
  statut: StatutOffre;
  beneficeReel: string;
}

export const SAISIE_OFFRE_VIDE: SaisieOffre = {
  bookmaker: "",
  titre: "",
  montant: "",
  qualifMise: "",
  coteMin: "",
  dateLimite: "",
  conditions: "",
  rembourse: false,
  statut: "a-faire",
  beneficeReel: "",
};

/** Nombre tapé (« 12,5 ») : null si vide, undefined si illisible. Le signe − est accepté (bénéfice négatif). */
function lireNombreSaisi(s: string, signe = false): number | null | undefined {
  const t = s.trim().replace(/−/g, "-");
  if (!t) return null;
  if (!(signe ? /^-?\d+([.,]\d+)?$/ : /^\d+([.,]\d+)?$/).test(t)) return undefined;
  return Number(t.replace(",", "."));
}

export function saisieDepuisOffre(o: OffreFreebet): SaisieOffre {
  const t = (x: number | null) => (x === null ? "" : String(x).replace(".", ","));
  return {
    bookmaker: o.bookmaker,
    titre: o.titre,
    montant: t(o.montant),
    qualifMise: t(o.qualifMise),
    coteMin: t(o.coteMin),
    dateLimite: o.dateLimite ?? "",
    conditions: o.conditions,
    rembourse: o.rembourse,
    statut: o.statut,
    beneficeReel: t(o.beneficeReel),
  };
}

const dateValide = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const x = new Date(d + "T12:00:00Z");
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d;
};

/** Vérifie la saisie ; renvoie l'offre prête à enregistrer, ou un message clair. */
export function validerOffre(
  s: SaisieOffre,
  existante: OffreFreebet | null,
  id: string,
  maintenant: string,
): { offre: OffreFreebet } | { erreur: string } {
  const bookmaker = s.bookmaker.trim();
  if (!bookmaker) return { erreur: "Indique le bookmaker." };
  const montant = lireNombreSaisi(s.montant);
  if (montant === undefined || (montant !== null && montant <= 0)) return { erreur: "Montant du freebet : tape un nombre positif, par exemple 10 ou 12,5." };
  const qualifMise = lireNombreSaisi(s.qualifMise);
  if (qualifMise === undefined || (qualifMise !== null && qualifMise <= 0)) return { erreur: "Mise du pari qui débloque : tape un nombre positif, ou laisse vide." };
  const coteMin = lireNombreSaisi(s.coteMin);
  if (coteMin === undefined || (coteMin !== null && coteMin <= 1)) return { erreur: "Cote minimale : tape une cote supérieure à 1, ou laisse vide." };
  const dateLimite = s.dateLimite.trim() || null;
  if (dateLimite !== null && !dateValide(dateLimite)) return { erreur: "Date limite : choisis une date valide." };
  const beneficeReel = lireNombreSaisi(s.beneficeReel, true);
  if (beneficeReel === undefined) return { erreur: "Bénéfice réel : tape un nombre, par exemple 6,5 ou −1,2." };
  // Une offre peut être terminée sans bénéfice saisi : le bilan ne la compte alors pas dans le taux de conversion.
  return {
    offre: {
      id,
      bookmaker,
      titre: s.titre.trim(),
      montant,
      qualifMise,
      coteMin,
      dateLimite,
      conditions: s.conditions.trim(),
      rembourse: s.rembourse,
      statut: s.statut,
      beneficeReel: s.statut === "terminee" ? beneficeReel : null,
      creeLe: existante?.creeLe ?? maintenant,
      modifieLe: maintenant,
    },
  };
}

/** Offres lues depuis les réglages : tout ce qui est illisible est écarté, le reste est complété. */
export function completerOffres(x: unknown): OffreFreebet[] {
  if (!Array.isArray(x)) return [];
  const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const statuts = STATUTS_OFFRE.map((s) => s.statut);
  const offres: OffreFreebet[] = [];
  for (const b of x as Array<Record<string, unknown>>) {
    if (!b || typeof b !== "object" || typeof b.id !== "string" || typeof b.bookmaker !== "string") continue;
    const statut = statuts.includes(b.statut as StatutOffre) ? (b.statut as StatutOffre) : "a-faire";
    offres.push({
      id: b.id,
      bookmaker: b.bookmaker,
      titre: typeof b.titre === "string" ? b.titre : "",
      montant: nombre(b.montant),
      qualifMise: nombre(b.qualifMise),
      coteMin: nombre(b.coteMin),
      dateLimite: typeof b.dateLimite === "string" && dateValide(b.dateLimite) ? b.dateLimite : null,
      conditions: typeof b.conditions === "string" ? b.conditions : "",
      rembourse: b.rembourse === true,
      statut,
      beneficeReel: statut === "terminee" ? nombre(b.beneficeReel) : null,
      creeLe: typeof b.creeLe === "string" ? b.creeLe : "",
      modifieLe: typeof b.modifieLe === "string" ? b.modifieLe : "",
    });
  }
  return offres;
}
