/**
 * Couverture du pari +1.5 après le premier but (formules du carnet d'origine).
 *
 * Situation : on a misé S à la cote O sur « plus de 1,5 but ». Un but est marqué (1-0).
 * Il faut encore un but pour gagner. Trois façons de sécuriser :
 *  - pari contraire « moins de 1,5 but » à la cote X chez un autre bookmaker ;
 *  - lay de « plus de 1,5 but » à la cote X sur un exchange, avec commission c ;
 *  - cash-out proposé C par le bookmaker (valeur fixée par lui, non calculable).
 */

export interface CouvertureContraire {
  /** Mise à placer sur « moins de 1,5 but ». */
  miseCouverture: number;
  /** Profit identique quel que soit le score final. */
  profit: number;
  /** Sans couvrir : résultat si un 2e but arrive. */
  sansCouvrirSiBut: number;
  /** Sans couvrir : résultat si aucun autre but. */
  sansCouvrirSiPasDeBut: number;
}

/** Pari contraire chez un autre bookmaker : la mise égalise le résultat des deux issues. */
export function couverturePariContraire(mise: number, cotePrise: number, coteContraire: number): CouvertureContraire {
  const H = (mise * cotePrise) / coteContraire;
  return {
    miseCouverture: H,
    profit: mise * cotePrise - mise - H,
    sansCouvrirSiBut: mise * cotePrise - mise,
    sansCouvrirSiPasDeBut: -mise,
  };
}

export interface CouvertureLay {
  /** Mise lay à placer. */
  miseLay: number;
  /** Somme bloquée sur l'exchange (responsabilité). */
  responsabilite: number;
  /** Résultat si un 2e but arrive. */
  siBut: number;
  /** Résultat si aucun autre but. */
  siPasDeBut: number;
  /** Profit garanti = le plus petit des deux. */
  profitMin: number;
}

/** Lay sur un exchange avec commission (en fraction : 0,05 pour 5 %). */
export function couvertureLay(mise: number, cotePrise: number, coteLay: number, commission: number): CouvertureLay {
  const L = (mise * cotePrise) / (coteLay - commission);
  const responsabilite = L * (coteLay - 1);
  const siBut = mise * (cotePrise - 1) - responsabilite;
  const siPasDeBut = L * (1 - commission) - mise;
  return { miseLay: L, responsabilite, siBut, siPasDeBut, profitMin: Math.min(siBut, siPasDeBut) };
}

/** Cash-out : bénéfice net = montant proposé − mise. */
export function resultatCashOut(mise: number, montantPropose: number): number {
  return montantPropose - mise;
}
