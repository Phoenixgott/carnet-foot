// Le calcul de la « value » : la cote est-elle trop généreuse par rapport à la vraie chance ?
// Chance du bookmaker = 1 ÷ cote. Vraie chance = Pinnacle sans sa marge, sinon l'estimation de Claude ou la tienne.
import type { Outsider, PinnacleOdds, ProbSource, Settings, Verdict } from './types';

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 1;
const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',').replace(',0', '')} %`;

/** Chance donnée par une cote : 1 ÷ cote. */
export function impliedProb(odds: number): number {
  return 1 / odds;
}

/** Vraie chance d'après Pinnacle, marge retirée. */
export function pinnacleProb(p: PinnacleOdds, margin: number): { p: number; source: ProbSource } | null {
  if (!ok(p.out)) return null;
  if (ok(p.draw) && ok(p.fav)) {
    const sum = 1 / p.out + 1 / p.draw + 1 / p.fav;
    return { p: 1 / p.out / sum, source: 'pinnacle' };
  }
  if (ok(p.fav) && !p.draw) {
    // Pari à deux issues (ex. qualification, tennis) : on retire la marge des deux côtés.
    const sum = 1 / p.out + 1 / p.fav;
    return { p: 1 / p.out / sum, source: 'pinnacle' };
  }
  return { p: 1 / p.out / (1 + margin), source: 'pinnacle1' };
}

export interface ValueResult {
  /** Chance selon ta cote. */
  bookProb: number;
  /** Vraie chance estimée. */
  trueProb: number;
  source: ProbSource;
  /** 0,12 = +12 % de value. */
  value: number;
  verdict: Verdict;
  /** Cote juste (sans marge). */
  fairOdds: number;
  /** Cote minimum pour que ce soit encore « OK ». */
  minOdds: number;
  isOutsider: boolean;
  /** Phrase toute simple qui explique le résultat. */
  sentence: string;
}

export const SOURCE_LABEL: Record<ProbSource, string> = {
  pinnacle: 'Pinnacle (le plus fiable)',
  pinnacle1: 'Pinnacle (une seule cote)',
  claude: 'estimation de Claude',
  perso: 'ton estimation',
};

export function computeValue(odds: number, trueProb: number, source: ProbSource, s: Settings, team = "l'outsider"): ValueResult {
  const bookProb = impliedProb(odds);
  const value = trueProb * odds - 1;
  const verdict: Verdict = value >= s.valueMin ? 'OK' : value >= 0 ? 'BOF' : 'NON';
  const fairOdds = 1 / trueProb;
  const minOdds = Math.ceil(fairOdds * (1 + s.valueMin) * 100) / 100;
  const isOutsider = odds >= s.minOdds;
  const who = team || "l'équipe";
  const sentence =
    verdict === 'OK'
      ? `Ta cote donne ${pct(bookProb)} de chances à ${who}. La vraie chance est de ${pct(trueProb)}. La cote est trop généreuse : c'est une bonne affaire.`
      : verdict === 'BOF'
        ? `Ta cote donne ${pct(bookProb)} de chances à ${who}, la vraie chance est de ${pct(trueProb)}. C'est presque pareil : pas assez intéressant.`
        : `Ta cote donne ${pct(bookProb)} de chances à ${who}, mais la vraie chance n'est que de ${pct(trueProb)}. La cote est un piège.`;
  return { bookProb, trueProb, source, value, verdict, fairOdds, minOdds, isOutsider, sentence };
}

/** Value d'un outsider proposé par Claude (Pinnacle d'abord, sinon l'estimation de Claude). */
export function pickValue(p: Outsider, s: Settings): ValueResult | null {
  if (!ok(p.odds)) return null;
  const pin = pinnacleProb(p.pinnacle, s.pinnacleMargin);
  if (pin) return computeValue(p.odds, pin.p, pin.source, s, p.team);
  if (typeof p.estimate === 'number' && p.estimate > 0 && p.estimate < 1) return computeValue(p.odds, p.estimate, 'claude', s, p.team);
  return null;
}

export const VERDICT_WORD: Record<Verdict, string> = { OK: 'BONNE AFFAIRE', BOF: 'BOF', NON: 'PIÈGE' };
export const VERDICT_SHORT: Record<Verdict, string> = { OK: '✅ OK', BOF: '➖ Bof', NON: '❌ Pas OK' };
export const VERDICT_COLOR: Record<Verdict, string> = { OK: 'var(--green-d)', BOF: 'var(--orange-d)', NON: 'var(--red-d)' };

/** Tranche de cote, pour le bilan. */
export function oddsBand(o: number): string {
  if (o < 3) return 'Moins de 3';
  if (o < 5) return '3 à 5';
  if (o < 8) return '5 à 8';
  return 'Plus de 8';
}
export const BANDS = ['Moins de 3', '3 à 5', '5 à 8', 'Plus de 8'];

export function signedPct(v: number): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)} %`;
}

/** La value en une phrase de tous les jours : ce que tu gagnes ou perds en moyenne pour 100 € joués. */
export function valueInWords(v: number): string {
  const n = Math.round(Math.abs(v) * 100);
  if (n === 0) return 'Sur 100 € joués sur des paris comme celui-ci, tu ne gagnes ni ne perds rien en moyenne.';
  return v > 0
    ? `Sur 100 € joués sur des paris comme celui-ci, tu gagnerais en moyenne ${n} € (en jouant longtemps).`
    : `Sur 100 € joués sur des paris comme celui-ci, tu perdrais en moyenne ${n} € (en jouant longtemps).`;
}
