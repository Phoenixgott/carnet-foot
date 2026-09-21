/**
 * Matchs : récupération des matchs, puis leur analyse.
 *
 * Nouveau modèle (phase 3) : probabilité avec sa fourchette, cote juste, cote minimale,
 * value, risque, verdict expliqué en une phrase, détail du calcul. Les chiffres du carnet
 * d'origine restent affichés à côté pendant la transition.
 * Tri par heure ou par intérêt, comparaison de deux matchs côte à côte, fiches équipe.
 * Toute donnée inconnue est affichée ⏳.
 */
import { useState } from "react";
import { analyser, type Analyse } from "../../core/carnet-v1/analyse";
import { nombreInfos } from "../../core/carnet-v1/fiabilite";
import type { EtatCritere } from "../../core/carnet-v1/criteres";
import { alertesCote } from "../../core/cotes";
import { dateCourte, fr } from "../../core/format";
import { analyserV2, type AnalyseV2 } from "../../core/modele-v2/analyse";
import { interet, type Interet } from "../../core/modele-v2/interet";
import type { Match } from "../../core/types";
import { jourLocal } from "../../data/versions";
import { Inconnu, PastilleVerdict } from "../composants";
import { lienEquipe, useAppli } from "../contexte";
import { Recuperer } from "../matchs/Recuperer";
import { AlerteCotes, margeAffichee, pourcent, SuiviCotes } from "../matchs/SuiviCotes";

const dateLongue = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};
const pct = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) + " %" : null);
const signe = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(Math.round(x * 100)) + " %";
const nomMatch = (m: Match) => `${m.domicile?.nom ?? "?"} – ${m.exterieur?.nom ?? "?"}`;

const ICONE_CRITERE = (ok: EtatCritere): [string, string] =>
  ok === true ? ["ok", "✓"] : ok === false ? ["ko", "✕"] : ok === "plus" ? ["plus", "+"] : ["info", "!"];

export interface AnalyseMatch {
  m: Match;
  v15: AnalyseV2;
  v25: AnalyseV2;
  c15: Analyse;
  c25: Analyse;
  interet: Interet;
}

