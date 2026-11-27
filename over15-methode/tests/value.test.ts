import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeValue, impliedProb, oddsBand, pickValue, pinnacleProb } from '../src/lib/value';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import type { Outsider } from '../src/lib/types';

const S = structuredClone(DEFAULT_SETTINGS);

test('1 ÷ cote : Al Feiha à 8,40 = 11,9 %', () => {
  assert.equal(Math.round(impliedProb(8.4) * 1000) / 10, 11.9);
});

test('exemple du message : 17 % estimé = value, 8 % = piège', () => {
  assert.equal(computeValue(8.4, 0.17, 'perso', S).verdict, 'OK');
  assert.equal(computeValue(8.4, 0.08, 'perso', S).verdict, 'NON');
  assert.equal(computeValue(8.4, 0.121, 'perso', S).verdict, 'BOF');
});

test('Pinnacle : 3 cotes → marge retirée exactement', () => {
  const r = pinnacleProb({ out: 7, draw: 4.9, fav: 1.42 }, 0.03)!;
  const sum = 1 / 7 + 1 / 4.9 + 1 / 1.42;
  assert.equal(r.source, 'pinnacle');
  assert.ok(Math.abs(r.p - 1 / 7 / sum) < 1e-12);
});

test('Pinnacle : une seule cote → marge par défaut', () => {
  const r = pinnacleProb({ out: 7, draw: null, fav: null }, 0.03)!;
  assert.equal(r.source, 'pinnacle1');
  assert.ok(Math.abs(r.p - 1 / 7 / 1.03) < 1e-12);
});

test('Winamax 8,40 contre Pinnacle 7,00 = bonne affaire, cote minimum cohérente', () => {
  const r = computeValue(8.4, 1 / 7 / 1.03, 'pinnacle1', S, 'Al Feiha');
  assert.equal(r.verdict, 'OK');
  assert.ok(r.value > 0.15 && r.value < 0.18);
  assert.ok(r.minOdds > 7 && r.minOdds < 8.4);
  assert.match(r.sentence, /bonne affaire/);
});

test('outsider : Pinnacle d\'abord, sinon estimation de Claude, sinon rien', () => {
  const base: Outsider = {
    id: 'x', date: '2026-11-27', time: '', competition: 'L', home: 'A', away: 'B', team: 'A', bet: 'Victoire de A',
    odds: 5, bookmaker: 'Winamax', pinnacle: { out: null, draw: null, fav: null }, estimate: null,
    reasonsFor: [], reasonsAgainst: [], signals: { xg: '', absentsFav: [], fatigueFav: null, motivation: '', oddsMove: 'inconnu' }, sources: [], importedAt: '',
  };
  assert.equal(pickValue(base, S), null);
  assert.equal(pickValue({ ...base, estimate: 0.25 }, S)!.source, 'claude');
  assert.equal(pickValue({ ...base, estimate: 0.25, pinnacle: { out: 4.5, draw: 3.8, fav: 1.8 } }, S)!.source, 'pinnacle');
});

test('tranches de cote du bilan', () => {
  assert.equal(oddsBand(1.8), 'Moins de 3');
  assert.equal(oddsBand(4), '3 à 5');
  assert.equal(oddsBand(5), '5 à 8');
  assert.equal(oddsBand(8.4), 'Plus de 8');
});
