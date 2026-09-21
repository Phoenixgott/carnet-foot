/**
 * Matchs : les matchs chargés, avec l'analyse du carnet d'origine (modèle v1)
 * pour les méthodes +1.5 et +2.5. Les chiffres sont identiques à ceux du carnet.
 * Toute donnée inconnue est affichée ⏳.
 */
import { useState } from "react";
import { analyser, niveauRisque, type Analyse, type MethodeAnalysee } from "../../core/carnet-v1/analyse";
import { nombreInfos } from "../../core/carnet-v1/fiabilite";
import { fr } from "../../core/format";
import type { Match } from "../../core/types";
import { Inconnu, PastilleVerdict } from "../composants";
import { useAppli } from "../contexte";

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

function CarteMatch({ m }: { m: Match }) {
  const a1 = analyser(m, "+1.5");
  const a3 = analyser(m, "+2.5");
  const rel = a1.rel;
  const manque = rel.missing.map((x) => (x.later ? "⏳ " : "") + x.label.replace(/ \(.*\)$/, ""));
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
      <div className="match-methodes">
        <BlocMethode methode="+1.5" a={a1} />
        <BlocMethode methode="+2.5" a={a3} />
      </div>
      <div className="match-bas">
        <span>
          Infos{" "}
          <span className="jauge" aria-hidden="true">
            {rel.items.map((x, i) => (
              <i key={i} className={x.ok ? "on" : x.part > 0 ? "demi" : x.later ? "tard" : ""} />
            ))}
          </span>{" "}
          <b>{nombreInfos(rel)}/8</b>
        </span>
        <span>{manque.length ? "Manque : " + manque.join(", ") : "Rien ne manque"}</span>
        <span>
          Marge du bookmaker <Inconnu titre="Il faut aussi les cotes « moins de » : elles seront demandées à partir de la phase 2" /> · Marge d'erreur{" "}
          <Inconnu titre="Calculée avec le nouveau modèle, en phase 3" />
        </span>
      </div>
    </article>
  );
}

export function Matchs() {
  const { contenu } = useAppli();
  const [filtre, setFiltre] = useState<"tous" | "ok">("tous");
  const tries = [...contenu.matchs].sort(
    (x, y) => String(x.date).localeCompare(String(y.date)) || String(x.heure).localeCompare(String(y.heure)),
  );
  const visibles = filtre === "ok" ? tries.filter((m) => analyser(m, "+1.5").v === "ok" || analyser(m, "+2.5").v === "ok") : tries;
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
      <div className="segments" role="group" aria-label="Filtrer les matchs">
        <button type="button" aria-pressed={filtre === "tous"} onClick={() => setFiltre("tous")}>Tous</button>
        <button type="button" aria-pressed={filtre === "ok"} onClick={() => setFiltre("ok")}>Seulement « On joue »</button>
      </div>
      {visibles.length === 0 ? (
        <p className="vide">
          {contenu.matchs.length ? "Aucun match « On joue » pour l'instant." : "Aucun match. Importe l'export de ton carnet dans l'onglet « Données »."}
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
