import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, parseScore, poissonOver15, stepComplete } from '../src/lib/method';
import { DEFAULT_LEAGUES, DEFAULT_SETTINGS, newAnalysis, OTHER_LEAGUE } from '../src/lib/defaults';
import type { AnalysisInput } from '../src/lib/types';

const S = structuredClone(DEFAULT_SETTINGS);
const L = structuredClone(DEFAULT_LEAGUES);

function good(): AnalysisInput {
  const a = newAnalysis();
  return {
    ...a,
    leagueId: 'ligue1',
    leaguePct: 89,
    home: { name: 'PSG', played: 12, scored: 30, conceded: 12, form: ['V', 'V', 'N'] },
    away: { name: 'Lens', played: 12, scored: 20, conceded: 14, form: [] },
    homePct: 90,
    awayPct: 85,
    homeScorerOk: true,
    awayScorerOk: true,
    h2h: ['2-1', '3-0', '1-1', '2-2', '4-1'],
    odds: 1.35,
  };
}

test('parseScore accepte plusieurs formats', () => {
  assert.deepEqual(parseScore('2-1'), [2, 1]);
  assert.deepEqual(parseScore('3:0'), [3, 0]);
  assert.deepEqual(parseScore(' 1 – 1 '), [1, 1]);
  assert.equal(parseScore('2'), null);
  assert.equal(parseScore('a-b'), null);
});

test('un match idéal donne FEUX OUVERTS', () => {
  const e = evaluate(good(), L, S);
  assert.equal(e.verdict, 'GREEN');
  assert.ok(e.score >= 75, `score ${e.score}`);
  assert.equal(e.blockers.length, 0);
});

test('buteur clé absent = rouge forcé', () => {
  const e = evaluate({ ...good(), awayScorerOk: false }, L, S);
  assert.equal(e.verdict, 'RED');
  assert.ok(e.blockers.length >= 1);
});

test('ligue exotique hors méthode = rouge (par défaut)', () => {
  const e = evaluate({ ...good(), leagueId: OTHER_LEAGUE, otherLeagueName: 'Ligue exotique', leaguePct: 92 }, L, S);
  assert.equal(e.verdict, 'RED');
});

test('équipe qui n\'encaisse pas = bloquant', () => {
  const e = evaluate({ ...good(), home: { name: 'Mur', played: 12, scored: 20, conceded: 4, form: [] } }, L, S);
  assert.equal(e.verdict, 'RED');
});

test('confrontations aux petits scores : alerte', () => {
  const e = evaluate({ ...good(), h2h: ['0-0', '1-0', '0-1', '1-0', '2-1'] }, L, S);
  assert.ok(e.alerts.some((a) => a.includes('petits scores')));
  assert.notEqual(e.verdict, 'GREEN');
});

test('les étapes sont obligatoires', () => {
  const a = newAnalysis();
  assert.equal(stepComplete('league', a), false);
  assert.equal(stepComplete('injuries', a), false);
  assert.equal(stepComplete('h2h', { ...a, h2hNone: true }), true);
  assert.equal(stepComplete('h2h', { ...a, h2h: ['2-x', '', '', '', ''] }), false);
  const e = evaluate(a, L, S);
  assert.equal(e.verdict, 'RED');
});

test('pondérations modifiables : le score change', () => {
  const base = evaluate({ ...good(), odds: 1.6 }, L, S).score;
  const heavyOdds = evaluate({ ...good(), odds: 1.6 }, L, { ...S, weights: { ...S.weights, odds: 40 } }).score;
  assert.ok(heavyOdds < base);
});

test('poisson', () => {
  assert.ok(Math.abs(poissonOver15(2.7) - 0.7513) < 0.001);
});
