// Moteur de la méthode +1.5 (Team Soccer Bet) : 6 critères, score sur 100, verdict.
import { OTHER_LEAGUE } from './defaults';
import type { AnalysisInput, League, Settings, Verdict, Weights } from './types';

export type StepKey = keyof Weights;
export type Status = 'ok' | 'warn' | 'fail' | 'block' | 'todo';

export const STEPS: { key: StepKey; title: string; short: string }[] = [
  { key: 'league', title: 'Championnat', short: 'Ligue' },
  { key: 'teams', title: 'Équipes', short: 'Équipes' },
  { key: 'homeAway', title: 'Domicile / Extérieur', short: 'Dom/Ext' },
  { key: 'injuries', title: 'Blessés', short: 'Blessés' },
  { key: 'h2h', title: 'Confrontations directes', short: 'H2H' },
  { key: 'odds', title: 'Cote', short: 'Cote' },
];

export interface CriterionResult {
  key: StepKey;
  title: string;
  status: Status;
  /** Note du critère, de 0 à 1. */
  score: number;
  weight: number;
  /** Points obtenus sur 100. */
  points: number;
  /** Points maximum sur 100. */
  max: number;
  detail: string;
  alerts: string[];
}

export interface Evaluation {
  criteria: CriterionResult[];
  score: number;
  verdict: Verdict;
  blockers: string[];
  alerts: string[];
  /** Probabilité estimée de +1.5 (0-1), à partir des données saisies. */
  estProb: number | null;
  fairOdds: number | null;
  value: number | null;
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function parseScore(s: string): [number, number] | null {
  const m = s.trim().match(/^(\d{1,2})\s*[-–:\s]\s*(\d{1,2})$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

export function findLeague(input: AnalysisInput, leagues: League[]): League | null {
  if (!input.leagueId || input.leagueId === OTHER_LEAGUE) return null;
  return leagues.find((l) => l.id === input.leagueId) ?? null;
}

export function leagueLabel(input: AnalysisInput, leagues: League[]): string {
  const l = findLeague(input, leagues);
  if (l) return l.name;
  return input.otherLeagueName.trim() || 'Autre championnat';
}

export function isOutOfMethod(input: AnalysisInput, leagues: League[]): boolean {
  if (!input.leagueId) return false;
  const l = findLeague(input, leagues);
  return !l || !l.inMethod;
}

/** Une étape est-elle correctement remplie (saisie obligatoire) ? */
export function stepComplete(key: StepKey, input: AnalysisInput): boolean {
  switch (key) {
    case 'league':
      return !!input.leagueId && isNum(input.leaguePct) && input.leaguePct >= 0 && input.leaguePct <= 100 &&
        (input.leagueId !== OTHER_LEAGUE || input.otherLeagueName.trim().length > 0);
    case 'teams': {
      const ok = (t: AnalysisInput['home']) =>
        t.name.trim().length > 0 && isNum(t.played) && t.played > 0 && isNum(t.scored) && t.scored >= 0 && isNum(t.conceded) && t.conceded >= 0;
      return ok(input.home) && ok(input.away);
    }
    case 'homeAway':
      return isNum(input.homePct) && isNum(input.awayPct) && input.homePct >= 0 && input.homePct <= 100 && input.awayPct >= 0 && input.awayPct <= 100;
    case 'injuries':
      return input.homeScorerOk !== null && input.awayScorerOk !== null;
    case 'h2h': {
      if (input.h2hNone) return true;
      const filled = input.h2h.filter((s) => s.trim() !== '');
      return filled.length > 0 && filled.every((s) => parseScore(s) !== null);
    }
    case 'odds':
      return isNum(input.odds) && input.odds > 1.01 && input.odds < 20;
  }
}

export function missingHint(key: StepKey): string {
  switch (key) {
    case 'league': return 'Choisis le championnat et son % de matchs +1.5.';
    case 'teams': return 'Renseigne les deux équipes : matchs joués, buts marqués et encaissés.';
    case 'homeAway': return 'Renseigne le % +1.5 de l\'équipe à domicile et de l\'adversaire à l\'extérieur.';
    case 'injuries': return 'Réponds pour chaque équipe : le meilleur buteur est-il disponible ?';
    case 'h2h': return 'Saisis les derniers scores (ex. 2-1) ou coche « pas de confrontation récente ».';
    case 'odds': return 'Saisis la cote +1.5 proposée.';
  }
}

export function h2hStats(input: AnalysisInput) {
  const scores = input.h2hNone ? [] : input.h2h.map(parseScore).filter((x): x is [number, number] => x !== null);
  const n = scores.length;
  const over = scores.filter(([a, b]) => a + b >= 2).length;
  const goals = scores.reduce((s, [a, b]) => s + a + b, 0);
  return { n, over, rate: n ? over / n : null, avg: n ? goals / n : null, scores };
}

export function teamAverages(t: AnalysisInput['home']) {
  if (!isNum(t.played) || t.played <= 0 || !isNum(t.scored) || !isNum(t.conceded)) return null;
  return { scored: t.scored / t.played, conceded: t.conceded / t.played };
}

/** Buts attendus sur le match (moyenne attaque / défense adverse). */
export function expectedGoals(input: AnalysisInput): number | null {
  const h = teamAverages(input.home);
  const a = teamAverages(input.away);
  if (!h || !a) return null;
  return (h.scored + a.conceded) / 2 + (a.scored + h.conceded) / 2;
}

/** P(au moins 2 buts) avec une loi de Poisson de paramètre lambda. */
export function poissonOver15(lambda: number): number {
  return 1 - Math.exp(-lambda) * (1 + lambda);
}

function evalLeague(input: AnalysisInput, leagues: League[], s: Settings): Omit<CriterionResult, 'weight' | 'points' | 'max' | 'title' | 'key'> {
  if (!stepComplete('league', input)) return { status: 'todo', score: 0, detail: 'À compléter', alerts: [] };
  const p = input.leaguePct!;
  const t = s.leagueThreshold;
  const score = clamp((p - (t - 20)) / 25);
  const name = leagueLabel(input, leagues);
  if (isOutOfMethod(input, leagues)) {
    return {
      status: s.blocking.outOfMethod ? 'block' : 'fail',
      score: Math.min(score, 0.3),
      detail: `${name} : championnat hors méthode (${p} %).`,
      alerts: ['Championnat « hors méthode » : la méthode se limite aux grands championnats.'],
    };
  }
  if (p >= t) return { status: 'ok', score, detail: `${name} : ${p} % de matchs +1.5 (seuil ${t} %).`, alerts: [] };
  const status = p >= t - 5 ? 'warn' : s.blocking.belowThreshold ? 'block' : 'fail';
  return {
    status,
    score,
    detail: `${name} : ${p} %, sous le seuil de ${t} %.`,
    alerts: [`${name} est sous ton seuil de ${t} % de matchs +1.5.`],
  };
}

function evalTeams(input: AnalysisInput, s: Settings) {
  if (!stepComplete('teams', input)) return { status: 'todo' as Status, score: 0, detail: 'À compléter', alerts: [] as string[] };
  const h = teamAverages(input.home)!;
  const a = teamAverages(input.away)!;
  const okTeam = (x: { scored: number; conceded: number }) => x.scored >= s.teamMinScored && x.conceded >= s.teamMinConceded;
  const hOk = okTeam(h);
  const aOk = okTeam(a);
  const lambda = expectedGoals(input)!;
  const nOk = Number(hOk) + Number(aOk);
  const score = clamp(0.5 * (nOk / 2) + 0.5 * clamp((lambda - 2) / 1.2));
  const f = (n: number) => n.toFixed(2).replace('.', ',');
  const detail = `${input.home.name} ${f(h.scored)} marqués / ${f(h.conceded)} encaissés · ${input.away.name} ${f(a.scored)} / ${f(a.conceded)} · ${f(lambda)} buts attendus.`;
  const alerts: string[] = [];
  const why = (name: string, x: { scored: number; conceded: number }) => {
    const r: string[] = [];
    if (x.scored < s.teamMinScored) r.push(`marque peu (${f(x.scored)}/match)`);
    if (x.conceded < s.teamMinConceded) r.push(`encaisse peu (${f(x.conceded)}/match)`);
    return `${name} ${r.join(' et ')}.`;
  };
  if (!hOk) alerts.push(why(input.home.name, h));
  if (!aOk) alerts.push(why(input.away.name, a));
  let status: Status = 'ok';
  if (nOk < 2) status = s.blocking.teams ? 'block' : 'fail';
  else if (lambda < 2.3) status = 'warn';
  if (lambda < 2.3) alerts.push(`Seulement ${f(lambda)} buts attendus sur ce match.`);
  return { status, score, detail, alerts };
}

function evalHomeAway(input: AnalysisInput, s: Settings) {
  if (!stepComplete('homeAway', input)) return { status: 'todo' as Status, score: 0, detail: 'À compléter', alerts: [] as string[] };
  const hp = input.homePct!;
  const ap = input.awayPct!;
  const avg = (hp + ap) / 2;
  const score = clamp((avg - 55) / 35);
  const min = Math.min(hp, ap);
  const status: Status = min >= s.homeAwayMin ? 'ok' : min >= s.homeAwayMin - 10 ? 'warn' : 'fail';
  const alerts: string[] = [];
  if (hp < s.homeAwayMin) alerts.push(`${input.home.name || 'Domicile'} : ${hp} % de +1.5 à domicile (objectif ${s.homeAwayMin} %).`);
  if (ap < s.homeAwayMin) alerts.push(`${input.away.name || 'Extérieur'} : ${ap} % de +1.5 à l'extérieur (objectif ${s.homeAwayMin} %).`);
  return { status, score, detail: `${input.home.name || 'Domicile'} à domicile ${hp} % · ${input.away.name || 'Extérieur'} à l'extérieur ${ap} %.`, alerts };
}

function evalInjuries(input: AnalysisInput) {
  if (!stepComplete('injuries', input)) return { status: 'todo' as Status, score: 0, detail: 'À compléter', alerts: [] as string[] };
  const alerts: string[] = [];
  if (input.homeScorerOk === false) alerts.push(`Buteur clé absent : ${input.homeScorer || input.home.name || 'équipe à domicile'}.`);
  if (input.awayScorerOk === false) alerts.push(`Buteur clé absent : ${input.awayScorer || input.away.name || 'équipe à l\'extérieur'}.`);
  if (alerts.length) return { status: 'block' as Status, score: 0, detail: 'Un meilleur buteur est absent : critère bloquant.', alerts };
  const score = clamp(1 - 0.2 * input.otherAbsences);
  const status: Status = input.otherAbsences >= 2 ? 'warn' : 'ok';
  if (input.otherAbsences > 0) alerts.push(`${input.otherAbsences} autre(s) absence(s) importante(s) signalée(s).`);
  return { status, score, detail: 'Meilleurs buteurs disponibles des deux côtés.', alerts };
}

function evalH2H(input: AnalysisInput, s: Settings) {
  if (!stepComplete('h2h', input)) return { status: 'todo' as Status, score: 0, detail: 'À compléter', alerts: [] as string[] };
  const st = h2hStats(input);
  if (st.n === 0) return { status: 'warn' as Status, score: 0.5, detail: 'Pas de confrontation récente : critère neutre.', alerts: [] as string[] };
  const rate = st.rate!;
  const avg = st.avg!;
  const alerts: string[] = [];
  const low = (st.n >= 3 && rate < 0.6) || avg < 2;
  let status: Status = rate >= 0.8 && avg >= 2.2 ? 'ok' : rate >= 0.6 ? 'warn' : 'fail';
  if (low) {
    alerts.push(`Tendance aux petits scores : ${st.over}/${st.n} confrontations à +1.5, ${avg.toFixed(1).replace('.', ',')} buts en moyenne.`);
    if (s.blocking.h2hLow) status = 'block';
    else if (status === 'ok') status = 'warn';
  }
  return { status, score: clamp(rate * 0.8 + clamp((avg - 1.5) / 2) * 0.2), detail: `${st.over}/${st.n} confrontations avec au moins 2 buts (moyenne ${avg.toFixed(1).replace('.', ',')}).`, alerts };
}

function evalOdds(input: AnalysisInput, s: Settings) {
  if (!stepComplete('odds', input)) return { status: 'todo' as Status, score: 0, detail: 'À compléter', alerts: [] as string[] };
  const o = input.odds!;
  const f = (n: number) => n.toFixed(2).replace('.', ',');
  const range = `${f(s.oddsMin)}–${f(s.oddsMax)}`;
  if (o >= s.oddsMin && o <= s.oddsMax) return { status: 'ok' as Status, score: 1, detail: `Cote ${f(o)} dans la fourchette habituelle ${range}.`, alerts: [] as string[] };
  const out = s.blocking.oddsOutOfRange;
  if (o < s.oddsMin) {
    const score = clamp(1 - (s.oddsMin - o) / 0.15);
    const status: Status = out ? 'block' : o < s.oddsMin - 0.1 ? 'fail' : 'warn';
    return { status, score, detail: `Cote ${f(o)} : trop basse, peu de gain pour le risque.`, alerts: [`Cote ${f(o)} sous la fourchette ${range}.`] };
  }
  const score = clamp(1 - (o - s.oddsMax) / 0.25);
  const status: Status = out ? 'block' : o > s.oddsMax + 0.2 ? 'fail' : 'warn';
  return { status, score, detail: `Cote ${f(o)} : élevée, le bookmaker croit moins au +1.5.`, alerts: [`Cote ${f(o)} au-dessus de la fourchette ${range}.`] };
}

export function evaluateStep(key: StepKey, input: AnalysisInput, leagues: League[], s: Settings) {
  switch (key) {
    case 'league': return evalLeague(input, leagues, s);
    case 'teams': return evalTeams(input, s);
    case 'homeAway': return evalHomeAway(input, s);
    case 'injuries': return evalInjuries(input);
    case 'h2h': return evalH2H(input, s);
    case 'odds': return evalOdds(input, s);
  }
}

/** Probabilité estimée de +1.5 en mélangeant les indicateurs disponibles. */
export function estimateProbability(input: AnalysisInput): number | null {
  const parts: [number, number][] = [];
  if (isNum(input.leaguePct)) parts.push([input.leaguePct / 100, 1]);
  if (isNum(input.homePct) && isNum(input.awayPct)) parts.push([(input.homePct + input.awayPct) / 200, 2]);
  const lambda = expectedGoals(input);
  if (lambda !== null) parts.push([poissonOver15(lambda), 1.5]);
  const h = h2hStats(input);
  if (h.rate !== null && h.n >= 3) parts.push([h.rate, 0.5]);
  if (!parts.length) return null;
  const w = parts.reduce((s, [, k]) => s + k, 0);
  let p = parts.reduce((s, [v, k]) => s + v * k, 0) / w;
  if (input.homeScorerOk === false || input.awayScorerOk === false) p -= 0.05;
  p -= 0.015 * input.otherAbsences;
  return clamp(p, 0.01, 0.99);
}

export function evaluate(input: AnalysisInput, leagues: League[], s: Settings): Evaluation {
  const totalW = Object.values(s.weights).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const criteria: CriterionResult[] = STEPS.map(({ key, title }) => {
    const r = evaluateStep(key, input, leagues, s);
    const weight = Math.max(0, s.weights[key]);
    const max = (weight / totalW) * 100;
    return { key, title, weight, max, points: r.score * max, ...r };
  });
  const score = Math.round(criteria.reduce((a, c) => a + c.points, 0));
  const blockers = criteria.filter((c) => c.status === 'block').map((c) => `${c.title} : ${c.alerts[0] ?? c.detail}`);
  const anyFail = criteria.some((c) => c.status === 'fail' || c.status === 'todo');
  let verdict: Verdict;
  if (blockers.length) verdict = 'RED';
  else if (score >= s.greenMin && !anyFail) verdict = 'GREEN';
  else if (score >= s.orangeMin) verdict = 'ORANGE';
  else verdict = 'RED';
  const alerts = criteria.flatMap((c) => c.alerts);
  const estProb = estimateProbability(input);
  const fairOdds = estProb ? 1 / estProb : null;
  const value = estProb && isNum(input.odds) ? estProb * input.odds - 1 : null;
  return { criteria, score, verdict, blockers, alerts, estProb, fairOdds, value };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  GREEN: 'FEUX OUVERTS',
  ORANGE: 'PRUDENCE',
  RED: 'NE PAS PARIER',
};

export const VERDICT_TEXT: Record<Verdict, string> = {
  GREEN: 'Tous les voyants sont au vert : le match colle à la méthode.',
  ORANGE: 'Le match est jouable mais certains critères sont fragiles. Mise fixe, pas plus.',
  RED: 'Le match ne respecte pas la méthode. On passe : il y aura d\'autres matchs.',
};
