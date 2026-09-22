/**
 * Statistiques avancées : courbe de bankroll, drawdown maximal, séries en cours,
 * ROI et taux de réussite ventilés par méthode, compétition, jour de la semaine et tranche de cote.
 */
import { courbeBankroll, drawdownMax, parCompetition, parJourSemaine, parMethode, parTrancheCote, series } from "../../core/bankroll";
import { eur, pc } from "../../core/format";
import { bankrollDe } from "../../data/contenu";
import { useAppli } from "../contexte";
import { BarreVentilation } from "./BarreVentilation";
import { GraphiqueBankroll } from "./GraphiqueBankroll";

const LIBELLE_SERIE = { victoire: "victoires", defaite: "défaites", neutre: "aucune" } as const;

export function Statistiques() {
  const { contenu } = useAppli();
  const reglages = bankrollDe(contenu);
  const courbe = courbeBankroll(contenu.paris, reglages);
  const dd = drawdownMax(courbe);
  const s = series(contenu.paris);
  const nbTermines = courbe.length - 1;

  if (nbTermines === 0) {
    return (
      <p className="vide" data-test="stats-vide">
        Aucun pari terminé pour l'instant : les statistiques apparaîtront avec tes premiers résultats.
      </p>
    );
  }

  return (
    <div className="section" data-test="statistiques">
      <section className="carte" aria-labelledby="titre-courbe">
        <h3 id="titre-courbe">Bankroll</h3>
        <GraphiqueBankroll courbe={courbe} />
      </section>

      <div className="tuiles">
        <div className="tuile">
          <small>Drawdown maximal</small>
          <b className="neg" data-test="drawdown">{eur(dd.montant)}</b>
          <small>{Number.isFinite(dd.pct) ? pc(dd.pct) + " du sommet" : ""}</small>
        </div>
        <div className="tuile">
          <small>Série en cours</small>
          <b className={s.actuelle.type === "victoire" ? "pos" : s.actuelle.type === "defaite" ? "neg" : ""} data-test="serie-actuelle">
            {s.actuelle.longueur || "—"} {s.actuelle.longueur ? LIBELLE_SERIE[s.actuelle.type] : ""}
          </b>
        </div>
        <div className="tuile">
          <small>Meilleure série</small>
          <b className="pos">{s.meilleureVictoires} victoires</b>
        </div>
        <div className="tuile">
          <small>Pire série</small>
          <b className="neg">{s.pireDefaites} défaites</b>
        </div>
      </div>

      <section className="carte" aria-labelledby="titre-methode">
        <h3 id="titre-methode">Par méthode</h3>
        <BarreVentilation lignes={parMethode(contenu.paris)} />
      </section>
      <section className="carte" aria-labelledby="titre-competition">
        <h3 id="titre-competition">Par compétition</h3>
        <BarreVentilation lignes={parCompetition(contenu.paris)} />
      </section>
      <section className="carte" aria-labelledby="titre-jour">
        <h3 id="titre-jour">Par jour de la semaine</h3>
        <BarreVentilation lignes={parJourSemaine(contenu.paris)} />
      </section>
      <section className="carte" aria-labelledby="titre-tranche">
        <h3 id="titre-tranche">Par tranche de cote</h3>
        <BarreVentilation lignes={parTrancheCote(contenu.paris)} />
      </section>
    </div>
  );
}
