import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choose, doublesCount, evaluateSystem, minOddsWithKGood, minSecondOdds, refundZones, requiredGood } from '../src/lib/systeme';

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

test('2e tableau : les 3 zones pour 6 matchs, et les chances', () => {
  const z = refundZones(6);
  assert.deepEqual(
    z.best.map((b) => [b.from, b.to, b.good]),
    [
      [1.6, 1.7, 4],
      [2.25, 2.4, 3],
      [3.9, 4.2, 2],
    ],
  );
  const pct = z.best.map((b) => Math.round(b.chance * 100));
  assert.ok(Math.abs(pct[0] - 50) <= 2, `zone 1 : ${pct[0]} %`);
  assert.ok(Math.abs(pct[1] - 48) <= 2, `zone 2 : ${pct[1]} %`);
  assert.ok(Math.abs(pct[2] - 44) <= 2, `zone 3 : ${pct[2]} %`);
});

test('2e tableau : zones à éviter (1,80 à 2,10 puis 2,50 à 3,75)', () => {
  const z = refundZones(6);
  assert.deepEqual(z.avoid.map((a) => [a.from, a.to, a.good]), [
    [1.8, 2.1, 4],
    [2.5, 3.75, 3],
  ]);
  assert.ok(z.avoid[0].chanceFrom < 0.42 && z.avoid[0].chanceTo > 0.24);
  assert.equal(requiredGood(6, 2.0), 4);
  assert.equal(requiredGood(6, 2.3), 3);
});
