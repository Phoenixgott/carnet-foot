import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankroll, dashboard, fixedStake, nextBetIsTest, weekStatus } from '../src/lib/stats';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import type { Bet } from '../src/lib/types';

const S = { ...structuredClone(DEFAULT_SETTINGS), bankrollInitial: 100 };
let n = 0;
const bet = (p: Partial<Bet>): Bet => ({
  id: String(++n),
  createdAt: '2026-11-20T10:00:00Z',
  date: '2026-11-20',
  match: 'A – B',
  home: 'A',
  away: 'B',
  league: 'Ligue 1',
  odds: 1.35,
  stake: 2,
  kind: 'simple',
  live: false,
  test: false,
  verdict: 'GREEN',
  score: 80,
  result: 'won',
  settledAt: '2026-11-20T22:00:00Z',
  ...p,
});

test('bankroll, ROI et seuil de rentabilité', () => {
  const bets = [bet({}), bet({}), bet({ result: 'lost' }), bet({ test: true, result: 'lost' })];
  assert.equal(bankroll(bets, S, false), 100 + 0.7 + 0.7 - 2);
  const d = dashboard(bets, S, false);
  assert.equal(d.won, 2);
  assert.equal(d.lost, 1);
  assert.ok(Math.abs((d.hitRate ?? 0) - 2 / 3) < 1e-9);
  assert.ok(Math.abs((d.breakEven ?? 0) - 1 / 1.35) < 1e-9);
  assert.ok(d.roi! < 0);
  assert.equal(d.curve.length, 4);
});

test('mise fixe = % de la bankroll', () => {
  assert.equal(fixedStake([], S, false), 2);
});

test('mode TEST : 20 premiers paris fictifs', () => {
  const many = Array.from({ length: 20 }, () => bet({ test: true }));
  assert.equal(nextBetIsTest([], S), true);
  assert.equal(nextBetIsTest(many, S), false);
  assert.equal(nextBetIsTest([], { ...S, testMode: false }), false);
});

test('limite de pertes hebdomadaire', () => {
  const now = new Date('2026-11-26T12:00:00');
  const bets = [
    bet({ result: 'lost', stake: 6, settledAt: '2026-11-24T20:00:00' }),
    bet({ result: 'lost', stake: 5, settledAt: '2026-11-25T20:00:00' }),
  ];
  const w = weekStatus(bets, S, now);
  assert.equal(w.loss, 11);
  assert.equal(w.limit, 10);
  assert.equal(w.reached, true);
  const old = weekStatus([bet({ result: 'lost', stake: 50, settledAt: '2026-11-10T20:00:00' })], S, now);
  assert.equal(old.reached, false);
});
