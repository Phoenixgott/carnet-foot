/**
 * Phase 5 : calculateur freebet (remboursé ou non), comparateur de matchs, suivi des offres
 * avec rappels, fichier d'agenda. Cas calculés à la main.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyserFreebet,
  calculerFreebet,
  freebetCalculable,
  jambeFreebet,
  jambeQualification,
  qualifCalculable,
  verifierEntreeFreebet,
  type EntreeFreebet,
} from "../../src/core/freebet";
import { comparerFreebet, libelleCandidat } from "../../src/core/freebet-comparateur";
import { echapperIcs, evenementAgenda, jourSuivant, nomFichierAgenda, plierLigne } from "../../src/core/ics";
import {
  bilanOffres,
  completerOffres,
  etatOffre,
  joursRestants,
  offresARappeler,
  SAISIE_OFFRE_VIDE,
  texteDelai,
  trierOffres,
  validerOffre,
  type OffreFreebet,
} from "../../src/core/offres";
import type { Match } from "../../src/core/types";

const proche = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

const exemple: EntreeFreebet = {
  mode: "book",
  qMise: 100, qCote: 2.05, qCoteInverse: 1.95, qCommission: 0,
  fMontant: 100, fCote: 4.5, fCoteInverse: 1.3, fCommission: 0,
};

test("Freebet non remboursé : exemple du carnet inchangé (80,77 % de conversion)", () => {
  const r = calculerFreebet(exemple);
  proche(r.freebet.miseCouverture, 269.2307692);
  proche(r.freebet.resultat, 80.7692308);
  proche(r.conversion, 0.8076923);
  // Même résultat en indiquant explicitement « non remboursé »
  assert.deepEqual(calculerFreebet({ ...exemple, fRembourse: false }), r);
});

test("Freebet remboursé : la mise est rendue en cas de gain (paie 450 au lieu de 350), même gain quelle que soit l'issue", () => {
  const r = calculerFreebet({ ...exemple, fRembourse: true });
  proche(r.freebet.miseCouverture, 450 / 1.3);
  proche(r.freebet.resultat, 450 - 450 / 1.3);
  proche(r.freebet.resultat, 103.8461538);
  // Le freebet gagne : 450 − couverture ; il perd : la couverture gagne (cote − 1) × couverture
  const H = r.freebet.miseCouverture;
  proche(450 - H, H * 0.3);
  assert.ok(r.freebet.resultat > calculerFreebet(exemple).freebet.resultat);
  // Exchange, commission 5 % : mêmes gains dans les deux cas
  const l = jambeFreebet(100, 4.5, 1.35, "lay", 0.05, true);
  proche(l.miseCouverture, 450 / 1.3);
  proche(450 - l.miseCouverture * 0.35, l.resultat);
});

test("Pari qui débloque : coût et conversion nette (qualif 100 € à 2,05 / 1,95)", () => {
  const b = analyserFreebet(exemple)!;
  // qualif : couverture 100 × 2,05 / 1,95 = 105,1282 ; résultat 205 − 100 − 105,1282 = −0,1282
  proche(b.qualif.miseCouverture, 105.1282051);
  proche(b.qualif.resultat, -0.1282051);
  proche(b.cout, 0.1282051);
  proche(b.total, 80.7692308 - 0.1282051);
  proche(b.conversionNette, (80.7692308 - 0.1282051) / 100);
  assert.equal(b.appreciation, "ok");
  // Un pari qui débloque rentable n'a pas de coût
  const q = analyserFreebet({ ...exemple, qCoteInverse: 2.3 })!;
  assert.ok(q.qualif.resultat > 0);
  assert.equal(q.cout, 0);
  // Appréciation du carnet : 70 % et plus bon, 60-70 % correct, moins de 60 % à améliorer
  // conversion = (cote − 1) × (cote inverse − 1) / cote inverse
  assert.equal(analyserFreebet({ ...exemple, fCote: 2.7, fCoteInverse: 1.6 })!.appreciation, "mid"); // 1,7 × 0,6 / 1,6 = 63,75 %
  assert.equal(analyserFreebet({ ...exemple, fCote: 2, fCoteInverse: 2 })!.appreciation, "ko"); // 50 %
});

test("Chaque pari se calcule seul : le freebet sans le pari qui débloque, et inversement", () => {
  const sansFreebet = { ...exemple, fMontant: NaN, fCote: NaN, fCoteInverse: NaN };
  const sansQualif = { ...exemple, qMise: NaN, qCote: NaN, qCoteInverse: NaN };
  assert.equal(qualifCalculable(sansFreebet), true);
  assert.equal(freebetCalculable(sansFreebet), false);
  assert.equal(qualifCalculable(sansQualif), false);
  assert.equal(freebetCalculable(sansQualif), true);
  assert.equal(qualifCalculable(exemple) && freebetCalculable(exemple), true);
  // Mêmes chiffres que le calcul complet
  const c = calculerFreebet(exemple);
  assert.deepEqual(jambeQualification(100, 2.05, 1.95, "book", 0), c.qualif);
  assert.deepEqual(jambeFreebet(100, 4.5, 1.3, "book", 0), c.freebet);
  // Cotes impossibles ou lay sous la commission : non calculable
  assert.equal(freebetCalculable({ ...exemple, fCote: 1 }), false);
  assert.equal(freebetCalculable({ ...exemple, fCoteInverse: 1 }), false);
  assert.equal(freebetCalculable({ ...exemple, mode: "lay", fCoteInverse: 1, fCommission: 0.05 }), false);
  assert.equal(freebetCalculable({ ...exemple, mode: "lay", fCoteInverse: 1.3, fCommission: 1 }), false, "commission de 100 % impossible");
  assert.equal(freebetCalculable({ ...exemple, mode: "lay", fCoteInverse: 1.3, fCommission: NaN }), false);
  assert.equal(freebetCalculable({ ...exemple, mode: "lay", fCoteInverse: 1.3, fCommission: 0.05 }), true);
  assert.equal(qualifCalculable({ ...exemple, qMise: 0 }), false);
});

test("Saisies impossibles : message clair, jamais de chiffre inventé", () => {
  assert.equal(verifierEntreeFreebet(exemple), null);
  assert.match(verifierEntreeFreebet({ ...exemple, qMise: NaN })!, /Saisis toutes les valeurs/);
  assert.match(verifierEntreeFreebet({ ...exemple, qMise: 0 })!, /mise du pari qui débloque doit être positive/);
  assert.match(verifierEntreeFreebet({ ...exemple, fMontant: -5 })!, /montant du freebet doit être positif/);
  assert.match(verifierEntreeFreebet({ ...exemple, fCote: 1 })!, /cote du freebet doit être supérieure à 1/);
  assert.match(verifierEntreeFreebet({ ...exemple, qCoteInverse: 1 })!, /cotes inverses/);
  assert.match(verifierEntreeFreebet({ ...exemple, mode: "lay", fCommission: 1 })!, /commission doit être comprise/);
  assert.match(verifierEntreeFreebet({ ...exemple, mode: "lay", qCoteInverse: 0.04, qCommission: 0.05 })!, /cote lay du pari qui débloque/);
  assert.equal(analyserFreebet({ ...exemple, fCote: 1 }), null);
});

const cotes = (over15: number | null, under15: number | null, over25: number | null, under25: number | null, bookmaker = "Unibet") => ({
  over15, under15, over25, under25, bookmaker,
});
const match = (id: string, date: string | null, c: Match["cotes"]): Match => ({
  id, date, heure: "21:00", ligue: "Ligue 1", domicile: { nom: id.toUpperCase() }, exterieur: { nom: "X" }, cotes: c,
});

test("Comparateur : classement par conversion, cote minimale de l'offre, matchs passés et sans cotes", () => {
  const matchs = [
    match("a", "2030-05-04", cotes(1.25, 3.8, 2.6, 1.6)),
    match("b", "2030-05-05", cotes(null, null, 1.8, 2.0)),
    match("c", "2030-05-04", cotes(1.3, 3.4, null, null)),
    match("passe", "2030-05-01", cotes(1.25, 3.8, 2.6, 1.6)),
    match("sans", "2030-05-04", null),
    match("d", "2030-05-06", cotes(1.4, null, 2.0, null)), // aucune ligne complète
  ];
  const base = { montant: 100, rembourse: false, mode: "book" as const, commission: 0, coteMin: null, aPartirDu: "2030-05-04" };
  const r = comparerFreebet(matchs, base);
  // conversion = (cote du freebet − 1) × (cote inverse − 1) / cote inverse ; ex. a, 2,5 « plus » : 1,6 × 0,6 / 1,6 = 60 %
  const conv = (a: number, b: number) => ((a - 1) * (b - 1)) / b;
  const attendues = [
    ["a", "1.5", "moins", conv(3.8, 1.25)],
    ["c", "1.5", "moins", conv(3.4, 1.3)],
    ["a", "2.5", "plus", conv(2.6, 1.6)],
    ["c", "1.5", "plus", conv(1.3, 3.4)],
    ["b", "2.5", "plus", conv(1.8, 2.0)],
    ["b", "2.5", "moins", conv(2.0, 1.8)],
    ["a", "1.5", "plus", conv(1.25, 3.8)],
    ["a", "2.5", "moins", conv(1.6, 2.6)],
  ] as const;
  const tries = [...attendues].sort((x, y) => y[3] - x[3]);
  assert.deepEqual(r.candidats.map((c) => [c.matchId, c.ligne, c.cote]), tries.map((x) => [x[0], x[1], x[2]]));
  r.candidats.forEach((c, i) => proche(c.conversion, tries[i][3], 1e-9));
  assert.equal(r.candidats.length, 8, "d n'a aucune ligne complète, passe est passé, sans n'a pas de cotes");
  assert.equal(r.sansCotes, 2, "« sans » et « d »");
  assert.equal(r.candidats[0].matchId, "a");
  assert.equal(libelleCandidat(r.candidats[0]), "plus de 2,5 buts");
  assert.equal(r.candidats[0].bookmaker, "Unibet");
  const a15 = r.candidats.find((c) => c.matchId === "a" && c.ligne === "1.5" && c.cote === "moins")!;
  proche(a15.gain, 100 * conv(3.8, 1.25));
  proche(a15.miseCouverture, (100 * 2.8) / 1.25);
  assert.equal(libelleCandidat(a15), "moins de 1,5 buts");

  // Cote minimale de l'offre : 2 → seuls les freebets à cote ≥ 2 restent
  const min = comparerFreebet(matchs, { ...base, coteMin: 2 });
  assert.ok(min.candidats.every((c) => c.coteFreebet >= 2));
  assert.equal(min.candidats.length + min.ecartees, 8);
  assert.ok(min.ecartees >= 3);
  // Freebet remboursé : conversion plus haute pour le même candidat
  const sr = comparerFreebet(matchs, { ...base, rembourse: true });
  const a = (l: typeof r) => l.candidats.find((c) => c.matchId === "a" && c.ligne === "2.5" && c.cote === "plus")!;
  assert.ok(a(sr).conversion > a(r).conversion);
  // Montant nul : rien
  assert.deepEqual(comparerFreebet(matchs, { ...base, montant: 0 }).candidats, []);
  // Marge du bookmaker de la ligne
  proche(r.candidats.find((c) => c.matchId === "a" && c.ligne === "2.5")!.marge, 1 / 2.6 + 1 / 1.6 - 1, 1e-9);
});

test("Comparateur sur exchange : commission prise en compte", () => {
  const m = [match("a", "2030-05-04", cotes(null, null, 2.6, 1.7))];
  const r = comparerFreebet(m, { montant: 100, rembourse: false, mode: "lay", commission: 0.05, coteMin: null, aPartirDu: "2030-05-04" });
  const c = r.candidats.find((x) => x.cote === "plus")!;
  const j = jambeFreebet(100, 2.6, 1.7, "lay", 0.05);
  proche(c.gain, j.resultat);
  proche(c.miseCouverture, 160 / 1.65);
});

const offre = (extra: Partial<OffreFreebet> = {}): OffreFreebet => ({
  id: "o1", bookmaker: "Unibet", titre: "Freebet 10 €", montant: 10, qualifMise: 10, coteMin: 1.5, dateLimite: "2026-09-25",
  conditions: "", rembourse: false, statut: "a-faire", beneficeReel: null, creeLe: "2026-09-20T10:00:00Z", modifieLe: "2026-09-20T10:00:00Z", ...extra,
});

test("Délais des offres : jours restants, états, textes", () => {
  assert.equal(joursRestants("2026-09-25", "2026-09-25"), 0);
  assert.equal(joursRestants("2026-09-28", "2026-09-25"), 3);
  assert.equal(joursRestants("2026-09-24", "2026-09-25"), -1);
  assert.equal(joursRestants("2026-03-30", "2026-03-27"), 3, "changement d'heure : toujours des jours entiers");
  assert.equal(joursRestants("2027-01-02", "2026-12-31"), 2);
  assert.ok(Number.isNaN(joursRestants("n'importe quoi", "2026-09-25")));
  const j = "2026-09-25";
  const etat = (dateLimite: string | null, statut: OffreFreebet["statut"] = "a-faire") => etatOffre({ dateLimite, statut }, j);
  assert.equal(etat("2026-09-24"), "expiree");
  assert.equal(etat("2026-09-25"), "urgente");
  assert.equal(etat("2026-09-27"), "urgente");
  assert.equal(etat("2026-09-28"), "bientot");
  assert.equal(etat("2026-10-02"), "bientot");
  assert.equal(etat("2026-10-03"), "en-cours");
  assert.equal(etat(null), "en-cours");
  assert.equal(etat("2026-09-24", "terminee"), "terminee");
  assert.equal(texteDelai("2026-09-25", j), "dernier jour : aujourd'hui");
  assert.equal(texteDelai("2026-09-26", j), "expire demain");
  assert.equal(texteDelai("2026-09-30", j), "expire dans 5 jours");
  assert.equal(texteDelai("2026-09-24", j), "expirée depuis hier");
  assert.equal(texteDelai("2026-09-20", j), "expirée depuis 5 jours");
});

test("Rappels : offres non terminées qui expirent dans les 3 jours, la plus proche d'abord", () => {
  const j = "2026-09-25";
  const offres = [
    offre({ id: "loin", dateLimite: "2026-10-30" }),
    offre({ id: "demain", dateLimite: "2026-09-26" }),
    offre({ id: "aujourdhui", dateLimite: "2026-09-25" }),
    offre({ id: "j3", dateLimite: "2026-09-28" }),
    offre({ id: "j4", dateLimite: "2026-09-29" }),
    offre({ id: "passee", dateLimite: "2026-09-20" }),
    offre({ id: "finie", dateLimite: "2026-09-26", statut: "terminee" }),
    offre({ id: "sansdate", dateLimite: null }),
  ];
  assert.deepEqual(offresARappeler(offres, j).map((o) => o.id), ["aujourdhui", "demain", "j3"]);
  assert.deepEqual(offresARappeler(offres, j, 10).map((o) => o.id), ["aujourdhui", "demain", "j3", "j4"]);
});

test("Tri : en cours par date limite, sans date après, expirées puis terminées à la fin", () => {
  const j = "2026-09-25";
  const offres = [
    offre({ id: "finie-ancienne", statut: "terminee", modifieLe: "2026-09-01T00:00:00Z" }),
    offre({ id: "sansdate", dateLimite: null }),
    offre({ id: "expiree", dateLimite: "2026-09-10" }),
    offre({ id: "loin", dateLimite: "2026-10-30" }),
    offre({ id: "proche", dateLimite: "2026-09-26" }),
    offre({ id: "finie-recente", statut: "terminee", modifieLe: "2026-09-20T00:00:00Z" }),
  ];
  assert.deepEqual(trierOffres(offres, j).map((o) => o.id), ["proche", "loin", "sansdate", "expiree", "finie-recente", "finie-ancienne"]);
});

test("Bilan des offres : à utiliser, expirées, bénéfice réel et conversion moyenne", () => {
  const j = "2026-09-25";
  const b = bilanOffres(
    [
      offre({ id: "1", montant: 10, dateLimite: "2026-09-30" }),
      offre({ id: "2", montant: 20, dateLimite: null, statut: "freebet-recu" }),
      offre({ id: "3", montant: 15, dateLimite: "2026-09-01" }),
      offre({ id: "4", montant: 10, statut: "terminee", beneficeReel: 7.5 }),
      offre({ id: "5", montant: 20, statut: "terminee", beneficeReel: 12.5 }),
      offre({ id: "6", montant: 50, statut: "terminee", beneficeReel: null }),
    ],
    j,
  );
  assert.deepEqual([b.enCours, b.aUtiliser, b.expirees, b.terminees], [2, 30, 1, 3]);
  proche(b.benefice, 20);
  proche(b.conversionMoyenne, 20 / 30);
  assert.ok(Number.isNaN(bilanOffres([], j).conversionMoyenne));
});

test("Saisie d'une offre : vérifications et messages, lecture tolérante des données enregistrées", () => {
  const ok = validerOffre({ ...SAISIE_OFFRE_VIDE, bookmaker: " Unibet ", titre: "Freebet 10 €", montant: "12,5", qualifMise: "10", coteMin: "1,5", dateLimite: "2026-09-30", rembourse: true }, null, "id1", "2026-09-21T10:00:00Z");
  assert.ok("offre" in ok);
  if ("offre" in ok) {
    assert.deepEqual(
      [ok.offre.bookmaker, ok.offre.montant, ok.offre.qualifMise, ok.offre.coteMin, ok.offre.dateLimite, ok.offre.rembourse, ok.offre.statut, ok.offre.beneficeReel],
      ["Unibet", 12.5, 10, 1.5, "2026-09-30", true, "a-faire", null],
    );
    assert.equal(ok.offre.creeLe, "2026-09-21T10:00:00Z");
  }
  const erreur = (s: Partial<typeof SAISIE_OFFRE_VIDE>) => {
    const r = validerOffre({ ...SAISIE_OFFRE_VIDE, bookmaker: "Unibet", ...s }, null, "x", "");
    return "erreur" in r ? r.erreur : null;
  };
  assert.match(erreur({ bookmaker: " " })!, /bookmaker/);
  assert.match(erreur({ montant: "abc" })!, /Montant du freebet/);
  assert.match(erreur({ montant: "0" })!, /Montant du freebet/);
  assert.match(erreur({ qualifMise: "-3" })!, /Mise du pari qui débloque/);
  assert.match(erreur({ coteMin: "1" })!, /Cote minimale/);
  assert.match(erreur({ dateLimite: "2026-02-30" })!, /Date limite/);
  assert.match(erreur({ statut: "terminee", beneficeReel: "beaucoup" })!, /Bénéfice réel/);
  assert.equal(erreur({}), null, "tout est facultatif sauf le bookmaker");
  // Bénéfice négatif, écrit avec le vrai signe moins ; gardé seulement si l'offre est terminée
  const fin = validerOffre({ ...SAISIE_OFFRE_VIDE, bookmaker: "X", statut: "terminee", beneficeReel: "−1,2" }, null, "y", "");
  assert.ok("offre" in fin && fin.offre.beneficeReel === -1.2);
  const pasFinie = validerOffre({ ...SAISIE_OFFRE_VIDE, bookmaker: "X", statut: "freebet-recu", beneficeReel: "5" }, null, "y", "");
  assert.ok("offre" in pasFinie && pasFinie.offre.beneficeReel === null);

  assert.deepEqual(completerOffres("n'importe quoi"), []);
  const lues = completerOffres([
    { id: "a", bookmaker: "Unibet", montant: 10, dateLimite: "2026-13-01", statut: "bizarre", beneficeReel: 5 },
    { id: 3, bookmaker: "X" },
    null,
    { id: "b", bookmaker: "Winamax", statut: "terminee", beneficeReel: 4, rembourse: true },
  ]);
  assert.equal(lues.length, 2);
  assert.deepEqual([lues[0].dateLimite, lues[0].statut, lues[0].beneficeReel, lues[0].conditions], [null, "a-faire", null, ""]);
  assert.deepEqual([lues[1].statut, lues[1].beneficeReel, lues[1].rembourse], ["terminee", 4, true]);
});

test("Fichier d'agenda : événement sur la journée limite, deux alarmes, texte échappé, lignes ≤ 75 octets", () => {
  const o = offre({ id: "abc", bookmaker: "Unibet", titre: "Freebet 10 €, Ligue 1; test", conditions: "Cote min 1,5\nPari simple" });
  const ics = evenementAgenda(o, new Date("2026-09-21T15:30:00Z"))!;
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "fins de ligne CRLF uniquement");
  for (const ligne of ics.split("\r\n")) assert.ok(new TextEncoder().encode(ligne).length <= 75, ligne);
  const dépliée = ics.replace(/\r\n /g, "");
  for (const attendu of [
    "UID:freebet-abc@carnet-paris-foot",
    "DTSTAMP:20260921T153000Z",
    "DTSTART;VALUE=DATE:20260925",
    "DTEND;VALUE=DATE:20260926",
    "TRIGGER:-PT15H",
    "TRIGGER:-P2DT15H",
    "SUMMARY:Freebet à utiliser : Unibet : Freebet 10 €\\, Ligue 1\\; test",
    "Conditions : Cote min 1\\,5\\nPari simple",
  ]) {
    assert.ok(dépliée.includes(attendu), attendu + "\n" + dépliée);
  }
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 2);
  assert.equal(evenementAgenda(offre({ dateLimite: null }), new Date()), null);
  // Fin de mois et d'année
  assert.equal(jourSuivant("2026-09-30"), "2026-10-01");
  assert.equal(jourSuivant("2026-12-31"), "2027-01-01");
  assert.equal(jourSuivant("2028-02-28"), "2028-02-29");
  assert.equal(echapperIcs("a\\b;c,d\ne"), "a\\\\b\\;c\\,d\\ne");
  // Pliage : une ligne longue est coupée sans casser un caractère accentué
  const longue = "DESCRIPTION:" + "é".repeat(60);
  const pliee = plierLigne(longue);
  assert.ok(pliee.includes("\r\n "));
  assert.equal(pliee.replace(/\r\n /g, ""), longue);
  assert.equal(nomFichierAgenda(offre({ bookmaker: "Bet 365 / Été" })), "freebet-bet-365-ete-2026-09-25.ics");
});
