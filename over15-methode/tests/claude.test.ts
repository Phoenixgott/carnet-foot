import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDayPrompt, buildMatchPrompt, parseClaude, toContext } from '../src/lib/claude';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

const reply = `Voici les matchs :
\`\`\`json
{
  "date": "2026-11-26",
  "matchs": [
    {
      "competition": "Ligue des champions",
      "heure": "21:00",
      "domicile": { "nom": "PSG", "matchs": "20", "marques": 45, "encaisses": 20, "matchs_plus_1_5": 17,
        "buteurs": [{ "nom": "Dembélé", "buts": 14, "disponible": true }, { "nom": "Barcola", "buts": 9, "disponible": "incertain" }],
        "absents_attaque": [] },
      "exterieur": { "nom": "Bayern", "matchs": 19, "marques": 50, "encaisses": 19, "matchs_plus_1_5": 17, "buteurs": [], "absents_attaque": ["Musiala"], },
      "confrontations": ["2-1", "0-1", "3-2"],
      "contexte": "Normal",
      "cote_avant_match": "1,18",
      "sources": ["https://exemple.fr"]
    }
  ]
}
\`\`\``;

test('lit une réponse de Claude (bloc json, virgules en trop, nombres en texte)', () => {
  const r = parseClaude(reply, '2026-01-01');
  assert.equal(r.date, '2026-11-26');
  assert.equal(r.matches.length, 1);
  const m = r.matches[0];
  assert.equal(m.home.name, 'PSG');
  assert.equal(m.home.played, 20);
  assert.equal(m.home.scorers[1].available, null);
  assert.equal(m.away.absents[0], 'Musiala');
  assert.equal(m.context, 'normal');
  assert.equal(m.preOdds, 1.18);
});

test('message clair si la réponse est vide ou abîmée', () => {
  assert.throws(() => parseClaude('bonjour', '2026-01-01'), /copié la réponse/);
  assert.throws(() => parseClaude('{"matchs": [ {"domicile": ', '2026-01-01'), /coupée|copié/);
});

test('contexte reconnu en toutes lettres', () => {
  assert.equal(toContext('Derby du Nord'), 'derby');
  assert.equal(toContext('lutte pour le maintien'), 'maintien');
  assert.equal(toContext('Montée'), 'montee');
  assert.equal(toContext('sans enjeu'), 'sans_enjeu');
  assert.equal(toContext(''), 'inconnu');
});

test('les demandes contiennent la date et le format', () => {
  const p = buildDayPrompt('2026-11-26', DEFAULT_SETTINGS);
  assert.match(p, /2026-11-26/);
  assert.match(p, /matchs_plus_1_5/);
  assert.match(buildMatchPrompt('Lens', 'Lille', '2026-11-26'), /Lens contre Lille/);
});
