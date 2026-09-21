/**
 * Nouveau modèle (phase 3) : cas calculés à la main, effets attendus de chaque étape,
 * critères réglables, classement par intérêt, fiches équipe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lambdaRestant, pPlusDe } from "../../src/core/poisson";
import { evaluerPlus15, evaluerPlus25, SEUILS_CARNET } from "../../src/core/carnet-v1/criteres";
import { analyserV2 } from "../../src/core/modele-v2/analyse";
import { statsChampionnat, type StatsChampionnat } from "../../src/core/modele-v2/championnat";
import { cleEquipe, ficheEquipe, seriesEnCours, trouverEquipe } from "../../src/core/modele-v2/equipe";
import { interet } from "../../src/core/modele-v2/interet";
import { estimer } from "../../src/core/modele-v2/modele";
import { completerReglages, REGLAGES_ANALYSE_DEFAUT } from "../../src/core/modele-v2/reglages";
import { lambdaRestantA00, partJouee, repartition } from "../../src/core/modele-v2/temps";
import type { Equipe, Match, Resultat } from "../../src/core/types";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const eq = (nom: string, joues: number, marques: number, encaisses: number, extra: Partial<Equipe> = {}): Equipe => ({
  nom,
  joues,
  marques,
  encaisses,
  ...extra,
});
const match = (extra: Partial<Match> = {}): Match => ({
  id: "m",
  date: "2026-09-22",
  ligue: "Ligue 1",
  moyenneButsLigue: 2.8,
  domicile: eq("Lens", 10, 14, 14),
  exterieur: eq("Brest", 10, 14, 14),
  ...extra,
});
const sansStats = { stats: null, poidsAbsents: 1 };

test("Deux équipes dans la moyenne, terrain neutre : λ = moyenne de la compétition", () => {
  const e = estimer(match({ contexte: "finale" }), sansStats);
  assert.ok(e.ok);
  proche(e.lambdaDomicile, 1.4);
  proche(e.lambdaExterieur, 1.4);
  proche(e.lambda, 2.8);
  assert.equal(e.avantage.source, "neutre");
});

test("Avantage du terrain : 1,25 par défaut, partagé en √1,25 et 1/√1,25 ; valeur des historiques sinon", () => {
  const e = estimer(match(), sansStats);
  proche(e.lambdaDomicile, 1.4 * Math.sqrt(1.25));
  proche(e.lambdaExterieur, 1.4 / Math.sqrt(1.25));
  const stats: StatsChampionnat = { championnat: "Ligue 1", saisons: "2025-2026", nb: 306, moyenneButs: 2.9, butsDomicile: 1.68, butsExterieur: 1.22, avantageTerrain: 1.44, partPremiereMiTemps: 0.44 };
  const f = estimer(match(), { stats, poidsAbsents: 1 });
  proche(f.lambdaDomicile, 1.4 * 1.2);
  proche(f.lambdaExterieur, 1.4 / 1.2);
  assert.equal(f.avantage.source, "historiques");
});

test("Moyennes ramenées vers la compétition : 4 matchs fictifs dans la moyenne", () => {
  // 2 matchs, 8 buts : (2 × 4 + 4 × 1,4) / 6 = 2,2667 buts par match, attaque 1,619
  const e = estimer(match({ contexte: "finale", domicile: eq("Lens", 2, 8, 2.8) }), sansStats);
  const attaque = (2 * 4 + 4 * 1.4) / 6 / 1.4;
  proche(e.lambdaDomicile, 1.4 * attaque * 1);
  // Plus de matchs joués : estimation plus sûre (écart type plus petit)
  const peu = estimer(match({ domicile: eq("Lens", 3, 4, 4), exterieur: eq("Brest", 3, 4, 4) }), sansStats);
  const beaucoup = estimer(match({ domicile: eq("Lens", 30, 42, 42), exterieur: eq("Brest", 30, 42, 42) }), sansStats);
  assert.ok(peu.sigma > beaucoup.sigma);
  assert.ok(beaucoup.sigma >= 0.08 * beaucoup.lambda, "8 % d'erreur de modèle au minimum");
});

test("Absents : effet proportionnel au poids choisi, nul si ignorés", () => {
  const base = estimer(match(), sansStats).lambda;
  const m = match({ meilleurButeurAbsent: true, absenceOffensive: true, defenseAffaiblie: true });
  proche(estimer(m, { stats: null, poidsAbsents: 0 }).lambda, base);
  proche(estimer(m, { stats: null, poidsAbsents: 1 }).lambda, base * 0.94 * 0.92 * 1.05);
  proche(estimer(m, { stats: null, poidsAbsents: 2 }).lambda, base * 0.88 * 0.84 * 1.1);
});

test("Forme récente : effet limité à ±15 %", () => {
  const chaud = estimer(match({ domicile: eq("Lens", 10, 14, 14, { derniersButsMarques: [4, 3, 4, 3] }) }), sansStats);
  const froid = estimer(match({ domicile: eq("Lens", 10, 14, 14, { derniersButsMarques: [0, 0, 0, 0] }) }), sansStats);
  proche(chaud.formeDomicile, 1.15);
  proche(froid.formeDomicile, 0.85);
  assert.equal(estimer(match({ domicile: eq("Lens", 10, 14, 14, { derniersButsMarques: [3, 3] }) }), sansStats).formeDomicile, 1, "moins de 3 matchs : pas d'effet");
});

test("Moyenne de la compétition inconnue : historiques, sinon les deux équipes (signalé)", () => {
  const stats = { championnat: "Ligue 1", saisons: "2025-2026", nb: 306, moyenneButs: 3, butsDomicile: 1.6, butsExterieur: 1.4, avantageTerrain: 1.6 / 1.4, partPremiereMiTemps: null };
  assert.equal(estimer(match({ moyenneButsLigue: null }), { stats, poidsAbsents: 1 }).sourceMoyenne, "historiques");
  const e = estimer(match({ moyenneButsLigue: null }), sansStats);
  assert.equal(e.sourceMoyenne, "equipes");
  assert.match(e.details[0], /moins sûre/);
  assert.equal(estimer(match({ domicile: eq("Lens", 0, 0, 0) }), sansStats).ok, false);
});

test("Répartition des buts dans le temps", () => {
  assert.equal(partJouee(0), 0);
  proche(partJouee(15), 0.135);
  proche(partJouee(22.5), 0.135 + 0.075);
  proche(partJouee(45), 0.455);
  proche(partJouee(90), 1);
  const r = repartition(0.44);
  proche(r.reduce((s, x) => s + x, 0), 1);
  proche(r.slice(0, 3).reduce((s, x) => s + x, 0), 0.44);
  assert.deepEqual(repartition(null), repartition(undefined));
  // À 0-0 à la 20ᵉ : part restante 0,815, et le 0-0 fait légèrement baisser λ (écart type 0,56 : k = 25)
  const attendu = ((2.8 * 25) / (25 + 2.8 * 0.185)) * 0.815;
  proche(lambdaRestantA00(2.8, 0.56, 20), attendu);
  // Sans incertitude, seul le temps compte
  proche(lambdaRestantA00(2.8, 0, 20), 2.8 * 0.815);
  // Comparaison honnête avec le carnet (uniforme + 3 min) : très proche à la 20ᵉ minute
  assert.ok(Math.abs(lambdaRestantA00(2.8, 0.56, 20) - lambdaRestant(2.8, 20)) < 0.05);
});

/** Match qui remplit les critères +2.5 du carnet. */
const bonMatch25 = (cotes?: Match["cotes"]): Match =>
  match({
    moyenneButsLigue: 2.85,
    domicile: eq("Lens", 10, 16, 14, { derniersButsMarques: [2, 1, 2, 2], pctOver15: 80, pctOver25: 60 }),
    exterieur: eq("Brest", 10, 15, 16, { derniersButsMarques: [1, 2, 2, 1], pctOver15: 80, pctOver25: 60 }),
    h2h: { joues: 6, over25: 5 },
    absents: [],
    contexte: "normal",
    cotes,
  });
