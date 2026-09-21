/**
 * Données : import depuis le carnet, vérification, sauvegarde et versions.
 * Les exports de test sont produits par le VRAI code d'export du carnet
 * (fonction fullExportText de l'artefact), pour coller à la réalité.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnetOriginal } from "../helpers/carnet-original";
import { aleatoire, matchAleatoire, pariCarnetAleatoire } from "../helpers/generateurs";
import { analyserTexteCarnet, ErreurImport } from "../../src/data/import-carnet";
import { verifierImportCarnet } from "../../src/data/verification";
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

test("Export complet du carnet : conversion fidèle et contrôles tous verts", () => {
  for (const graine of [1, 2, 3, 4, 5]) {
    const a = analyserTexteCarnet(exportCarnet({ graine }), MAINTENANT, ids);
    assert.equal(a.format, "export-complet");
    assert.equal(a.contenu.paris.length, 25);
    assert.equal(a.contenu.matchs.length, 8);
    assert.ok(a.controle);
    const rapport = verifierImportCarnet(a, a.contenu);
    assert.ok(rapport.ok, JSON.stringify(rapport.lignes, null, 1));
    assert.ok(rapport.lignes.some((l) => l.libelle === "Bankroll actuelle = carnet" && l.ok === true));
    // Méthodes : croisement m1/m3/m2 respecté
    a.contenu.paris.forEach((p, i) => {
      const code = (a.source.paris[i] as any).methode;
      assert.equal(p.methode, { m1: "+1.5", m3: "+2.5", m2: "Freebet", autre: "Autre" }[code as string]);
      assert.equal(p.ordre, i);
    });
  }
});

test("Export entouré de texte (copié-collé approximatif) : accepté", () => {
  const t = "Voici mon export :\n" + exportCarnet() + "\nmerci";
  const a = analyserTexteCarnet(t, MAINTENANT, ids);
  assert.equal(a.contenu.paris.length, 25);
});

test("La vérification détecte chaque type d'écart", () => {
  const a = analyserTexteCarnet(exportCarnet({ graine: 9 }), MAINTENANT, ids);
  const altere = (f: (c: Contenu) => void) => {
    const c: Contenu = JSON.parse(JSON.stringify(a.contenu));
    f(c);
    return verifierImportCarnet(a, c);
  };
  const echoue = (r: ReturnType<typeof altere>, libelle: string) => {
    assert.equal(r.ok, false);
    assert.ok(r.lignes.some((l) => l.libelle === libelle && l.ok === false), `contrôle « ${libelle} » attendu en échec`);
  };
  echoue(altere((c) => c.paris.pop()), "Nombre de paris");
  echoue(altere((c) => (c.paris[3].cote += 0.01)), "Paris identiques champ par champ");
  echoue(altere((c) => (c.paris[0].methode = c.paris[0].methode === "+1.5" ? "+2.5" : "+1.5")), "Paris identiques champ par champ");
  echoue(altere((c) => c.matchs.pop()), "Nombre de matchs");
  echoue(altere((c) => ((c.matchs[2] as any).moyenneButsLigue = 9.99)), "Matchs identiques champ par champ");
  echoue(altere((c) => ((c.reglages.find((r) => r.cle === "bankroll")!.valeur as any).depart = 1)), "Bankroll de départ et mise en %");
  echoue(altere((c) => (c.reglages.find((r) => r.cle === "competitions")!.valeur = ["Ligue 1"])), "Compétitions choisies");
});

test("Les valeurs de contrôle du carnet sont comparées aux calculs de l'app", () => {
  const texte = exportCarnet({ graine: 11 });
  const falsifie = JSON.parse(texte);
  falsifie.controle.gainsTotal += 1;
  falsifie.controle.bankroll += 1;
  const a = analyserTexteCarnet(JSON.stringify(falsifie), MAINTENANT, ids);
  const r = verifierImportCarnet(a, a.contenu);
  assert.equal(r.ok, false);
  assert.ok(r.lignes.some((l) => l.libelle === "Gains totaux = carnet" && l.ok === false));
});

test("Matchs d'exemple du carnet : ignorés et signalés", () => {
  const a = analyserTexteCarnet(exportCarnet({ exemple: true }), MAINTENANT, ids);
  assert.equal(a.contenu.matchs.length, 0);
  assert.equal(a.matchsExempleIgnores, 8);
  assert.ok(verifierImportCarnet(a, a.contenu).ok);
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
  const v = verifierImportCarnet(a, a.contenu);
  assert.ok(v.ok);
  assert.ok(v.lignes.some((l) => l.ok === null));
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
