/**
 * Matchs : récupération des matchs (demande à l'autre conversation Claude, import de sa réponse),
 * puis les matchs chargés avec l'analyse du carnet d'origine (modèle v1) pour +1.5 et +2.5,
 * la fiabilité sur 8 et ce qui manque, les cotes suivies dans le temps.
 * Les chiffres des méthodes sont identiques à ceux du carnet. Toute donnée inconnue est affichée ⏳.
 */
import { useState } from "react";
import { analyser, niveauRisque, type Analyse, type MethodeAnalysee } from "../../core/carnet-v1/analyse";
import { nombreInfos } from "../../core/carnet-v1/fiabilite";
import { alertesCote } from "../../core/cotes";
import { fr } from "../../core/format";
import type { Match } from "../../core/types";
import { jourLocal } from "../../data/versions";
import { Inconnu, PastilleVerdict } from "../composants";
import { useAppli } from "../contexte";
import { Recuperer } from "../matchs/Recuperer";
import { AlerteCotes, margeAffichee, pourcent, SuiviCotes } from "../matchs/SuiviCotes";

const dateLongue = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

function BlocMethode({ methode, a }: { methode: MethodeAnalysee; a: Analyse }) {
  const chances = Number.isFinite(a.p) ? Math.round(a.p * 100) + " %" : null;
  const risque = niveauRisque(a.risk);
  return (
    <div className="methode">
      <div className="methode-nom">
        <span>Méthode {methode}</span>
        <PastilleVerdict v={a.v} />
      </div>
      <div className="methode-chiffres">
        <span>{methode === "+1.5" ? "Chances si 0-0 à la 20ᵉ" : "Chances"}</span>
        <b>{chances ?? <Inconnu />}</b>
      </div>
      <div className="methode-chiffres">
        <span>Cote mini</span>
        <b>{Number.isFinite(a.fair) ? fr(a.fair) : <Inconnu />}</b>
      </div>
      <div className="methode-chiffres">
        <span>Risque</span>
        <b>{risque ? `${risque}/5` : <Inconnu />}</b>
      </div>
      {a.v === "ko" && <p className="aide" style={{ fontSize: 14 }}>{a.ev.why.replace(/^Non : /, "")}</p>}
    </div>
  );
}

/** Fiabilité sur 8 et liste claire de ce qui manque, séparée entre « à compléter » et « publié plus tard ». */
function Fiabilite({ a }: { a: Analyse }) {
  const rel = a.rel;
  const aCompleter = rel.missing.filter((x) => !x.later);
  const plusTard = rel.missing.filter((x) => x.later);
  return (
    <div className="fiabilite">
      <span>
        Infos{" "}
        <span className="jauge" aria-hidden="true">
          {rel.items.map((x, i) => (
            <i key={i} className={x.ok ? "on" : x.part > 0 ? "demi" : x.later ? "tard" : ""} />
          ))}
        </span>{" "}
        <b data-test="infos-sur-8">{nombreInfos(rel)}/8</b> · fiabilité {Math.round(rel.f * 100)} %
      </span>
      {rel.missing.length === 0 ? (
        <span>Rien ne manque.</span>
      ) : (
        <ul className="manques" data-test="manques">
          {aCompleter.map((x) => (
            <li key={x.label}>
              <b>À compléter :</b> {x.label}
              {x.part > 0 ? " (une seule équipe renseignée)" : ""}
            </li>
          ))}
          {plusTard.map((x) => (
            <li key={x.label}>
              <span aria-hidden="true">⏳ </span>
              <b>Publié plus tard :</b> {x.label} (normal avant le jour J)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteMatch({ m }: { m: Match }) {
  const a1 = analyser(m, "+1.5");
  const a3 = analyser(m, "+2.5");
  const marge = margeAffichee(m.cotes);
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
      <div className="match-equipes">
        {m.domicile?.nom ?? "?"}
        <span>–</span>
        {m.exterieur?.nom ?? "?"}
      </div>
      <AlerteCotes m={m} />
      <div className="match-methodes">
        <BlocMethode methode="+1.5" a={a1} />
        <BlocMethode methode="+2.5" a={a3} />
      </div>
      <div className="match-bas">
        <Fiabilite a={a1} />
        <span>
          Marge du bookmaker{" "}
          {marge ? (
            <b>
              {pourcent(marge.marge)} ({marge.ligne})
            </b>
          ) : (
            <Inconnu titre="Il faut les cotes « plus de » et « moins de » d'une même ligne" />
          )}{" "}
          · Marge d'erreur <Inconnu titre="Calculée avec le nouveau modèle, en phase 3" />
        </span>
        <SuiviCotes m={m} />
      </div>
    </article>
  );
}

type Filtre = "tous" | "ok" | "alerte";

export function Matchs() {
  const { contenu } = useAppli();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const aujourdhui = jourLocal(new Date());
  // Ouvert au départ s'il n'y a aucun match à venir (sinon replié : les matchs d'abord).
  const [ouvrirRecuperer] = useState(() => !contenu.matchs.some((m) => !m.date || m.date >= aujourdhui));
  const tries = [...contenu.matchs].sort(
    (x, y) => String(x.date).localeCompare(String(y.date)) || String(x.heure).localeCompare(String(y.heure)),
  );
  const visibles =
    filtre === "ok"
      ? tries.filter((m) => analyser(m, "+1.5").v === "ok" || analyser(m, "+2.5").v === "ok")
      : filtre === "alerte"
        ? tries.filter((m) => alertesCote(m).length > 0)
        : tries;
  const parJour = new Map<string, Match[]>();
  for (const m of visibles) {
    const j = m.date || "";
    parJour.set(j, [...(parJour.get(j) ?? []), m]);
  }

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Matchs</h1>
        <p className="chapeau">
          Analyse du carnet d'origine, avec les mêmes chiffres. Le nouveau modèle (forces d'attaque et de défense, avantage du terrain, marge
          d'erreur) arrive en phase 3.
        </p>
      </div>
      <Recuperer ouvert={ouvrirRecuperer} />
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
        [...parJour.entries()].map(([jour, ms]) => (
          <section className="jour" key={jour} aria-label={jour ? dateLongue(jour) : "Date inconnue"}>
            <h2>{jour ? dateLongue(jour).replace(/^./, (c) => c.toUpperCase()) : "Date inconnue ⏳"}</h2>
            {ms.map((m) => (
              <CarteMatch key={m.id} m={m} />
            ))}
          </section>
        ))
      )}
    </>
  );
}