function Pourquoi({ a }: { a: AnalyseV2 }) {
  return (
    <details className="repli pourquoi">
      <summary>Pourquoi ?</summary>
      <ul className="criteres">
        {a.ev.c.map((c, i) => {
          const [classe, icone] = ICONE_CRITERE(c.ok);
          return (
            <li key={i}>
              <span className={`pastille-ico ${classe}`} aria-hidden="true">{icone}</span>
              <div>
                {c.t}
                {c.d && <small>{c.d}</small>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="aide">Calcul :</p>
      <ul className="calcul">
        {[...a.est.details, ...a.details].map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </details>
  );
}

function BlocMethode({ a, carnet }: { a: AnalyseV2; carnet: Analyse }) {
  const chances = pct(a.p);
  return (
    <div className="methode" data-test={`methode-${a.methode}`}>
      <div className="methode-nom">
        <span>Méthode {a.methode}</span>
        <PastilleVerdict v={a.v} />
      </div>
      <div className="methode-chiffres">
        <span>{a.methode === "+1.5" ? "Chances si 0-0 à la 20ᵉ" : "Chances"}</span>
        <b data-test="chances">
          {chances ?? <Inconnu />}
          {chances && <small className="fourchette"> ({Math.round(a.pBas * 100)}-{Math.round(a.pHaut * 100)} %)</small>}
        </b>
      </div>
      <div className="methode-chiffres">
        <span>Cote juste · mini</span>
        <b data-test="cotes-calculees">
          {Number.isFinite(a.coteJuste) ? fr(a.coteJuste) : <Inconnu />} · {Number.isFinite(a.coteMinimale) ? fr(a.coteMinimale) : <Inconnu />}
        </b>
      </div>
      {a.methode === "+2.5" && (
        <div className="methode-chiffres">
          <span>Cote · value</span>
          <b data-test="value">
            {a.cote !== null ? fr(a.cote) : <Inconnu titre="Cote inconnue" />} ·{" "}
            {Number.isFinite(a.value) ? <span className={a.value >= 0 ? "pos" : "neg"}>{signe(a.value)}</span> : <Inconnu titre="Value : il faut la cote" />}
          </b>
        </div>
      )}
      <div className="methode-chiffres">
        <span>Risque</span>
        <b>{a.niveauRisque ? `${a.niveauRisque}/5` : <Inconnu />}</b>
      </div>
      <p className="pourquoi-phrase" data-test="why">{a.why}</p>
      <p className="carnet-ligne" data-test="carnet">
        Carnet : <span data-test="chances-carnet">{Number.isFinite(carnet.p) ? Math.round(carnet.p * 100) + " %" : "?"}</span>
        {Number.isFinite(carnet.fair) ? ` · cote mini ${fr(carnet.fair)}` : ""}
      </p>
      <Pourquoi a={a} />
    </div>
  );
}

function CarteMatch({ x, rang, comparer, compare }: { x: AnalyseMatch; rang: number | null; comparer: () => void; compare: boolean }) {
  const { m } = x;
  const marge = margeAffichee(m.cotes);
  const rel = x.v15.rel;
  const aCompleter = rel.missing.filter((i) => !i.later);
  const plusTard = rel.missing.filter((i) => i.later);
  return (
    <article className="match" aria-label={`${m.domicile?.nom ?? "?"} contre ${m.exterieur?.nom ?? "?"}`}>
      <div className="match-haut">
        <span>
          {m.ligue || <Inconnu />}
          {m.feminin ? " · Féminin" : ""}
          {m.selection ? " · Sélections" : ""}
        </span>
        <span>{m.heure || <Inconnu titre="Heure inconnue" />}</span>
      </div>
      {rang !== null && (
        <p className="rang" data-test="rang">
          n° {rang} · {x.interet.raison}
        </p>
      )}
      <div className="match-equipes">
        <a href={lienEquipe(m.domicile?.nom ?? "", m.exterieur?.nom)}>{m.domicile?.nom ?? "?"}</a>
        <span>–</span>
        <a href={lienEquipe(m.exterieur?.nom ?? "", m.domicile?.nom)}>{m.exterieur?.nom ?? "?"}</a>
      </div>
      <AlerteCotes m={m} />
      <div className="match-methodes">
        <BlocMethode a={x.v15} carnet={x.c15} />
        <BlocMethode a={x.v25} carnet={x.c25} />
      </div>
      <div className="match-bas">
        <div className="fiabilite">
          <span>
            Infos{" "}
            <span className="jauge" aria-hidden="true">
              {rel.items.map((i, k) => (
                <i key={k} className={i.ok ? "on" : i.part > 0 ? "demi" : i.later ? "tard" : ""} />
              ))}
            </span>{" "}
            <b data-test="infos-sur-8">{nombreInfos(rel)}/8</b> · fiabilité {Math.round(rel.f * 100)} %
          </span>
          {rel.missing.length === 0 ? (
            <span>Rien ne manque.</span>
          ) : (
            <ul className="manques" data-test="manques">
              {aCompleter.map((i) => (
                <li key={i.label}>
                  <b>À compléter :</b> {i.label}
                  {i.part > 0 ? " (une seule équipe renseignée)" : ""}
                </li>
              ))}
              {plusTard.map((i) => (
                <li key={i.label}>
                  <span aria-hidden="true">⏳ </span>
                  <b>Publié plus tard :</b> {i.label} (normal avant le jour J)
                </li>
              ))}
            </ul>
          )}
        </div>
        <span>
          Buts attendus <b data-test="lambda">{x.v25.est.ok ? `${fr(x.v25.est.lambda)} ± ${fr(x.v25.est.sigma)}` : "⏳"}</b> · Marge du bookmaker{" "}
          {marge ? (
            <b>
              {pourcent(marge.marge)} ({marge.ligne})
            </b>
          ) : (
            <Inconnu titre="Il faut les cotes « plus de » et « moins de » d'une même ligne" />
          )}
        </span>
        <button type="button" className="btn discret" aria-pressed={compare} onClick={comparer}>
          {compare ? "✓ Dans la comparaison" : "Comparer"}
        </button>
        <SuiviCotes m={m} />
      </div>
    </article>
  );
}

function Comparaison({ a, b, fermer }: { a: AnalyseMatch; b: AnalyseMatch; fermer: () => void }) {
  const lignes: Array<[string, (x: AnalyseMatch) => string]> = [
    ["Compétition", (x) => x.m.ligue || "⏳"],
    ["Date", (x) => `${x.m.date ? dateCourte(x.m.date) : "⏳"} ${x.m.heure ?? ""}`],
    ["Buts attendus", (x) => (x.v25.est.ok ? `${fr(x.v25.est.lambda)} ± ${fr(x.v25.est.sigma)}` : "⏳")],
    ["+1.5 : verdict", (x) => ({ ok: "✅ On joue", mid: "⏳ À revoir", ko: "❌ On passe" })[x.v15.v]],
    ["+1.5 : chances (0-0 à la 20ᵉ)", (x) => pct(x.v15.p) ?? "⏳"],
    ["+1.5 : cote mini", (x) => (Number.isFinite(x.v15.coteMinimale) ? fr(x.v15.coteMinimale) : "⏳")],
    ["+2.5 : verdict", (x) => ({ ok: "✅ On joue", mid: "⏳ À revoir", ko: "❌ On passe" })[x.v25.v]],
    ["+2.5 : chances", (x) => (pct(x.v25.p) ? `${pct(x.v25.p)} (${Math.round(x.v25.pBas * 100)}-${Math.round(x.v25.pHaut * 100)})` : "⏳")],
    ["+2.5 : cote juste · mini", (x) => (Number.isFinite(x.v25.coteJuste) ? `${fr(x.v25.coteJuste)} · ${fr(x.v25.coteMinimale)}` : "⏳")],
    ["+2.5 : cote · value", (x) => (x.v25.cote !== null ? `${fr(x.v25.cote)} · ${signe(x.v25.value)}` : "⏳")],
    ["Risque +1.5 · +2.5", (x) => `${x.v15.niveauRisque || "⏳"}/5 · ${x.v25.niveauRisque || "⏳"}/5`],
    ["Infos", (x) => `${nombreInfos(x.v15.rel)}/8`],
    ["Intérêt", (x) => x.interet.raison],
  ];
  return (
    <section className="carte comparaison" aria-labelledby="titre-comparaison" data-test="comparaison">
      <h2 id="titre-comparaison">Comparaison</h2>
      <div className="tableau-defilant">
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Critère</span></th>
              <th scope="col">{nomMatch(a.m)}</th>
              <th scope="col">{nomMatch(b.m)}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(([libelle, f]) => (
              <tr key={libelle}>
                <th scope="row">{libelle}</th>
                <td>{f(a)}</td>
                <td>{f(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn secondaire" onClick={fermer}>Fermer la comparaison</button>
    </section>
  );
}

type Filtre = "tous" | "ok" | "alerte";
type Tri = "heure" | "interet";

export function Matchs() {
  const { contenu, contexteDe } = useAppli();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [tri, setTri] = useState<Tri>("heure");
  const [compares, setCompares] = useState<string[]>([]);
  const aujourdhui = jourLocal(new Date());
  // Ouvert au départ s'il n'y a aucun match à venir (sinon replié : les matchs d'abord).
  const [ouvrirRecuperer] = useState(() => !contenu.matchs.some((m) => !m.date || m.date >= aujourdhui));

  const analyses: AnalyseMatch[] = contenu.matchs.map((m) => {
    const ctx = contexteDe(m);
    const v15 = analyserV2(m, "+1.5", ctx);
    const v25 = analyserV2(m, "+2.5", ctx);
    return { m, v15, v25, c15: analyser(m, "+1.5"), c25: analyser(m, "+2.5"), interet: interet([v15, v25]) };
  });
  const parHeure = (x: AnalyseMatch, y: AnalyseMatch) =>
    String(x.m.date).localeCompare(String(y.m.date)) || String(x.m.heure).localeCompare(String(y.m.heure));
  const tries = [...analyses].sort((x, y) =>
    tri === "interet" ? String(x.m.date).localeCompare(String(y.m.date)) || y.interet.note - x.interet.note : parHeure(x, y),
  );
  const visibles =
    filtre === "ok"
      ? tries.filter((x) => x.v15.v === "ok" || x.v25.v === "ok")
      : filtre === "alerte"
        ? tries.filter((x) => alertesCote(x.m, contexteDe).length > 0)
        : tries;
  const parJour = new Map<string, AnalyseMatch[]>();
  for (const x of visibles) {
    const j = x.m.date || "";
    parJour.set(j, [...(parJour.get(j) ?? []), x]);
  }
  const basculerComparaison = (id: string) =>
    setCompares((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  const aComparer = compares.map((id) => analyses.find((x) => x.m.id === id)).filter((x): x is AnalyseMatch => !!x);

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Matchs</h1>
        <p className="chapeau">
          Nouveau modèle : forces d'attaque et de défense, avantage du terrain, forme, absents, avec sa marge d'erreur. Les chiffres du carnet
          restent affichés à côté.
        </p>
      </div>
      <Recuperer ouvert={ouvrirRecuperer} />
      {aComparer.length === 2 && <Comparaison a={aComparer[0]} b={aComparer[1]} fermer={() => setCompares([])} />}
      {aComparer.length === 1 && (
        <p className="bandeau info" role="status">
          Choisis un 2ᵉ match à comparer avec {nomMatch(aComparer[0].m)}.
        </p>
      )}
      <div className="segments" role="group" aria-label="Trier les matchs">
        <button type="button" aria-pressed={tri === "heure"} onClick={() => setTri("heure")}>Par heure</button>
        <button type="button" aria-pressed={tri === "interet"} onClick={() => setTri("interet")}>Par intérêt</button>
      </div>
      <div className="segments" role="group" aria-label="Filtrer les matchs">
        <button type="button" aria-pressed={filtre === "tous"} onClick={() => setFiltre("tous")}>Tous</button>
        <button type="button" aria-pressed={filtre === "ok"} onClick={() => setFiltre("ok")}>Seulement « On joue »</button>
        <button type="button" aria-pressed={filtre === "alerte"} onClick={() => setFiltre("alerte")}>Cote atteinte</button>
      </div>
      {visibles.length === 0 ? (
        <p className="vide">
          {!contenu.matchs.length
            ? "Aucun match. Récupère ceux du jour ci-dessus, ou importe l'export de ton carnet dans l'onglet « Données »."
            : filtre === "alerte"
              ? "Aucune cote n'a atteint sa cote minimale pour l'instant."
              : "Aucun match « On joue » pour l'instant."}
        </p>
      ) : (
        [...parJour.entries()].map(([jour, xs]) => (
          <section className="jour" key={jour} aria-label={jour ? dateLongue(jour) : "Date inconnue"}>
            <h2>{jour ? dateLongue(jour).replace(/^./, (c) => c.toUpperCase()) : "Date inconnue ⏳"}</h2>
            {xs.map((x, i) => (
              <CarteMatch
                key={x.m.id}
                x={x}
                rang={tri === "interet" ? i + 1 : null}
                compare={compares.includes(x.m.id)}
                comparer={() => basculerComparaison(x.m.id)}
              />
            ))}
          </section>
        ))
      )}
    </>
  );
}
