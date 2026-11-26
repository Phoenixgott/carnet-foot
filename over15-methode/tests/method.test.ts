import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, chanceOver15, hedgedPnl, hedgePlan, minOddsAt, remainingShare } from '../src/lib/method';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import type { MatchData, TeamData } from '../src/lib/types';

const S = structuredClone(DEFAULT_SETTINGS);
const team = (p: Partial<TeamData>): TeamData => ({ name: 'A', played: 16, scored: 19, conceded: 17, over15: 13, scorers: [{ name: 'Buteur', goals: 8, available: true }], absents: [], ...p });
const match = (p: Partial<MatchData> = {}): MatchData => ({
  id: 'm',
  date: '2026-11-26',
  time: '21:00',
  competition: 'Série A',
  home: team({ name: 'Bragantino' }),
  away: team({ name: 'Fluminense', played: 16, scored: 22, conceded: 18, over15: 13 }),
  h2h: ['2-1', '1-1', '3-0'],
  context: 'normal',
  contextDetail: '',
  preOdds: 1.25,
  sources: [],
  importedAt: '',
  ...p,
});

test('les 4 critères bons = vert', () => {
  const a = analyze(match(), S);
  assert.equal(a.verdict, 'GREEN');
  assert.equal(a.okCount, 4);
});

test('exemple de la vidéo : 27 marqués / 9 encaissés en 16 matchs = écarté', () => {
  const a = analyze(match({ home: team({ name: 'Palmeiras', played: 16, scored: 27, conceded: 9 }) }), S);
  assert.equal(a.criteria[0].status, 'fail');
  assert.equal(a.verdict, 'RED');
});

test('buteur absent = rouge', () => {
  const a = analyze(match({ away: team({ scorers: [{ name: 'Cano', goals: 10, available: false }] }) }), S);
  assert.equal(a.criteria[1].status, 'fail');
  assert.equal(a.verdict, 'RED');
});

test('derby, finale, sans enjeu = rouge ; contexte inconnu = orange', () => {
  for (const c of ['derby', 'finale', 'maintien', 'montee', 'sans_enjeu'] as const) assert.equal(analyze(match({ context: c }), S).verdict, 'RED');
  assert.equal(analyze(match({ context: 'inconnu' }), S).verdict, 'ORANGE');
});

test('info manquante = orange (on vérifie)', () => {
  const a = analyze(match({ home: team({ played: null, over15: null }) }), S);
  assert.equal(a.criteria[0].status, 'unknown');
  assert.equal(a.criteria[2].status, 'unknown');
  assert.equal(a.verdict, 'ORANGE');
});

test('% de matchs à +1,5 manquant : estimé avec les buts, ou pris en %', () => {
  const est = analyze(match({ home: team({ over15: null }) }), S).criteria[2];
  assert.notEqual(est.status, 'unknown');
  assert.match(est.detail, /estimé/);
  const pctOnly = analyze(match({ home: team({ over15: null, over15Pct: 81 }) }), S).criteria[2];
  assert.match(pctOnly.detail, /81 %/);
});

test('temps restant : presque tout au début, rien à la fin', () => {
  assert.equal(remainingShare(0), 1);
  assert.ok(Math.abs(remainingShare(15) - 0.885) < 1e-9);
  assert.ok(remainingShare(90) < 1e-9);
});

test('les chances baissent avec le temps à 0-0', () => {
  const c0 = chanceOver15(2.8, 0);
  const c20 = chanceOver15(2.8, 20);
  const c60 = chanceOver15(2.8, 60);
  assert.ok(c0 > c20 && c20 > c60);
  assert.ok(chanceOver15(2.8, 30, 1) > chanceOver15(2.8, 30, 0));
});

test('cote minimum : au moins la règle de la méthode', () => {
  const r = minOddsAt(3, 18, S);
  assert.ok(r.min >= S.minLiveOdds);
  const weak = minOddsAt(1.6, 25, S);
  assert.ok(weak.min > S.minLiveOdds);
});

test('pari contraire : gain garanti identique dans les deux cas', () => {
  const p = hedgePlan(4, 1.8, 4);
  assert.equal(p.stake, 1.8);
  assert.equal(p.gain, 1.4);
  assert.ok(p.worth);
  assert.equal(hedgedPnl(4, 1.8, p.stake, 4, true), 1.4);
  assert.equal(hedgedPnl(4, 1.8, p.stake, 4, false), 1.4);
  assert.equal(hedgePlan(4, 1.8, 2).worth, false);
});