const ctx = { stats: null, reglages: REGLAGES_ANALYSE_DEFAUT };

test("+2.5 : modèle mélangé 70/30 avec les % réels, fourchette, cote juste et cote minimale", () => {
  const m = bonMatch25();
  const a = analyserV2(m, "+2.5", ctx);
  const e = estimer(m, sansStats);
  proche(a.p, 0.7 * pPlusDe(e.lambda, 2.5) + 0.3 * 0.6);
  assert.ok(a.pBas < a.p && a.p < a.pHaut);
  proche(a.coteJuste, 1 / a.p);
  proche(a.coteMinimale, 1 / a.pBas);
  assert.ok(a.coteMinimale > a.coteJuste);
  assert.equal(a.ev.v, "ok");
  assert.match(a.why, /^Oui : vérifie les compositions 1 h avant et prends une cote d'au moins \d,\d\d\.$/);
  assert.ok(a.niveauRisque >= 1 && a.niveauRisque <= 5);
});

test("+2.5 : la cote décide — sous la cote juste « On passe », entre juste et mini « À revoir », au-dessus « On joue »", () => {
  const a = analyserV2(bonMatch25(), "+2.5", ctx);
  const avec = (cote: number) => analyserV2(bonMatch25({ over25: cote, under25: 1.9 }), "+2.5", ctx);
  const basse = avec(Math.floor(a.coteJuste * 100 - 2) / 100);
  assert.equal(basse.v, "ko");
  assert.match(basse.why, /^Non : la cote .* est sous la cote juste/);
  assert.ok(basse.value < 0);
  const milieu = avec(Math.round(((a.coteJuste + a.coteMinimale) / 2) * 100) / 100);
  assert.equal(milieu.v, "mid");
  assert.match(milieu.why, /marge d'erreur/);
  const haute = avec(Math.ceil(a.coteMinimale * 100 + 5) / 100);
  assert.equal(haute.v, "ok");
  assert.match(haute.why, /value de \+\d+ %/);
  proche(haute.value, haute.cote! * haute.p - 1);
  assert.ok(Number.isFinite(haute.pBookmaker));
});

test("+1.5 : chances à 0-0 à la 20ᵉ avec la vraie répartition ; value jugée en live", () => {
  const m = bonMatch25();
  const a = analyserV2(m, "+1.5", ctx);
  const e = estimer(m, sansStats);
  proche(a.p, pPlusDe(lambdaRestantA00(e.lambda, e.sigma, 20), 1.5));
  assert.equal(a.cote, null);
  assert.ok(Number.isNaN(a.value));
  if (a.v === "ok") assert.match(a.why, /entre en live à \d,\d\d ou plus/);
});

test("Données trop incomplètes : jamais « On joue »", () => {
  const a = analyserV2({ id: "x", domicile: { nom: "A" }, exterieur: { nom: "B" } }, "+2.5", ctx);
  assert.notEqual(a.v, "ok");
  assert.ok(Number.isNaN(a.p));
});

test("Critères réglables : les seuils changent le verdict ; ceux du carnet par défaut", () => {
  const m = bonMatch25();
  assert.deepEqual(evaluerPlus15(m), evaluerPlus15(m, SEUILS_CARNET.plus15));
  assert.equal(evaluerPlus15(m).c[1].ok, true);
  const exigeant = evaluerPlus15(m, { ...SEUILS_CARNET.plus15, pctPlus15: 90 });
  assert.equal(exigeant.v, "ko");
  assert.match(exigeant.c[1].d!, /Minimum : 90 %/);
  const derby = evaluerPlus15({ ...m, contexte: "derby" }, { ...SEUILS_CARNET.plus15, contextesAcceptes: ["normal", "derby"] });
  assert.equal(derby.c[3].ok, true);
  assert.equal(evaluerPlus25(m).v, "ok");
  assert.equal(evaluerPlus25(m, { ...SEUILS_CARNET.plus25, moyenneCompetition: 3 }).c[0].ok, false);
  // 4 signaux favorables : « À revoir » s'il en faut 5, « On passe » s'il en faut 6 (règle du carnet : seuil − 1)
  assert.equal(evaluerPlus25(m, { ...SEUILS_CARNET.plus25, scoreOk: 5 }).v, "mid");
  assert.equal(evaluerPlus25(m, { ...SEUILS_CARNET.plus25, scoreOk: 6 }).v, "ko");
  // Réglages complétés : valeurs manquantes ou fausses → carnet
  assert.deepEqual(completerReglages(undefined), REGLAGES_ANALYSE_DEFAUT);
  assert.deepEqual(completerReglages({ poidsAbsents: 9, seuils: { plus25: { scoreOk: 3 } } }).poidsAbsents, 2);
  assert.equal(completerReglages({ seuils: { plus25: { scoreOk: 3 } } }).seuils.plus25.scoreOk, 3);
  assert.equal(completerReglages({ seuils: { plus25: { scoreOk: "x" } } }).seuils.plus25.scoreOk, 4);
});

test("Classement par intérêt : On joue avec value > On joue > À revoir > On passe", () => {
  const a = analyserV2(bonMatch25(), "+2.5", ctx);
  const value = analyserV2(bonMatch25({ over25: Math.ceil(a.coteMinimale * 100 + 10) / 100 }), "+2.5", ctx);
  const sansCote = a;
  const ko = analyserV2(bonMatch25({ over25: 1.1 }), "+2.5", ctx);
  const notes = [value, sansCote, ko].map((x) => interet([x]).note);
  assert.ok(notes[0] > notes[1] && notes[1] > notes[2], String(notes));
  assert.match(interet([value]).raison, /^\+2\.5 : On joue, value \+\d+ %, \d+ % de chances$/);
});

const res = (date: string, dom: string, ext: string, bd: number, be: number, mt: [number, number] | null = null, championnat = "Ligue 1"): Resultat => ({
  id: `${date}|${dom}|${ext}`,
  division: "F1",
  championnat,
  saison: "2025-2026",
  date,
  heure: null,
  domicile: dom,
  exterieur: ext,
  butsDomicile: bd,
  butsExterieur: be,
  butsMiTempsDomicile: mt ? mt[0] : null,
  butsMiTempsExterieur: mt ? mt[1] : null,
  cotes: null,
});

test("Chiffres d'un championnat depuis les historiques", () => {
  const rs = [res("2025-08-15", "Rennes", "Marseille", 1, 0, [0, 0]), res("2025-08-16", "Lens", "Lyon", 3, 1, [1, 1]), res("2025-08-17", "Nice", "Paris SG", 2, 2, [1, 0])];
  const s = statsChampionnat(rs, "ligue 1")!;
  assert.equal(s.nb, 3);
  proche(s.moyenneButs, 3);
  proche(s.avantageTerrain, 6 / 3);
  assert.equal(s.partPremiereMiTemps, null, "moins de 20 matchs avec la mi-temps : pas assez pour ajuster");
  assert.equal(statsChampionnat(rs, "Serie A"), null);
});

test("Équipes : noms courants reconnus dans les historiques, rien de deviné en cas de doute", () => {
  assert.equal(cleEquipe("PSG"), cleEquipe("Paris SG"));
  assert.equal(cleEquipe("Olympique de Marseille"), cleEquipe("Marseille"));
  assert.equal(cleEquipe("FC Nantes"), cleEquipe("Nantes"));
  assert.equal(cleEquipe("Manchester United"), cleEquipe("Man United"));
  assert.equal(cleEquipe("Borussia Mönchengladbach"), cleEquipe("M'gladbach"));
  assert.equal(cleEquipe("Atlético de Madrid"), cleEquipe("Ath Madrid"));
  const rs = [res("2025-08-15", "Paris SG", "Marseille", 1, 0), res("2025-08-16", "Man United", "Man City", 1, 1)];
  assert.equal(trouverEquipe("PSG", rs), "Paris SG");
  assert.equal(trouverEquipe("Manchester", rs), null, "deux équipes possibles : aucune");
  assert.equal(trouverEquipe("Lens", rs), null);
});

test("Fiche équipe : 10 derniers matchs, bilan, séries en cours, confrontations directes", () => {
  const rs: Resultat[] = [];
  // Lens : 12 matchs du plus ancien au plus récent ; les 4 derniers à 3+ buts avec victoire
  const scores: Array<[number, number]> = [[0, 0], [1, 0], [0, 2], [1, 1], [2, 0], [0, 1], [1, 1], [0, 0], [2, 1], [3, 1], [2, 2], [4, 0]];
  scores.forEach(([b, e], i) => {
    const date = `2025-09-${String(i + 1).padStart(2, "0")}`;
    rs.push(i % 2 ? res(date, "Lens", i === 11 ? "Brest" : "Nice", b, e) : res(date, i === 0 ? "Brest" : "Lyon", "Lens", e, b));
  });
  const f = ficheEquipe("RC Lens", rs, "Stade Brestois");
  assert.equal(f.nomHistorique, "Lens");
  assert.equal(f.derniers.length, 10);
  assert.equal(f.derniers[0].date, "2025-09-12");
  assert.deepEqual([f.derniers[0].marques, f.derniers[0].encaisses, f.derniers[0].resultat], [4, 0, "V"]);
  assert.equal(f.bilan!.marques, [[0, 2], [1, 1], [2, 0], [0, 1], [1, 1], [0, 0], [2, 1], [3, 1], [2, 2], [4, 0]].reduce((s, [b]) => s + b, 0));
  assert.ok(f.series.some((s) => s.texte === "4 matchs à 3 buts ou plus de suite"));
  assert.ok(f.series.some((s) => s.texte === "6 matchs sans défaite de suite"), JSON.stringify(f.series));
  assert.ok(!f.series.some((s) => s.texte.includes("2 buts ou plus")), "redondante avec la série à 3 buts ou plus");
  assert.equal(f.confrontations.length, 2);
  assert.equal(ficheEquipe("Inconnue", rs).nomHistorique, null);
  assert.deepEqual(seriesEnCours([]), []);
});
