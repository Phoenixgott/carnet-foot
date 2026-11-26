// Méthode Over 1.5 en live (vidéo de Steven, Team Soccer Bet) :
// on choisit le match avant (4 critères), on entre en live à 0-0 vers la 15e-20e minute
// si le match est animé et la cote assez haute, puis on sécurise au premier but.
import type { Check, Context, MatchData, Settings, TeamData, Verdict } from './types';

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const f1 = (n: number) => n.toFixed(1).replace('.', ',');

export interface Criterion {
  key: 'attaque' | 'buteurs' | 'pourcentage' | 'contexte';
  title: string;
  /** Explication « pour un enfant de 10 ans ». */
  simple: string;
  status: Check;
  detail: string;
  /** Phrase courte quand le critère n'est pas bon. */
  bad: string;
  /** Phrase courte quand il faut vérifier. */
  check: string;
}

export interface Analysis {
  criteria: Criterion[];
  verdict: Verdict;
  okCount: number;
  headline: string;
  reason: string;
  /** Buts attendus sur le match. */
  lambda: number;
  h2h: { n: number; over: number; avg: number | null };
}

export function perMatch(t: TeamData): { scored: number; conceded: number } | null {
  if (!isNum(t.played) || t.played <= 0 || !isNum(t.scored) || !isNum(t.conceded)) return null;
  return { scored: t.scored / t.played, conceded: t.conceded / t.played };
}

/** % de matchs à 2 buts ou plus : chiffre trouvé, sinon estimé à partir des buts marqués + encaissés. */
export function over15Info(t: TeamData): { rate: number; estimated: boolean } | null {
  if (isNum(t.played) && t.played > 0 && isNum(t.over15)) return { rate: clamp(t.over15 / t.played, 0, 1), estimated: false };
  if (isNum(t.over15Pct)) return { rate: clamp(t.over15Pct / 100, 0, 1), estimated: false };
  const p = perMatch(t);
  if (!p) return null;
  const mu = p.scored + p.conceded;
  return { rate: clamp(1 - Math.exp(-mu) * (1 + mu), 0, 1), estimated: true };
}

export function over15Rate(t: TeamData): number | null {
  return over15Info(t)?.rate ?? null;
}

