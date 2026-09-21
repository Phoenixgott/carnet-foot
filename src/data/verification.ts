/**
 * Vérification d'une migration : les données relues dans la base sont-elles
 * exactement celles du carnet ? Chaque contrôle produit une ligne lisible.
 *
 * Utilisée deux fois : avant l'écriture (conversion correcte ?) puis après
 * relecture de la base (stockage fidèle ?). Au moindre écart, rien n'est gardé.
 */
import { CODE_CARNET_VERS_METHODE } from "../core/methodes";
import { eur } from "../core/format";
import { bilan, gainsTotaux, parisTermines } from "../core/paris";
import type { Methode } from "../core/types";
import { bankrollDe, jsonCanonique, reglage, type Contenu } from "./contenu";
import type { AnalyseImportCarnet } from "./import-carnet";

export interface LigneVerification {
  /** true = conforme, false = écart, null = information (rien à comparer). */
  ok: boolean | null;
  libelle: string;
  detail: string;
}

export interface RapportVerification {
  ok: boolean;
  lignes: LigneVerification[];
}

const TOLERANCE_EUROS = 0.005;
const egauxEuros = (a: number, b: number) => Math.abs(a - b) < TOLERANCE_EUROS;

export function verifierImportCarnet(a: AnalyseImportCarnet, relu: Contenu): RapportVerification {
  const lignes: LigneVerification[] = [];
  const ajoute = (ok: boolean | null, libelle: string, detail: string) => lignes.push({ ok, libelle, detail });

  // 1. Paris : nombre puis champ par champ
  const src = a.source.paris;
  const paris = [...relu.paris].sort((x, y) => x.ordre - y.ordre);
  ajoute(src.length === paris.length, "Nombre de paris", `carnet ${src.length} · application ${paris.length}`);

  const ecarts: string[] = [];
  src.forEach((b: any, i) => {
    const p = paris[i];
    if (!p) return;
    const attendu = {
      date: typeof b.date === "string" ? b.date : "",
      match: typeof b.match === "string" ? b.match : String(b.match ?? ""),
      methode: (CODE_CARNET_VERS_METHODE[String(b.methode)] ?? "Autre") as Methode,
      cote: Number(b.cote),
      mise: Number(b.mise),
      statut: b.statut,
      pnl: b.pnl === undefined || b.pnl === null ? undefined : Number(b.pnl),
    };
    const obtenu = { date: p.date, match: p.match, methode: p.methode, cote: p.cote, mise: p.mise, statut: p.statut, pnl: p.pnl };
    const champs = (Object.keys(attendu) as Array<keyof typeof attendu>).filter(
      (k) => !Object.is(attendu[k], obtenu[k]) && !(Number.isNaN(attendu[k]) && obtenu[k] === 0),
    );
    if (champs.length) ecarts.push(`pari n° ${i + 1} (${champs.join(", ")})`);
  });
  ajoute(
    ecarts.length === 0 && src.length === paris.length,
    "Paris identiques champ par champ",
    ecarts.length ? "Écarts : " + ecarts.slice(0, 5).join(" ; ") + (ecarts.length > 5 ? " ; …" : "") : `${paris.length} paris comparés : date, match, méthode, cote, mise, résultat, gain saisi`,
  );

  // 2. Matchs : nombre puis contenu complet
  const attendus = new Map(a.source.matchs.map((m) => [String((m as any).id), jsonCanonique(m)]));
  ajoute(
    attendus.size === relu.matchs.length,
    "Nombre de matchs",
    `carnet ${attendus.size} · application ${relu.matchs.length}` +
      (a.matchsExempleIgnores ? ` (${a.matchsExempleIgnores} matchs d'exemple du carnet ignorés)` : ""),
  );
  const matchsDifferents = relu.matchs.filter((m) => attendus.get(m.id) !== jsonCanonique(m)).map((m) => m.id);
  ajoute(
    matchsDifferents.length === 0,
    "Matchs identiques champ par champ",
    matchsDifferents.length ? "Écarts : " + matchsDifferents.slice(0, 5).join(", ") : `${relu.matchs.length} matchs comparés, tous les champs`,
  );

  // 3. Réglages
  const b = bankrollDe(relu);
  const rs = a.source.reglages;
  ajoute(
    !!rs && rs.bank === b.depart && rs.pct === b.pctMise,
    "Bankroll de départ et mise en %",
    `${eur(b.depart)} · ${String(b.pctMise).replace(".", ",")} % par pari`,
  );
  if (a.source.competitions) {
    const c = reglage<string[]>(relu, "competitions") ?? [];
    ajoute(jsonCanonique(c) === jsonCanonique(a.source.competitions), "Compétitions choisies", `${c.length} compétitions`);
  }

  // 4. Valeurs de contrôle calculées par le carnet lui-même
  const k = a.controle;
  const gains = gainsTotaux(relu.paris);
  const bankroll = b.depart + gains;
  if (k) {
    ajoute(parisTermines(relu.paris).length === k.nbParisTermines, "Paris terminés", `carnet ${k.nbParisTermines} · application ${parisTermines(relu.paris).length}`);
    ajoute(egauxEuros(gains, k.gainsTotal), "Gains totaux = carnet", `carnet ${eur(k.gainsTotal)} · application ${eur(gains)}`);
    ajoute(egauxEuros(bankroll, k.bankroll), "Bankroll actuelle = carnet", `carnet ${eur(k.bankroll)} · application ${eur(bankroll)}`);
    const parMethode = bilan(relu.paris, b).parMethode;
    const ecartsMethode = Object.entries(k.parMethode).filter(([code, v]) => {
      const m = CODE_CARNET_VERS_METHODE[code] ?? "Autre";
      const x = parMethode.find((e) => e.methode === m)?.gains ?? 0;
      return !egauxEuros(x, v);
    });
    ajoute(
      ecartsMethode.length === 0,
      "Gains par méthode = carnet",
      Object.entries(k.parMethode)
        .map(([code, v]) => `${CODE_CARNET_VERS_METHODE[code] ?? code} ${eur(v)}`)
        .join(" · ") || "aucun pari terminé",
    );
  } else {
    ajoute(null, "Gains et bankroll recalculés", `gains ${eur(gains)} · bankroll ${eur(bankroll)} (cette sauvegarde ne contient pas de valeurs de contrôle du carnet : compare avec l'en-tête du carnet)`);
  }

  return { ok: lignes.every((l) => l.ok !== false), lignes };
}
