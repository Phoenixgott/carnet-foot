/**
 * Méthode Freebet (formules du carnet d'origine, complétées en phase 5).
 *
 * Deux paris :
 *  1. le pari qualificatif, en argent réel, qui débloque le freebet ;
 *  2. le freebet lui-même.
 * Chacun est couvert sur l'issue inverse, chez un autre bookmaker (« book »)
 * ou en lay sur un exchange avec commission (« lay »).
 *
 * Freebet non remboursé (cas courant) : en cas de gain, seul le bénéfice est payé
 * (montant × (cote − 1)). Freebet remboursé : la mise est rendue aussi (montant × cote).
 * Dans les deux cas, un freebet perdant ne coûte rien.
 *
 * Le profit est garanti mathématiquement à une condition : que les deux paris
 * soient acceptés aux cotes saisies (cote qui bouge, pari annulé ou compte
 * limité cassent la garantie).
 */

export type ModeCouverture = "book" | "lay";

export interface ResultatFreebet {
  qualif: { miseCouverture: number; resultat: number };
  freebet: { miseCouverture: number; resultat: number };
  /** Bénéfice garanti total (qualificatif + freebet). */
  total: number;
  /** Part du freebet transformée en argent réel (0-1). */
  conversion: number;
}

export interface EntreeFreebet {
  mode: ModeCouverture;
  /** Pari qualificatif : mise, cote, cote inverse (ou lay), commission (fraction). */
  qMise: number;
  qCote: number;
  qCoteInverse: number;
  qCommission: number;
  /** Freebet : montant, cote, cote inverse (ou lay), commission (fraction). */
  fMontant: number;
  fCote: number;
  fCoteInverse: number;
  fCommission: number;
  /** Freebet remboursé : la mise est rendue en cas de gain (faux : non remboursé, cas courant). */
  fRembourse?: boolean;
}

export interface JambeFreebet {
  /** Mise à placer sur l'issue inverse (« book »), ou mise lay (« lay »). */
  miseCouverture: number;
  /** Gain garanti, quelle que soit l'issue. */
  resultat: number;
}

/** Le freebet seul : sa couverture et le gain garanti. */
export function jambeFreebet(
  montant: number,
  cote: number,
  coteInverse: number,
  mode: ModeCouverture,
  commission: number,
  rembourse = false,
): JambeFreebet {
  // Ce que paie le freebet s'il gagne
  const gain = rembourse ? montant * cote : montant * (cote - 1);
  if (mode === "book") {
    const H = gain / coteInverse;
    return { miseCouverture: H, resultat: gain - H };
  }
  const H = gain / (coteInverse - commission);
  return { miseCouverture: H, resultat: H * (1 - commission) };
}

/** Le pari qui débloque le freebet seul : sa couverture et son résultat garanti (souvent un petit coût). */
export function jambeQualification(
  mise: number,
  cote: number,
  coteInverse: number,
  mode: ModeCouverture,
  commission: number,
): JambeFreebet {
  if (mode === "book") {
    const H = (mise * cote) / coteInverse;
    return { miseCouverture: H, resultat: mise * cote - mise - H };
  }
  const H = (mise * cote) / (coteInverse - commission);
  return { miseCouverture: H, resultat: H * (1 - commission) - mise };
}

export function calculerFreebet(e: EntreeFreebet): ResultatFreebet {
  const q = jambeQualification(e.qMise, e.qCote, e.qCoteInverse, e.mode, e.qCommission);
  const f = jambeFreebet(e.fMontant, e.fCote, e.fCoteInverse, e.mode, e.fCommission, e.fRembourse);
  return {
    qualif: q,
    freebet: f,
    total: q.resultat + f.resultat,
    conversion: f.resultat / e.fMontant,
  };
}

const fini = (x: number) => Number.isFinite(x);

/** Les cotes d'un pari couvert sont-elles utilisables ? (cote > 1 ; inverse > 1, ou lay > 1 et > commission) */
function couvertureCalculable(mode: ModeCouverture, cote: number, inverse: number, commission: number): boolean {
  if (!fini(cote) || !fini(inverse) || !(cote > 1)) return false;
  if (mode === "book") return inverse > 1;
  return fini(commission) && commission >= 0 && commission < 1 && inverse > 1 && inverse > commission;
}

/** Le pari qui débloque peut être calculé seul (tous ses champs sont saisis et possibles). */
export function qualifCalculable(e: EntreeFreebet): boolean {
  return fini(e.qMise) && e.qMise > 0 && couvertureCalculable(e.mode, e.qCote, e.qCoteInverse, e.qCommission);
}

/** Le freebet peut être calculé seul. */
export function freebetCalculable(e: EntreeFreebet): boolean {
  return fini(e.fMontant) && e.fMontant > 0 && couvertureCalculable(e.mode, e.fCote, e.fCoteInverse, e.fCommission);
}

/** Appréciation du taux de conversion (seuils du carnet : 70 % bon, 60 % correct). */
export function appreciationConversion(conversion: number): "ok" | "mid" | "ko" {
  return conversion >= 0.7 ? "ok" : conversion >= 0.6 ? "mid" : "ko";
}

/** Message d'erreur si une saisie rend le calcul impossible ; null si tout est calculable. */
export function verifierEntreeFreebet(e: EntreeFreebet): string | null {
  const nombre = (x: number) => Number.isFinite(x);
  if (![e.qMise, e.qCote, e.qCoteInverse, e.fMontant, e.fCote, e.fCoteInverse].every(nombre)) return "Saisis toutes les valeurs.";
  if (!(e.qMise > 0)) return "La mise du pari qui débloque doit être positive.";
  if (!(e.fMontant > 0)) return "Le montant du freebet doit être positif.";
  for (const [nom, c] of [["du pari qui débloque", e.qCote], ["du freebet", e.fCote]] as const) {
    if (!(c > 1)) return `La cote ${nom} doit être supérieure à 1.`;
  }
  if (e.mode === "book") {
    if (!(e.qCoteInverse > 1) || !(e.fCoteInverse > 1)) return "Les cotes inverses doivent être supérieures à 1.";
  } else {
    for (const [nom, c, com] of [["du pari qui débloque", e.qCoteInverse, e.qCommission], ["du freebet", e.fCoteInverse, e.fCommission]] as const) {
      if (!(com >= 0 && com < 1)) return "La commission doit être comprise entre 0 et 100 %.";
      if (!(c > 1) || !(c > com)) return `La cote lay ${nom} doit être supérieure à 1 et à la commission.`;
    }
  }
  return null;
}

export interface BilanFreebet extends ResultatFreebet {
  /** Ce que coûte le pari qui débloque (0 s'il rapporte). */
  cout: number;
  /** Bénéfice garanti total ÷ montant du freebet (le coût du pari qui débloque est compté). */
  conversionNette: number;
  appreciation: "ok" | "mid" | "ko";
}

/** Calcul complet avec le coût, la conversion nette et l'appréciation ; null si la saisie est impossible. */
export function analyserFreebet(e: EntreeFreebet): BilanFreebet | null {
  if (verifierEntreeFreebet(e) !== null) return null;
  const r = calculerFreebet(e);
  return {
    ...r,
    cout: Math.max(-r.qualif.resultat, 0),
    conversionNette: r.total / e.fMontant,
    appreciation: appreciationConversion(r.conversion),
  };
}