export function parseScore(s: string): [number, number] | null {
  const m = String(s).trim().match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Buts attendus : (attaque domicile + défense extérieur)/2 + (attaque extérieur + défense domicile)/2. */
export function expectedGoals(m: MatchData): number {
  const h = perMatch(m.home);
  const a = perMatch(m.away);
  if (!h || !a) return 2.7;
  return clamp((h.scored + a.conceded) / 2 + (a.scored + h.conceded) / 2, 0.8, 5.5);
}

const worst = (list: Check[]): Check => (list.includes('fail') ? 'fail' : list.includes('unknown') ? 'unknown' : list.includes('warn') ? 'warn' : 'ok');

function critAttaque(m: MatchData, s: Settings): Criterion {
  const min = s.teamMin;
  const one = (t: TeamData) => {
    const p = perMatch(t);
    if (!p) return { st: 'unknown' as Check, txt: `${t.name} : chiffres manquants` };
    const st: Check = p.scored >= min && p.conceded >= min ? 'ok' : p.scored >= min - 0.2 && p.conceded >= min - 0.2 ? 'warn' : 'fail';
    return { st, txt: `${t.name} marque ${f1(p.scored)} et encaisse ${f1(p.conceded)} buts par match` };
  };
  const h = one(m.home);
  const a = one(m.away);
  return {
    key: 'attaque',
    title: 'Les deux équipes marquent ET encaissent',
    simple: `Il faut deux équipes qui marquent beaucoup mais qui prennent aussi des buts : au moins ${f1(min)} but marqué et ${f1(min)} but encaissé par match chacune.`,
    status: worst([h.st, a.st]),
    detail: `${h.txt}. ${a.txt}.`,
    bad: 'une équipe ne marque pas ou n\'encaisse pas assez',
    check: 'les buts marqués et encaissés sont justes',
  };
}

function critButeurs(m: MatchData): Criterion {
  const all = [...m.home.scorers.map((x) => ({ ...x, team: m.home.name })), ...m.away.scorers.map((x) => ({ ...x, team: m.away.name }))];
  const out = all.filter((x) => x.available === false);
  const absents = [...m.home.absents, ...m.away.absents].filter(Boolean);
  let status: Check;
  let detail: string;
  if (out.length) {
    status = 'fail';
    detail = `Absent : ${out.map((x) => `${x.name} (${x.team})`).join(', ')}.`;
  } else if (!all.length || all.every((x) => x.available === null)) {
    status = 'unknown';
    detail = 'On ne sait pas si les meilleurs buteurs jouent : vérifie avant de parier.';
  } else if (all.some((x) => x.available === null)) {
    status = 'warn';
    detail = `Pas sûr pour : ${all.filter((x) => x.available === null).map((x) => x.name).join(', ')}.`;
  } else if (absents.length) {
    status = 'warn';
    detail = `Buteurs présents, mais d'autres absents en attaque : ${absents.join(', ')}.`;
  } else {
    status = 'ok';
    detail = `Présents : ${all.map((x) => `${x.name}${isNum(x.goals) ? ` (${x.goals} buts)` : ''}`).join(', ')}.`;
  }
  return {
    key: 'buteurs',
    title: 'Les meilleurs buteurs jouent',
    simple: 'Si un attaquant important est blessé ou suspendu, c\'est un signal d\'alarme : moins de chances de voir des buts.',
    status,
    detail,
    bad: 'un buteur important est absent',
    check: 'les meilleurs buteurs jouent bien',
  };
}

function critPourcentage(m: MatchData, s: Settings): Criterion {
  const min = s.over15Min / 100;
  const one = (t: TeamData) => {
    const info = over15Info(t);
    if (info === null) return { st: 'unknown' as Check, txt: `${t.name} : chiffre manquant` };
    const r = info.rate;
    const st: Check = r >= min ? 'ok' : r >= min - 0.15 ? 'warn' : 'fail';
    return { st, txt: `${t.name} : ${info.estimated ? 'environ ' : ''}${Math.round(r * 100)} % de ses matchs avec 2 buts ou plus${info.estimated ? ' (estimé avec ses buts)' : ''}` };
  };
  const h = one(m.home);
  const a = one(m.away);
  return {
    key: 'pourcentage',
    title: 'Beaucoup de matchs avec 2 buts ou plus',
    simple: `Dans les matchs de chaque équipe cette saison, il doit souvent y avoir au moins 2 buts : ${s.over15Min} % des matchs ou plus.`,
    status: worst([h.st, a.st]),
    detail: `${h.txt}. ${a.txt}.`,
    bad: 'pas assez de matchs avec 2 buts ou plus',
    check: 'le nombre de matchs avec 2 buts ou plus',
  };
}

export const CONTEXT_LABEL: Record<Context, string> = {
  normal: 'Match normal',
  finale: 'Finale',
  derby: 'Derby',
  maintien: 'Match pour le maintien',
  montee: 'Match pour la montée',
  sans_enjeu: 'Match sans enjeu',
  inconnu: 'Contexte inconnu',
};

function critContexte(m: MatchData): Criterion {
  const c = m.context;
  const status: Check = c === 'normal' ? 'ok' : c === 'inconnu' ? 'unknown' : 'fail';
  const why: Record<Context, string> = {
    normal: 'Pas de pression spéciale : les équipes jouent leur jeu.',
    finale: 'Une finale : les équipes ont peur de perdre et ferment le jeu.',
    derby: 'Un derby : beaucoup de tension, le match peut se bloquer.',
    maintien: 'Une équipe joue sa survie : elle risque de défendre à fond.',
    montee: 'Un match pour la montée : grosse pression, prudence.',
    sans_enjeu: 'Match sans enjeu : il peut partir dans tous les sens ou rester fermé.',
    inconnu: 'On ne connaît pas l\'enjeu du match : vérifie.',
  };
  return {
    key: 'contexte',
    title: 'Pas de pression excessive',
    simple: 'On évite les finales, les derbys, les matchs pour le maintien ou la montée, et les matchs sans enjeu.',
    status,
    detail: `${CONTEXT_LABEL[c]}${m.contextDetail ? ` (${m.contextDetail})` : ''}. ${why[c]}`,
    bad: c === 'sans_enjeu' ? 'match sans enjeu : il peut rester fermé' : `${CONTEXT_LABEL[c].toLowerCase()} : trop de pression`,
    check: 'l\'enjeu du match',
  };
}

export function h2hStats(m: MatchData) {
  const sc = m.h2h.map(parseScore).filter((x): x is [number, number] => x !== null);
  const n = sc.length;
  return { n, over: sc.filter(([a, b]) => a + b >= 2).length, avg: n ? sc.reduce((t, [a, b]) => t + a + b, 0) / n : null };
}

export function analyze(m: MatchData, s: Settings): Analysis {
  const criteria = [critAttaque(m, s), critButeurs(m), critPourcentage(m, s), critContexte(m)];
  const okCount = criteria.filter((c) => c.status === 'ok').length;
  const fails = criteria.filter((c) => c.status === 'fail');
  const doubts = criteria.filter((c) => c.status === 'warn' || c.status === 'unknown');
  let verdict: Verdict;
  let headline: string;
  let reason: string;
  if (fails.length) {
    verdict = 'RED';
    headline = 'ON NE JOUE PAS';
    reason = `Pourquoi : ${fails.map((c) => c.bad).join(' ; ')}.`;
  } else if (doubts.length) {
    verdict = 'ORANGE';
    headline = 'PRUDENCE';
    reason = `À vérifier : ${doubts.map((c) => c.check).join(' ; ')}.`;
  } else {
    verdict = 'GREEN';
    headline = 'ON PEUT JOUER EN LIVE';
    reason = 'Les 4 critères sont bons. On attend le match et on suit le plan.';
  }
  return { criteria, verdict, okCount, headline, reason, lambda: expectedGoals(m), h2h: h2hStats(m) };
}

// ---------- Live ----------

/** Répartition des buts par tranche de 15 minutes (Premier League 2024, SoccerSTATS). */
const GOAL_SHARE = [0.115, 0.141, 0.159, 0.157, 0.182, 0.246];

/** Part des buts du match encore à venir à la minute donnée (0 → 1, 90 → 0). */
export function remainingShare(minute: number): number {
  const m = clamp(minute, 0, 90);
  let done = 0;
  for (let i = 0; i < 6; i++) {
    const from = i * 15;
    if (m >= from + 15) done += GOAL_SHARE[i];
    else if (m > from) done += GOAL_SHARE[i] * ((m - from) / 15);
  }
  return clamp(1 - done, 0, 1);
}

function poissonAtLeast(lambda: number, k: number): number {
  if (k <= 0) return 1;
  let p = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    p += term;
    term *= lambda / (i + 1);
  }
  return clamp(1 - p, 0, 1);
}

