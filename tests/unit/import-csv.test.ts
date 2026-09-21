/**
 * Historiques football-data.co.uk : lecture des deux formats de fichiers,
 * matchs pas encore joués, doublons, résumé par championnat et saison.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonCanonique } from "../../src/data/contenu";
import { ErreurImport } from "../../src/data/import-carnet";
import { analyserCsv, comparerResultats, dateCsv, lireCsv, resumerResultats } from "../../src/data/import-csv";

/** Extrait fidèle d'un fichier E0.csv (colonnes réelles, cotes Bet365 et moyenne du marché). */
const E0 =
  "﻿Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee,B365>2.5,B365<2.5,Avg>2.5,Avg<2.5\r\n" +
  "E0,15/08/2025,20:00,Liverpool,Bournemouth,4,2,H,1,0,H,A Taylor,1.40,3.00,1.39,3.02\r\n" +
  "E0,16/08/2025,12:30,Aston Villa,Newcastle,0,0,D,0,0,D,S Hooper,1.80,2.00,1.82,1.99\r\n" +
  'E0,16/08/2025,15:00,Brighton,Fulham,1,1,D,0,1,A,"Smith, J",1.75,2.10,,\r\n' +
  "E0,16/08/25,15:00,Sunderland,West Ham,3,0,H,0,0,D,C Kavanagh,2.10,1.75,2.05,1.78\r\n" +
  "E0,16/08/2025,15:00,Sunderland,West Ham,3,0,H,0,0,D,C Kavanagh,2.10,1.75,2.05,1.78\r\n" +
  "E0,24/05/2026,16:00,Arsenal,Chelsea,,,,,,,,,,,\r\n" +
  "E0,31/13/2025,16:00,Everton,Leeds,1,0,H,0,0,D,X,2,2,2,2\r\n" +
  "E0,01/09/2025,16:00,Wolves,Burnley,x,1,A,0,0,D,X,2,2,2,2\r\n" +
  ",,,,,,,,,,,,,,,\r\n";

/** Format des « autres championnats » (ex. USA.csv). */
const USA =
  "Country,League,Season,Date,Time,Home,Away,HG,AG,Res,PSCH,PSCD,PSCA\n" +
  "USA,MLS,2025,22/02/2025,21:30,Inter Miami,New York City,2,2,D,1.5,4.5,6\n" +
  "USA,MLS,2025,23/02/2025,01:30,LA Galaxy,San Diego FC,0,2,A,1.6,4.2,5\n";

test("Lecture CSV : guillemets, BOM, fins de ligne Windows, point-virgule", () => {
  assert.deepEqual(lireCsv('a,b\r\n1,"x, ""y"""\r\n'), [["a", "b"], ["1", 'x, "y"']]);
  assert.deepEqual(lireCsv("﻿a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  assert.equal(dateCsv("16/08/25"), "2025-08-16");
  assert.equal(dateCsv("16/08/2025"), "2025-08-16");
  assert.equal(dateCsv("31/13/2025"), null);
  assert.equal(dateCsv("2025-08-16"), null);
});

test("Fichier des grands championnats : scores, mi-temps, cotes, pas joués, doublons, lignes écartées", () => {
  const a = analyserCsv(E0);
  assert.equal(a.resultats.length, 4);
  assert.equal(a.nbPasJoues, 1);
  assert.equal(a.nbDoublonsFichier, 1, "Sunderland – West Ham en double (date AA et AAAA)");
  assert.equal(a.ignorees.length, 2);
  assert.match(a.ignorees.join("\n"), /Ligne 8 \(Everton – Leeds\) : date « 31\/13\/2025 » illisible/);
  assert.match(a.ignorees.join("\n"), /Ligne 9 \(Wolves – Burnley\) : score « x-1 » illisible/);
  const liv = a.resultats.find((r) => r.domicile === "Liverpool")!;
  assert.deepEqual(liv, {
    id: "E0|2025-08-15|liverpool|bournemouth",
    division: "E0",
    championnat: "Premier League",
    saison: "2025-2026",
    date: "2025-08-15",
    heure: "20:00",
    domicile: "Liverpool",
    exterieur: "Bournemouth",
    butsDomicile: 4,
    butsExterieur: 2,
    butsMiTempsDomicile: 1,
    butsMiTempsExterieur: 0,
    cotes: { over25: 1.39, under25: 3.02, source: "moyenne du marché" },
  });
  // Cote moyenne absente : on prend la paire suivante (Bet365), jamais une cote inventée
  assert.deepEqual(a.resultats.find((r) => r.domicile === "Brighton")!.cotes, { over25: 1.75, under25: 2.1, source: "Bet365" });
});

test("Fichier des autres championnats (Home/Away/HG/AG)", () => {
  const a = analyserCsv(USA);
  assert.equal(a.resultats.length, 2);
  assert.equal(a.resultats[0].championnat, "MLS (USA)");
  assert.equal(a.resultats[0].division, "USA MLS");
  assert.equal(a.resultats[0].saison, "2024-2025", "février 2025 : saison 2024-2025 d'après la date");
  assert.equal(a.resultats[0].cotes, null);
  assert.equal(a.resultats[1].heure, "01:30");
});

test("Résumé par championnat et saison : moyenne de buts, parts à 2+ et 3+ buts", () => {
  const [g] = resumerResultats(analyserCsv(E0).resultats);
  // Buts : 6, 0, 2, 3 → moyenne 2,75 ; 2+ : 3/4 ; 3+ : 2/4
  assert.equal(g.championnat, "Premier League");
  assert.equal(g.saison, "2025-2026");
  assert.equal(g.nb, 4);
  assert.equal(g.moyenneButs, 2.75);
  assert.equal(g.partPlus15, 0.75);
  assert.equal(g.partPlus25, 0.5);
  assert.equal(g.du, "2025-08-15");
  assert.equal(g.au, "2025-08-16");
});

test("Doublons entre fichiers : nouveaux, identiques, corrigés", () => {
  const a = analyserCsv(E0);
  const existants = new Map(a.resultats.slice(0, 2).map((r) => [r.id, jsonCanonique(r)]));
  existants.set(a.resultats[1].id, jsonCanonique({ ...a.resultats[1], butsDomicile: 9 }));
  assert.deepEqual(comparerResultats(a.resultats, existants), { nouveaux: 2, modifies: 1, identiques: 1 });
});

test("Fichiers refusés avec un message clair", () => {
  const refuse = (t: string, fragment: RegExp) => assert.throws(() => analyserCsv(t), (e: unknown) => e instanceof ErreurImport && fragment.test((e as Error).message));
  refuse("", /vide ou illisible/);
  refuse("nom,prenom\nA,B", /football-data/);
  refuse("HomeTeam,AwayTeam\nA,B", /Date/);
  refuse("Date,HomeTeam,AwayTeam\n01/01/2025,A,B", /score/);
});
