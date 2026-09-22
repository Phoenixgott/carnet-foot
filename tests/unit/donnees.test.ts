/**
 * Données : import depuis le carnet (fusion additive avec le journal existant), sauvegarde et versions.
 * Les exports de test sont produits par le VRAI code d'export du carnet
 * (fonction fullExportText de l'artefact), pour coller à la réalité.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnetOriginal } from "../helpers/carnet-original";
import { aleatoire, matchAleatoire, pariCarnetAleatoire } from "../helpers/generateurs";
import { analyserTexteCarnet, ErreurImport, fusionnerParisCarnet } from "../../src/data/import-carnet";
import { fusionnerMatchsAvecExistants } from "../../src/data/import-matchs";
import { creerSauvegarde, lireSauvegarde, nomFichierSauvegarde } from "../../src/data/sauvegarde";
import { empreinte, jsonCanonique, type Contenu } from "../../src/data/contenu";
import { faireCopieDuJour, jourLocal, versionsASupprimer, GARDER_AUTRES, GARDER_QUOTIDIENNES } from "../../src/data/versions";

const carnet = chargerCarnetOriginal();
let compteur = 0;
const ids = () => "id-" + ++compteur;
const MAINTENANT = new Date("2026-09-21T15:00:00+02:00");

/** Produit un export complet avec le code d'origine du carnet. */
function exportCarnet(opts: { nbParis?: number; nbMatchs?: number; exemple?: boolean; bank?: number; pct?: number; graine?: number } = {}) {
  const r = aleatoire(opts.graine ?? 5);
  const paris = Array.from({ length: opts.nbParis ?? 25 }, () => pariCarnetAleatoire(r));
  const matchs = Array.from({ length: opts.nbMatchs ?? 8 }, (_, i) => {
    const m = matchAleatoire(r, i) as any;
    m.domicile = m.domicile ?? { nom: "Lens" };
    m.exterieur = m.exterieur ?? { nom: "Brest" };
    m.domicile.nom = m.domicile.nom ?? "Lens";
    m.exterieur.nom = m.exterieur.nom ?? "Brest";
    return m;
  });
  carnet.setBets(JSON.parse(JSON.stringify(paris)));
  carnet.setSettings({ bank: opts.bank ?? 250, pct: opts.pct ?? 2.5 });
  carnet.setData(JSON.parse(JSON.stringify(opts.exemple ? { exemple: true, matchs } : { matchs })));
  carnet.setChosen(["Ligue 1", "Serie A", "WSL"]);
  return carnet.api.fullExportText() as string;
}

test("Export complet du carnet : conversion fidèle, tout nouveau au premier import", () => {
  for (const graine of [1, 2, 3, 4, 5]) {
    const a = analyserTexteCarnet(exportCarnet({ graine }), MAINTENANT, ids);
    assert.equal(a.format, "export-complet");
    assert.equal(a.contenu.paris.length, 25);
    assert.equal(a.contenu.matchs.length, 8);
    assert.ok(a.controle);
    // Premier import (journal vide) : tout est nouveau
    const fp = fusionnerParisCarnet(a.contenu.paris, []);
    assert.equal(fp.nouveaux.length, 25);
    assert.equal(fp.dejaPresents, 0);
    const fm = fusionnerMatchsAvecExistants(a.contenu.matchs, [], MAINTENANT.toISOString());
    assert.equal(fm.nouveaux.length, 8);
    // Méthodes : croisement m1/m3/m2 respecté
    a.contenu.paris.forEach((p, i) => {
      const code = (a.source.paris[i] as any).methode;
      assert.equal(p.methode, { m1: "+1.5", m3: "+2.5", m2: "Freebet", autre: "Autre" }[code as string]);
      assert.equal(p.ordre, i);
      assert.equal(p.origine?.carnet.index, i);
    });
  }
});

test("Export entouré de texte (copié-collé approximatif) : accepté", () => {
  const t = "Voici mon export :\n" + exportCarnet() + "\nmerci";
  const a = analyserTexteCarnet(t, MAINTENANT, ids);
  assert.equal(a.contenu.paris.length, 25);
});

