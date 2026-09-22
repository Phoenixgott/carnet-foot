/**
 * Simulateur « et si j'avais parié X » : rejoue le journal terminé avec une mise fixe ou un
 * pourcentage de la bankroll, et compare au résultat réel.
 */
import { useState } from "react";
import { eur, lireSaisie, pc } from "../../core/format";
import { simuler, type StrategieSimulation } from "../../core/simulateur";
import { bankrollDe } from "../../data/contenu";
import { ChampMontant, Choix } from "../champs";
import { useAppli } from "../contexte";

type Type = "fixe" | "pourcent";

export function Simulateur() {
  const { contenu } = useAppli();
  const reglages = bankrollDe(contenu);
  const [type, setType] = useState<Type>("fixe");
  const [montant, setMontant] = useState("10");
  const [pct, setPct] = useState(String(reglages.pctMise).replace(".", ","));
  const [depart, setDepart] = useState(String(reglages.depart).replace(".", ","));

  const m = lireSaisie(montant);
  const p = lireSaisie(pct);
  const d = lireSaisie(depart);
  const strategie: StrategieSimulation | null =
    type === "fixe"
      ? typeof m === "number" && m > 0
        ? { type: "fixe", montant: m }
        : null
      : typeof p === "number" && p > 0 && typeof d === "number" && d >= 0
        ? { type: "pourcent", pct: p, bankrollDepart: d }
        : null;
  const r = strategie ? simuler(contenu.paris, strategie) : null;

  return (
    <div className="section" data-test="simulateur">
      <p className="aide">
        Rejoue tes paris terminés avec une autre façon de miser, et compare au résultat réel. Un pari « sécurisé » (freebet, cash-out, couverture…)
        garde son gain réel : sa mise ne se recalcule pas comme celle d'un pari classique.
      </p>
      <Choix<Type> libelle="Façon de miser" valeur={type} options={[["fixe", "Mise fixe"], ["pourcent", "% de la bankroll"]]} changer={setType} />
      {type === "fixe" ? (
        <ChampMontant id="sim-montant" libelle="Mise fixe (€)" valeur={montant} changer={setMontant} placeholder="ex. 10" />
      ) : (
        <div className="grille-champs">
          <ChampMontant id="sim-pct" libelle="% de la bankroll par pari" valeur={pct} changer={setPct} placeholder="ex. 2" />
          <ChampMontant id="sim-depart" libelle="Bankroll de départ (€)" valeur={depart} changer={setDepart} placeholder="ex. 200" />
        </div>
      )}

      {!r ? (
        <p className="bandeau info" data-test="sim-a-saisir">Saisis une mise pour voir la simulation.</p>
      ) : r.nb === 0 ? (
        <p className="vide">Aucun pari terminé à rejouer pour l'instant.</p>
      ) : (
        <div className="tableau-defilant" data-test="sim-resultat">
          <table>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Chiffre</span></th>
                <th scope="col">Simulation</th>
                <th scope="col">Réel</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Paris rejoués</th>
                <td>{r.nb - r.nbNonRejoues} sur {r.nb}</td>
                <td>{r.nb}</td>
              </tr>
              <tr>
                <th scope="row">Gains</th>
                <td className={r.gainsSimules >= 0 ? "pos" : "neg"} data-test="sim-gains">{eur(r.gainsSimules)}</td>
                <td className={r.reel.gains >= 0 ? "pos" : "neg"}>{eur(r.reel.gains)}</td>
              </tr>
              <tr>
                <th scope="row">ROI</th>
                <td data-test="sim-roi">{pc(r.roiSimule)}</td>
                <td>{pc(r.reel.roi)}</td>
              </tr>
              <tr>
                <th scope="row">Drawdown maximal</th>
                <td data-test="sim-drawdown">{eur(r.drawdown.montant)}</td>
                <td>—</td>
              </tr>
              {type === "pourcent" && (
                <tr>
                  <th scope="row">Bankroll finale</th>
                  <td>{eur(r.bankrollFinale)}</td>
                  <td>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {r && r.nbNonRejoues > 0 && (
        <p className="aide">
          {r.nbNonRejoues} pari{r.nbNonRejoues > 1 ? "s" : ""} sécurisé{r.nbNonRejoues > 1 ? "s" : ""} gardé{r.nbNonRejoues > 1 ? "s" : ""} avec son
          gain réel, non rejoué.
        </p>
      )}
    </div>
  );
}
