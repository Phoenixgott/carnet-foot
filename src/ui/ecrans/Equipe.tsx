/**
 * Fiche équipe : chiffres de la saison reçus avec les matchs, et depuis les historiques CSV
 * la forme sur les 10 derniers matchs, les buts, les séries en cours et les confrontations directes.
 */
import { fr, dateCourte } from "../../core/format";
import { ficheEquipe } from "../../core/modele-v2/equipe";
import type { Equipe as DonneesEquipe } from "../../core/types";
import { Inconnu } from "../composants";
import { parametresRoute, useAppli } from "../contexte";

const pc = (x: number) => Math.round(x * 100) + " %";
const COULEUR = { V: "ok", N: "info", D: "ko" } as const;

export function Equipe() {
  const { contenu, resultats } = useAppli();
  const p = parametresRoute();
  const nom = p.get("nom") ?? "";
  const contre = p.get("contre");
  const f = ficheEquipe(nom, resultats, contre);

  // Dernières stats de saison reçues pour cette équipe (le match le plus récent qui la contient)
  const saison: DonneesEquipe | null =
    [...contenu.matchs]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .flatMap((m) => [m.domicile, m.exterieur])
      .find((e) => e?.nom === nom) ?? null;

  return (
    <>
      <div>
        <p className="aide">
          <a href="#/matchs">← Retour aux matchs</a>
        </p>
        <h1 tabIndex={-1}>{nom || "Équipe"}</h1>
        {f.nomHistorique && f.nomHistorique !== nom && <p className="chapeau">Dans les historiques : « {f.nomHistorique} ».</p>}
      </div>

      <section className="carte" aria-labelledby="titre-saison">
        <h2 id="titre-saison">Cette saison (données du match)</h2>
        {saison ? (
          <div className="faits">
            <div className="fait"><span>Matchs joués</span><b>{saison.joues ?? <Inconnu />}</b></div>
            <div className="fait">
              <span>Buts marqués · encaissés par match</span>
              <b>
                {saison.joues && saison.marques != null && saison.encaisses != null
                  ? `${fr(saison.marques / saison.joues, 1)} · ${fr(saison.encaisses / saison.joues, 1)}`
                  : <Inconnu />}
              </b>
            </div>
            <div className="fait"><span>Matchs à 2+ buts</span><b>{saison.pctOver15 != null ? saison.pctOver15 + " %" : <Inconnu />}</b></div>
            <div className="fait"><span>Matchs à 3+ buts</span><b>{saison.pctOver25 != null ? saison.pctOver25 + " %" : <Inconnu />}</b></div>
            <div className="fait">
              <span>Buts sur les derniers matchs</span>
              <b>{saison.derniersButsMarques?.length ? saison.derniersButsMarques.map((x) => (x === null ? "?" : x)).join(", ") : <Inconnu />}</b>
            </div>
          </div>
        ) : (
          <p className="aide">Aucun match chargé avec cette équipe.</p>
        )}
      </section>

      {!f.nomHistorique ? (
        <section className="carte" aria-labelledby="titre-histo">
          <h2 id="titre-histo">Historique</h2>
          <p className="vide" data-test="pas-d-historique">
            Pas d'historique pour cette équipe. Importe le fichier CSV de son championnat dans l'onglet « Données » (football-data.co.uk).
          </p>
        </section>
      ) : (
        <>
          <section className="carte" aria-labelledby="titre-forme" data-test="forme">
            <h2 id="titre-forme">Forme : {f.derniers.length} derniers matchs</h2>
            <p className="forme" aria-label="Résultats du plus récent au plus ancien">
              {f.derniers.map((l, i) => (
                <span key={i} className={`pastille-ico ${COULEUR[l.resultat]}`}>{l.resultat}</span>
              ))}
            </p>
            {f.bilan && (
              <div className="faits">
                <div className="fait"><span>Victoires · nuls · défaites</span><b>{f.bilan.victoires} · {f.bilan.nuls} · {f.bilan.defaites}</b></div>
                <div className="fait"><span>Buts marqués · encaissés</span><b>{f.bilan.marques} · {f.bilan.encaisses}</b></div>
                <div className="fait"><span>Buts par match (total)</span><b>{fr(f.bilan.butsParMatch)}</b></div>
                <div className="fait"><span>Matchs à 2+ · 3+ buts</span><b>{pc(f.bilan.part2plus)} · {pc(f.bilan.part3plus)}</b></div>
                <div className="fait"><span>Les deux équipes marquent</span><b>{pc(f.bilan.lesDeuxMarquent)}</b></div>
              </div>
            )}
            <ul className="liste-simple">
              {f.derniers.map((l, i) => (
                <li key={i}>
                  <b>
                    {l.resultat} {l.marques}-{l.encaisses}
                  </b>{" "}
                  {l.aDomicile ? "contre" : "à"} {l.adversaire}
                  <small>
                    {dateCourte(l.date)} {l.date.slice(0, 4)} · {l.championnat}
                  </small>
                </li>
              ))}
            </ul>
          </section>

          <section className="carte" aria-labelledby="titre-series" data-test="series">
            <h2 id="titre-series">Séries en cours</h2>
            {f.series.length ? (
              <ul className="liste-simple">
                {f.series.map((s) => (
                  <li key={s.texte}>{s.texte}</li>
                ))}
              </ul>
            ) : (
              <p className="aide">Aucune série de 3 matchs ou plus en ce moment.</p>
            )}
          </section>

          {contre && (
            <section className="carte" aria-labelledby="titre-h2h" data-test="confrontations">
              <h2 id="titre-h2h">Contre {contre}</h2>
              {f.confrontations.length ? (
                <>
                  <p className="aide">
                    {f.confrontations.length} confrontation{f.confrontations.length > 1 ? "s" : ""} dans tes historiques, dont{" "}
                    {f.confrontations.filter((c) => c.total >= 3).length} à 3 buts ou plus.
                  </p>
                  <ul className="liste-simple">
                    {f.confrontations.map((l, i) => (
                      <li key={i}>
                        <b>
                          {l.resultat} {l.marques}-{l.encaisses}
                        </b>{" "}
                        {l.aDomicile ? "à domicile" : "à l'extérieur"}
                        <small>
                          {dateCourte(l.date)} {l.date.slice(0, 4)} · {l.championnat}
                        </small>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="aide">Aucune confrontation dans tes historiques.</p>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