test("Fusion des paris : additive, jamais destructive — un pari déjà importé n'est plus jamais retouché", () => {
  const texte = exportCarnet({ graine: 9, nbParis: 6 });
  const a = analyserTexteCarnet(texte, MAINTENANT, ids);
  // Après un premier import, le journal contient ces 6 paris (origine.carnet.index 0..5)
  const journal = a.contenu.paris;

  // Réimporter exactement le même export : rien de nouveau
  const b = analyserTexteCarnet(texte, MAINTENANT, ids);
  const rejeu = fusionnerParisCarnet(b.contenu.paris, journal);
  assert.equal(rejeu.nouveaux.length, 0);
  assert.equal(rejeu.dejaPresents, 6);

  // L'utilisateur modifie un pari DANS L'APP (statut, cote) : un réimport identique ne doit pas y toucher
  const modifie = { ...journal[2], statut: "gagne" as const, cote: 9.99, notes: "corrigé à la main" };
  const journalModifie = journal.map((p, i) => (i === 2 ? modifie : p));
  const c = analyserTexteCarnet(texte, MAINTENANT, ids);
  const apresModif = fusionnerParisCarnet(c.contenu.paris, journalModifie);
  assert.equal(apresModif.nouveaux.length, 0, "le pari modifié dans l'app n'est pas réécrasé par le carnet");

  // Le carnet gagne un nouveau pari (7e) : seul celui-ci est nouveau, à la suite du journal
  const texte2 = exportCarnet({ graine: 9, nbParis: 7 });
  const d = analyserTexteCarnet(texte2, MAINTENANT, ids);
  const avecNouveau = fusionnerParisCarnet(d.contenu.paris, journalModifie);
  assert.equal(avecNouveau.nouveaux.length, 1);
  assert.equal(avecNouveau.nouveaux[0].origine?.carnet.index, 6);
  assert.equal(avecNouveau.nouveaux[0].ordre, Math.max(...journalModifie.map((p) => p.ordre)) + 1, "prend la suite du journal, jamais un ordre déjà pris");
});

test("Fusion des paris : un pari ajouté dans l'app (sans origine carnet) n'est jamais touché par un import", () => {
  const texte = exportCarnet({ graine: 12, nbParis: 3 });
  const a = analyserTexteCarnet(texte, MAINTENANT, ids);
  const ajouteDansLApp = { ...a.contenu.paris[0], id: "app-1", ordre: 99, origine: undefined, match: "Ajouté à la main" };
  const journal = [...a.contenu.paris, ajouteDansLApp];
  const b = analyserTexteCarnet(texte, MAINTENANT, ids);
  const fusion = fusionnerParisCarnet(b.contenu.paris, journal);
  assert.equal(fusion.nouveaux.length, 0);
  assert.equal(fusion.dejaPresents, 3);
});

test("Fusion des paris : position ET contenu comparés — une suppression au milieu ne perd ni ne masque un pari réellement nouveau", () => {
  // Import initial à 4 paris (index 0..3)
  const r = aleatoire(15);
  const quatre = Array.from({ length: 4 }, () => pariCarnetAleatoire(r));
  const a = analyserTexteCarnet(JSON.stringify({ paris: quatre, reglages: { bank: 200, pct: 2 } }), MAINTENANT, ids);
  const journal = a.contenu.paris;
  assert.equal(fusionnerParisCarnet(a.contenu.paris, journal).nouveaux.length, 0);

  // Le pari n°2 (index 1) est supprimé du carnet : les paris n°3 et 4 se décalent aux index 1 et 2,
  // avec un contenu différent de ce qui occupait ces index lors du premier import — traités comme
  // nouveaux (pas comme « déjà connus »), donc au pire un doublon récupérable, jamais une perte.
  const troisApresSupression = [quatre[0], quatre[2], quatre[3]];
  const b = analyserTexteCarnet(JSON.stringify({ paris: troisApresSupression, reglages: { bank: 200, pct: 2 } }), MAINTENANT, ids);
  const apresSuppression = fusionnerParisCarnet(b.contenu.paris, journal);
  assert.equal(apresSuppression.nouveaux.length, 2);

  // Plus important : un pari VRAIMENT nouveau ajouté après la suppression peut hériter par
  // coïncidence d'un ancien index (ici 3, déjà vu). Sans la clé de contenu, il serait pris pour
  // « déjà connu » et perdu en silence. Avec elle, son contenu différent le sauve.
  const nouveauPari = pariCarnetAleatoire(aleatoire(999));
  const quatreApresAjout = [...troisApresSupression, nouveauPari];
  const c = analyserTexteCarnet(JSON.stringify({ paris: quatreApresAjout, reglages: { bank: 200, pct: 2 } }), MAINTENANT, ids);
  const fusionFinale = fusionnerParisCarnet(c.contenu.paris, journal);
  assert.equal(fusionFinale.nouveaux.length, 3, "les 2 décalés + le vrai nouveau, aucun perdu");
  const dates = fusionFinale.nouveaux.map((p) => `${p.date}|${p.cote}|${p.mise}`);
  assert.ok(dates.includes(`${nouveauPari.date}|${nouveauPari.cote}|${nouveauPari.mise}`), "le pari vraiment nouveau est bien récupéré");
});

