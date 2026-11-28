import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choose, doublesCount, evaluateSystem, minOddsWithKGood, minSecondOdds } from '../src/lib/systeme';

test('6 matchs = 15 doubles', () => {
  assert.equal(doublesCount(6), 15);
  assert.equal(choose(4, 2), 6);
});

test('le tableau de la capture : cote du 1er match → cote minimum du 2e', () => {
  const expected: [number, number][] = [
    [2, 7.5],
    [2.5, 6],
    [3, 5],
    [3.5, 4.3],
    [4, 3.75],
    [5, 3],
  ];
  for (const [a, b] of expected) assert.equal(minSecondOdds(6, a), b, `1er match à ${a}`);
});

test('cotes proches : 3,90 avec 2 bons, 2,25 avec 3 bons, 1,60 avec 4 bons', () => {
  assert.equal(minOddsWithKGood(6, 2), 3.9);
  assert.equal(minOddsWithKGood(6, 3), 2.25);
  assert.equal(minOddsWithKGood(6, 4), 1.6);
});

test('le minimum ne dépend pas de la mise par double', () => {
  for (const s of [0.1, 0.2, 0.5, 1]) {
    const r = evaluateSystem([3.9, 3.9, 2, 2, 2, 2], [true, true, false, false, false, false], s);
    assert.equal(r.refunded, true);
    assert.equal(r.winningDoubles, 1);
  }
});

test('calcul complet d\'un système', () => {
  const r = evaluateSystem([2, 2, 2, 2, 2, 2], [true, true, true, false, false, false], 1);
  assert.equal(r.totalStake, 15);
  assert.equal(r.winningDoubles, 3);
  assert.equal(r.payout, 12);
  assert.equal(r.profit, -3);
  assert.equal(r.refunded, false);
});
