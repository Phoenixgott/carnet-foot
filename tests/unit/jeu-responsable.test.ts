/**
 * Jeu responsable (rappels, pause/auto-exclusion), bilan hebdomadaire, recherche globale.
 * Cas calculés à la main.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  completerReglagesJeuResponsable,
  demarrerPause,
  dureeLisible,
  pauseActive,
  rappelPause,
  REGLAGES_JEU_RESPONSABLE_DEFAUT,
  secondesRestantes,
  type ReglagesJeuResponsable,
} from "../../src/core/jeu-responsable";
import { bilanHebdomadaire, debutSemaine, finSemaine } from "../../src/core/bilan-hebdo";
import { normaliser, rechercher } from "../../src/core/recherche";
import type { Match, Pari } from "../../src/core/types";

let n = 0;
const pari = (extra: Partial<Pari>): Pari => ({
  id: "p" + ++n,
  ordre: n,
  date: "2026-09-01",
  match: "A – B",
  methode: "+2.5",
  cote: 2,
  mise: 10,
  statut: "gagne",
  creeLe: "",
  modifieLe: "",
  ...extra,
});

test("Rappel de pause : après N défaites d'affilée, ou plafond du jour dépassé ; jamais les deux à la fois ici", () => {
  const paris = [
    pari({ ordre: 0, date: "2026-09-01", statut: "gagne", cote: 2, mise: 10 }),
    pari({ ordre: 1, date: "2026-09-02", statut: "perdu", mise: 10 }),
    pari({ ordre: 2, date: "2026-09-03", statut: "perdu", mise: 10 }),
    pari({ ordre: 3, date: "2026-09-04", statut: "perdu", mise: 10 }),
  ];
  const parDefaites: ReglagesJeuResponsable = { ...REGLAGES_JEU_RESPONSABLE_DEFAUT, rappelApresDefaites: 3 };
  const r1 = rappelPause(paris, parDefaites, "2026-09-05");
  assert.equal(r1?.raison, "defaites");
  assert.equal(rappelPause(paris, { ...REGLAGES_JEU_RESPONSABLE_DEFAUT, rappelApresDefaites: 4 }, "2026-09-05"), null, "seulement 3 défaites, pas 4");

  const parPlafond: ReglagesJeuResponsable = { ...REGLAGES_JEU_RESPONSABLE_DEFAUT, rappelApresPlafondJour: 15 };
  const r2 = rappelPause(paris, parPlafond, "2026-09-01"); // 10 misés le 1er, sous le plafond de 15
  assert.equal(r2, null);
  const r3 = rappelPause([...paris, pari({ ordre: 4, date: "2026-09-01", statut: "attente", mise: 10 })], parPlafond, "2026-09-01"); // 20 misés
  assert.equal(r3?.raison, "plafond-jour");

  assert.equal(rappelPause(paris, REGLAGES_JEU_RESPONSABLE_DEFAUT, "2026-09-05"), null, "aucun réglage activé");
});

test("Pause (auto-exclusion) : active tant que la fin n'est pas passée, durée lisible", () => {
  const debut = new Date("2026-09-01T10:00:00Z");
  const p = demarrerPause(24, debut, "3 défaites d'affilée.");
  assert.equal(p.raison, "3 défaites d'affilée.");
  assert.equal(pauseActive(p, new Date("2026-09-01T20:00:00Z")), true); // 10 h plus tard : encore active
  assert.equal(pauseActive(p, new Date("2026-09-02T11:00:00Z")), false); // 25 h plus tard : terminée
  assert.equal(pauseActive(null, debut), false);
  assert.equal(secondesRestantes(p, new Date("2026-09-01T22:00:00Z")), 12 * 3600); // 12 h restantes
  assert.equal(secondesRestantes(p, new Date("2026-09-05T00:00:00Z")), 0);
  assert.equal(dureeLisible(3 * 3600 + 12 * 60), "3 h 12 min");
  assert.equal(dureeLisible(3 * 3600), "3 h");
  assert.equal(dureeLisible(45 * 60), "45 min");
  assert.equal(dureeLisible(20), "1 min", "jamais 0 min affiché");
});

test("Réglages de jeu responsable : valeurs manquantes ou fausses remplacées par le défaut", () => {
  assert.deepEqual(completerReglagesJeuResponsable(undefined), REGLAGES_JEU_RESPONSABLE_DEFAUT);
  assert.deepEqual(completerReglagesJeuResponsable({ rappelApresDefaites: 5, rappelApresPlafondJour: 100, dureePauseHeures: 48 }), {
    rappelApresDefaites: 5,
    rappelApresPlafondJour: 100,
    dureePauseHeures: 48,
  });
  assert.equal(completerReglagesJeuResponsable({ rappelApresDefaites: 0 }).rappelApresDefaites, null);
  assert.equal(completerReglagesJeuResponsable({ rappelApresDefaites: 2.7 }).rappelApresDefaites, 3, "arrondi");
  assert.equal(completerReglagesJeuResponsable({ rappelApresPlafondJour: -10 }).rappelApresPlafondJour, null);
  assert.equal(completerReglagesJeuResponsable({ dureePauseHeures: -1 }).dureePauseHeures, REGLAGES_JEU_RESPONSABLE_DEFAUT.dureePauseHeures);
});

test("Bilan hebdomadaire : lundi à dimanche, comparé à la semaine précédente, meilleure/pire méthode", () => {
  assert.equal(debutSemaine("2026-09-21"), "2026-09-21", "un lundi"); // 21/09/2026 est un lundi
  assert.equal(finSemaine("2026-09-21"), "2026-09-27");
  assert.equal(debutSemaine("2026-09-23"), "2026-09-21", "un mercredi retombe sur le lundi de sa semaine");
  assert.equal(debutSemaine("2026-09-27"), "2026-09-21", "un dimanche retombe sur le lundi de sa semaine");

  const paris = [
    pari({ ordre: 0, date: "2026-09-22", methode: "+1.5", statut: "gagne", cote: 1.8, mise: 10 }), // +8
    pari({ ordre: 1, date: "2026-09-23", methode: "+2.5", statut: "perdu", mise: 10 }), // -10
    pari({ ordre: 2, date: "2026-09-14", methode: "+2.5", statut: "gagne", cote: 2, mise: 50 }), // semaine précédente : +50
    pari({ ordre: 3, date: "2026-09-30", methode: "+2.5", statut: "gagne", cote: 2, mise: 10 }), // semaine suivante : hors bilan
  ];
  const b = bilanHebdomadaire(paris, "2026-09-24");
  assert.deepEqual([b.cetteSemaine.debut, b.cetteSemaine.fin], ["2026-09-21", "2026-09-27"]);
  assert.equal(b.cetteSemaine.nb, 2);
  assert.equal(b.cetteSemaine.gains, -2); // 8 - 10
  assert.equal(b.cetteSemaine.meilleureMethode?.methode, "+1.5");
  assert.equal(b.cetteSemaine.pireMethode?.methode, "+2.5");
  assert.deepEqual([b.semainePrecedente.debut, b.semainePrecedente.fin], ["2026-09-14", "2026-09-20"]);
  assert.equal(b.semainePrecedente.gains, 50);
  assert.equal(b.semainePrecedente.pireMethode, null, "une seule méthode : pas de \"pire\" à opposer");
});

test("Recherche : match et pari, insensible aux accents et à la casse", () => {
  assert.equal(normaliser("Général"), "general");
  const matchs: Match[] = [{ id: "m1", ligue: "Ligue 1", domicile: { nom: "Lens" }, exterieur: { nom: "Brest" } }];
  const paris = [pari({ id: "p1", match: "PSG – Marseille", notes: "value sur le classico" })];
  assert.deepEqual(rechercher("l", matchs, paris), [], "requête d'un seul caractère : ignorée");
  assert.equal(rechercher("brest", matchs, paris)[0]?.type, "match");
  assert.equal(rechercher("MARSEILLE", matchs, paris)[0]?.id, "p1");
  assert.equal(rechercher("classico", matchs, paris)[0]?.type, "pari", "trouvé aussi dans les notes");
  assert.deepEqual(rechercher("zzz", matchs, paris), []);
});