test("Fusion des matchs d'un export du carnet : réutilise la fusion de l'onglet Matchs (suivi des cotes compris)", () => {
  const texte = exportCarnet({ graine: 7, nbMatchs: 2 });
  const a = analyserTexteCarnet(texte, MAINTENANT, ids);
  const [m1] = a.contenu.matchs;
  // Un match déjà chargé (via l'autre conversation Claude) avec des cotes suivies
  const existant = { ...m1, cotes: { over25: 1.8, bookmaker: "Unibet" }, historiqueCotes: [{ le: null, over15: null, over25: 1.8, under15: null, under25: null, bookmaker: "Unibet", origine: "import" as const }] };
  const fusion = fusionnerMatchsAvecExistants(a.contenu.matchs, [existant], MAINTENANT.toISOString());
  assert.equal(fusion.nouveaux.length, 1);
  const misAJour = fusion.misAJour.find((x) => x.avant.id === existant.id);
  assert.ok(misAJour, "le match connu est complété, pas dupliqué");
});

test("Matchs d'exemple du carnet : ignorés et signalés", () => {
  const a = analyserTexteCarnet(exportCarnet({ exemple: true }), MAINTENANT, ids);
  assert.equal(a.contenu.matchs.length, 0);
  assert.equal(a.matchsExempleIgnores, 8);
});

test("Ancienne sauvegarde du carnet (« Copier ma sauvegarde ») : paris et réglages importés, avertissement", () => {
  const r = aleatoire(3);
  const paris = Array.from({ length: 6 }, () => pariCarnetAleatoire(r));
  const texte = JSON.stringify({ paris, reglages: { bank: 300, pct: 1.5 } });
  const a = analyserTexteCarnet(texte, MAINTENANT, ids);
  assert.equal(a.format, "ancienne-sauvegarde");
  assert.equal(a.contenu.paris.length, 6);
  assert.equal(a.controle, null);
  assert.ok(a.avertissements.length >= 1);
  assert.equal(fusionnerParisCarnet(a.contenu.paris, []).nouveaux.length, 6);
});

test("Textes refusés avec un message clair", () => {
  const refuse = (t: string, fragment: string) =>
    assert.throws(() => analyserTexteCarnet(t, MAINTENANT, ids), (e: unknown) => e instanceof ErreurImport && (e as Error).message.includes(fragment));
  refuse("", "vide");
  refuse("n'importe quoi", "illisible");
  refuse('{"app":"carnet-paris-foot","type":"export-complet","version":1,"cles":{"paris":[', "illisible");
  refuse('{"bonjour":1}', "n'est pas un export");
  refuse('{"app":"carnet-foot","type":"sauvegarde"}', "Restaurer une sauvegarde");
  refuse('{"app":"carnet-paris-foot","type":"export-complet","version":2}', "Version d'export inconnue");
});

