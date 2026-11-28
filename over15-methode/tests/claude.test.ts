import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOutsidersPrompt, buildResultsPrompt, cleanJson, extractJson, parseOutsiders, parseResults } from '../src/lib/claude';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import type { Bet } from '../src/lib/types';

const reply = `\`\`\`json
{
  "date": "2026-11-27",
  "outsiders": [
    {
      "competition": "Saudi Pro League", "heure": "18:00",
      "domicile": "Al Feiha", "exterieur": "Al Hilal", "outsider": "Al Feiha", "pari": "Victoire de Al Feiha",
      "cote": "8,40", "bookmaker": "Winamax",
      "cotes_pinnacle": { "outsider": 7.0, "nul": 4.9, "favori": 1.42 },  (OddsPortal)
      "proba_estimee": 14,
      "raisons_pour": ["Al Hilal a joué mardi en Ligue des champions d'Asie"],
      "raisons_contre": ["Al Hilal a gagné les 5 derniers duels"],
      "xg": "Al Feiha crée beaucoup d'occasions à domicile",
      "absents_favori": ["Mitrović (blessé)"], "fatigue_favori": true,
      "motivation": "Al Feiha joue le maintien", "mouvement_cote": "baisse",
      "sources": ["https://exemple.fr"],
    }
  ]
}
\`\`\``;

test('lit les outsiders de Claude (références, virgules, nombres en texte, % estimé)', () => {
  const r = parseOutsiders(reply, '2026-01-01');
  assert.equal(r.date, '2026-11-27');
  const p = r.picks[0];
  assert.equal(p.team, 'Al Feiha');
  assert.equal(p.odds, 8.4);
  assert.deepEqual(p.pinnacle, { out: 7, draw: 4.9, fav: 1.42 });
  assert.equal(p.estimate, 0.14);
  assert.equal(p.signals.oddsMove, 'baisse');
  assert.equal(p.signals.fatigueFav, true);
  assert.equal(p.signals.absentsFav[0], 'Mitrović (blessé)');
});

test('lit les résultats renvoyés par Claude', () => {
  const r = parseResults('{ "resultats": [ { "id": "a1", "score": "2-1", "gagne": true }, { "id": "b2", "score": "", "gagne": null } ] } (Flashscore)');
  assert.deepEqual(r, [
    { id: 'a1', score: '2-1', won: true },
    { id: 'b2', score: '', won: null },
  ]);
});

test('réponse réelle copiée depuis l\'app Claude (références « (Wikipedia) » hors du JSON)', () => {
  const text = readFileSync(new URL('./fixtures/reponse-claude-citations.txt', import.meta.url), 'utf8');
  const j = extractJson(text);
  assert.equal(j.matchs.length, 3);
  assert.equal(j.matchs[0].domicile.nom, 'Heart of Midlothian (Hearts)');
});

test('le nettoyage ne touche pas au texte entre guillemets', () => {
  assert.equal(cleanJson('{"a": "x (y) // z", "b": [1, 2,],} (Source)'), '{"a": "x (y) // z", "b": [1, 2]} ');
});

test('messages clairs si la réponse est vide ou abîmée', () => {
  assert.throws(() => parseOutsiders('bonjour', '2026-01-01'), /copié la réponse/);
  assert.throws(() => parseOutsiders('{"outsiders": [ {"domicile": ', '2026-01-01'), /coupée|copié/);
});

test('les demandes contiennent ce qu\'il faut', () => {
  const p = buildOutsidersPrompt('2026-11-27', DEFAULT_SETTINGS);
  assert.match(p, /2026-11-27/);
  assert.match(p, /cote_pinnacle/);
  assert.match(p, /ecart_zone_rouge/);
  const bet = { id: 'zz9', match: 'Lens – Lille', date: '2026-11-27', league: 'Ligue 1', pick: 'Victoire de Lens' } as Bet;
  assert.match(buildResultsPrompt([bet]), /id "zz9" : Lens – Lille/);
});