/** Chances d'avoir au moins 2 buts au total, sachant le score et la minute. */
export function chanceOver15(lambda: number, minute: number, goalsSoFar = 0): number {
  return poissonAtLeast(lambda * remainingShare(minute), 2 - goalsSoFar);
}

/** Cote minimum à accepter en live : la règle de la méthode, ou plus si le match est moins prometteur. */
export function minOddsAt(lambda: number, minute: number, s: Settings): { min: number; fair: number; chance: number } {
  const chance = chanceOver15(lambda, minute, 0);
  const fair = chance > 0 ? 1 / chance : 99;
  return { min: Math.max(s.minLiveOdds, Math.ceil(fair * 1.05 * 100) / 100), fair, chance };
}

export interface HedgePlan {
  /** Mise à placer sur « Moins de 1,5 but ». */
  stake: number;
  /** Gain garanti quoi qu'il arrive. */
  gain: number;
  worth: boolean;
}

/** Pari contraire : mise S à la cote O sur « Plus de 1,5 », couverture à la cote U sur « Moins de 1,5 ». */
export function hedgePlan(S: number, O: number, U: number): HedgePlan {
  const stake = Math.round(((S * O) / U) * 100) / 100;
  const gain = Math.round((S * O - S - stake) * 100) / 100;
  return { stake, gain, worth: gain > 0 };
}

/** Résultat final d'un pari couvert, selon que le match a fini avec 2 buts ou plus. */
export function hedgedPnl(S: number, O: number, H: number, U: number, over: boolean): number {
  return Math.round((over ? S * (O - 1) - H : H * (U - 1) - S) * 100) / 100;
}

export const VERDICT_COLOR: Record<Verdict, string> = {
  GREEN: 'var(--green)',
  ORANGE: 'var(--orange)',
  RED: 'var(--red)',
};
