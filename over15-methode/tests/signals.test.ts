import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOutsiders } from '../src/lib/claude';
import { computeSignals, countSignals, formPoints } from '../src/lib/signals';

const detailed = `\`\`\`json
{
  "date": "2026-11-28",
  "matchs": [
    {
      "competition": "Ligue 1", "heure": "21:00", "domicile": "Lens", "exterieur": "Angers",
      "pari": "Victoire de Angers", "bookmaker": "Winamax", "cote_nul": 4.20, "pinnacle_nul": 4.35,
      "outsider": {
        "nom": "Angers", "cote": 6.20, "cote_pinnacle": 5.60, "classement": 16, "points": 13, "matchs": 13,
        "ecart_zone_rouge": 1, "objectif": "maintien", "forme": "VVNDV",
        "lieu": { "joues": 6, "v": 2, "n": 2, "d": 2, "bp": 7, "bc": 8 },
        "buts_marques": 17, "buts_encaisses": 19, "xg_pour": 1.45, "xg_contre": 1.30,
        "buteurs": [ { "nom": "Sidibé", "buts": 6, "disponible": true } ],
        "absents": [], "jours_repos": 7, "coupe_europe_semaine": false,
        "entraineur": "Dujeux", "nouvel_entraineur": true, "elo": 1600
      },
      "favori": {
        "nom": "Lens", "cote": 1.55, "cote_pinnacle": 1.62, "classement": 4, "points": 25, "matchs": 13,
        "objectif": "europe", "forme": "DNVDN",
        "lieu": { "joues": 7, "v": 2, "n": 3, "d": 2, "bp": 9, "bc": 8 },
        "buts_marques": 20, "buts_encaisses": 16, "xg_pour": 1.6, "xg_contre": 1.0,
        "buteurs": [ { "nom": "Wahi", "buts": 7, "disponible": false } ],
        "absents": [ { "nom": "Wahi", "raison": "blessé", "titulaire": true }, { "nom": "Samba", "raison": "suspendu", "titulaire": true } ],
        "jours_repos": 3, "coupe_europe_semaine": true, "entraineur": "Still", "nouvel_entraineur": false, "elo": 1720
      },
      "enjeu": "Angers lutte pour le maintien, Lens vise l'Europe",
      "lien": "rivalité régionale",
      "confrontations": ["2025-04 Angers 1-1 Lens"],
      "mouvement_cote": "baisse", "mouvement_detail": "6,80 → 6,20",
      "meteo": "pluie", "arbitre": "", "infos_en_plus": ["Long déplacement pour Lens après l'Europe"],
      "proba_estimee": 18, "raisons_pour": ["Lens fatigué"], "raisons_contre": ["Lens solide à domicile"],
      "sources": ["https://exemple.fr"]
    }
  ]
}
\`\`\``;

test('lit la fiche détaillée (outsider, favori, contexte)', () => {
  const { picks } = parseOutsiders(detailed, '2026-01-01');
  const p = picks[0];
  assert.equal(p.team, 'Angers');
  assert.equal(p.odds, 6.2);
  assert.deepEqual(p.pinnacle, { out: 5.6, draw: 4.35, fav: 1.62 });
  assert.equal(p.out?.venue?.l, 2);
  assert.equal(p.out?.form, 'VVNDV');
  assert.equal(p.fav?.absents.length, 2);
  assert.equal(p.signals.fatigueFav, true);
  assert.equal(p.ctx?.drawOdds, 4.2);
  assert.equal(p.estimate, 0.18);
});

test('les signaux : chiffres rangés en 👍 et 👎', () => {
  const { picks } = parseOutsiders(detailed, '2026-01-01');
  const sig = computeSignals(picks[0]);
  const c = countSignals(sig);
  const txt = sig.map((s) => `${s.side}:${s.text}`).join('\n');
  assert.match(txt, /pour:Forme : Angers 10 pts/);
  assert.match(txt, /pour:Meilleur buteur de Lens absent : Wahi/);
  assert.match(txt, /pour:Angers joue sa survie \(\+1 pt/);
  assert.match(txt, /pour:Lens a joué la Coupe d'Europe/);
  assert.match(txt, /pour:Nouvel entraîneur chez Angers/);
  assert.match(txt, /pour:La cote de l'outsider baisse \(6,80 → 6,20\)/);
  assert.ok(c.pour >= 8, `pour = ${c.pour}`);
});

test('points de forme', () => {
  assert.equal(formPoints('VVNDV'), 10);
  assert.equal(formPoints(''), null);
});