test("Données bizarres du carnet : importées avec avertissement, jamais inventées", () => {
  const texte = JSON.stringify({
    app: "carnet-paris-foot", type: "export-complet", version: 1,
    cles: {
      paris: [{ date: "2026-09-01", match: "A – B", methode: "m9", cote: 1.8, mise: 5, statut: "bizarre" }],
      reglages: { bank: 100 },
      matchs3: { matchs: [{ id: "x", domicile: { nom: "A" } }, { domicile: { nom: "Lens" }, exterieur: { nom: "Brest" }, date: "2026-09-22" }] },
    },
  });
  const a = analyserTexteCarnet(texte, MAINTENANT, ids);
  assert.equal(a.contenu.paris[0].methode, "Autre");
  assert.equal(a.contenu.paris[0].statut, "attente");
  assert.equal(a.contenu.matchs.length, 1, "le match sans équipe extérieure est ignoré");
  assert.equal(a.contenu.matchs[0].id, "2026-09-22|lens|brest");
  assert.ok(a.avertissements.length >= 4);
});

test("Sauvegarde : aller-retour exact, empreinte vérifiée, réglages locaux exclus", async () => {
  const a = analyserTexteCarnet(exportCarnet({ graine: 21 }), MAINTENANT, ids);
  const contenu: Contenu = { ...a.contenu, reglages: [...a.contenu.reglages, { cle: "dernierExportFichier", valeur: "2026-09-01" }] };
  const f = await creerSauvegarde(contenu, "0.1.0", MAINTENANT);
  assert.ok(!f.contenu.reglages.some((r) => r.cle === "dernierExportFichier"));
  const texte = JSON.stringify(f, null, 1);
  const lue = await lireSauvegarde(texte);
  assert.equal(jsonCanonique(lue.contenu), jsonCanonique(f.contenu));
  assert.equal(lue.empreinte, await empreinte(contenu));
  assert.equal(lue.resume.nbParis, 25);

  const abimee = JSON.parse(texte);
  abimee.contenu.paris[0].mise += 1;
  await assert.rejects(lireSauvegarde(JSON.stringify(abimee)), /abîmée/);
  await assert.rejects(lireSauvegarde(texte.slice(0, texte.length / 2)), /illisible/);
  await assert.rejects(lireSauvegarde(exportCarnet()), /Importer depuis le carnet/);
  const future = JSON.parse(texte);
  future.schema = 99;
  await assert.rejects(lireSauvegarde(JSON.stringify(future)), /plus récente/);
});

test("Nom du fichier de sauvegarde", () => {
  assert.equal(nomFichierSauvegarde(new Date(2026, 8, 21, 15, 42)), "carnet-foot-sauvegarde-2026-09-21-1542.json");
});

test("Copie du jour : une seule par jour local", () => {
  const auj = new Date(2026, 8, 21, 23, 50);
  assert.equal(jourLocal(auj), "2026-09-21");
  assert.equal(faireCopieDuJour([], auj), true);
  assert.equal(faireCopieDuJour([{ jour: "2026-09-21", raison: "avant-import" }], auj), true);
  assert.equal(faireCopieDuJour([{ jour: "2026-09-21", raison: "quotidienne" }], auj), false);
  assert.equal(faireCopieDuJour([{ jour: "2026-09-20", raison: "quotidienne" }], auj), true);
});

test("Rotation de l'historique : 30 copies quotidiennes et 15 autres gardées, les plus récentes", () => {
  const v = (i: number, raison: "quotidienne" | "avant-import") => ({
    id: raison + i,
    creeLe: new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString(),
    raison,
  });
  const liste = [...Array.from({ length: 40 }, (_, i) => v(i, "quotidienne")), ...Array.from({ length: 20 }, (_, i) => v(i, "avant-import"))];
  const sup = versionsASupprimer(liste);
  assert.equal(sup.length, 40 - GARDER_QUOTIDIENNES + 20 - GARDER_AUTRES);
  assert.ok(sup.includes("quotidienne0") && !sup.includes("quotidienne39"));
  assert.ok(sup.includes("avant-import0") && !sup.includes("avant-import19"));
});
