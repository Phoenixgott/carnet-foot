/**
 * Méthode Freebet (formules du carnet d'origine) : freebet non remboursé
 * (la mise du freebet n'est pas rendue en cas de gain).
 *
 * Deux paris :
 *  1. le pari qualificatif, en argent réel, qui débloque le freebet ;
 *  2. le freebet lui-même.
 * Chacun est couvert sur l'issue inverse, chez un autre bookmaker (« book »)
 * ou en lay sur un exchange avec commission (« lay »).
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
}

export function calculerFreebet(e: EntreeFreebet): ResultatFreebet {
  let qH: number, qR: number, fH: number, fR: number;
  if (e.mode === "book") {
    qH = (e.qMise * e.qCote) / e.qCoteInverse;
    qR = e.qMise * e.qCote - e.qMise - qH;
    fH = (e.fMontant * (e.fCote - 1)) / e.fCoteInverse;
    fR = e.fMontant * (e.fCote - 1) - fH;
  } else {
    qH = (e.qMise * e.qCote) / (e.qCoteInverse - e.qCommission);
    qR = qH * (1 - e.qCommission) - e.qMise;
    fH = (e.fMontant * (e.fCote - 1)) / (e.fCoteInverse - e.fCommission);
    fR = fH * (1 - e.fCommission);
  }
  return {
    qualif: { miseCouverture: qH, resultat: qR },
    freebet: { miseCouverture: fH, resultat: fR },
    total: qR + fR,
    conversion: fR / e.fMontant,
  };
}

/** Appréciation du taux de conversion (seuils du carnet : 70 % bon, 60 % correct). */
export function appreciationConversion(conversion: number): "ok" | "mid" | "ko" {
  return conversion >= 0.7 ? "ok" : conversion >= 0.6 ? "mid" : "ko";
}
