/**
 * Mes paris : bilan, journal (ajout, modification, suppression, photo du ticket), statistiques
 * avancées (courbe, drawdown, séries, ventilations) et simulateur « et si j'avais parié X ».
 */
import { useState } from "react";
import { eur, fr, pc } from "../../core/format";
import { bilan } from "../../core/paris";
import { miseConseilleeSelonReglages } from "../../core/mises";
import { reglagesMisesDe } from "../../data/bankroll";
import { bankrollDe } from "../../data/contenu";
import { parametresRoute, useAppli } from "../contexte";
import { Journal } from "../paris/Journal";
import { Simulateur } from "../paris/Simulateur";
import { Statistiques } from "../paris/Statistiques";

type Vue = "journal" | "statistiques" | "simulateur";
const VUES: Vue[] = ["journal", "statistiques", "simulateur"];

export function Paris() {
  const { contenu } = useAppli();
  const [vue, setVue] = useState<Vue>(() => {
    const v = parametresRoute().get("vue");
    return (VUES as string[]).includes(v ?? "") ? (v as Vue) : "journal";
  });
  const reglages = bankrollDe(contenu);
  const b = bilan(contenu.paris, reglages);
  const mise = miseConseilleeSelonReglages({ paris: contenu.paris, reglagesBankroll: reglages, reglagesMises: reglagesMisesDe(contenu) });

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Mes paris</h1>
        <p className="chapeau">Note chaque pari ici : l'app compte ce que tu gagnes et ce que tu perds.</p>
      </div>

      <div className="tuiles">
        <div className="tuile"><small>Bankroll</small><b data-test="bankroll-paris">{eur(b.bankroll)}</b></div>
        <div className="tuile"><small>Gagné / perdu</small><b className={b.gains >= 0 ? "pos" : "neg"}>{eur(b.gains)}</b></div>
        <div className="tuile"><small>Rentabilité</small><b>{pc(b.rentabilite)}</b></div>
        <div className="tuile"><small>Paris gagnés</small><b>{pc(b.tauxReussite)}</b></div>
        {b.parMethode.map((m) => (
          <div className="tuile" key={m.methode}>
            <small>Méthode {m.methode} ({m.nb})</small>
            <b className={m.gains >= 0 ? "pos" : "neg"} data-test={`gains-${m.methode}`}>{eur(m.gains)}</b>
          </div>
        ))}
      </div>
      <p className="aide">
        Bankroll de départ {eur(reglages.depart)} · mise conseillée {eur(mise.montant)} ({fr(reglages.pctMise, 1)} % de la bankroll).{" "}
        <a href="#/reglages">Changer ma bankroll</a>.
      </p>

      <div className="segments" role="group" aria-label="Section">
        <button type="button" aria-pressed={vue === "journal"} onClick={() => setVue("journal")}>Journal</button>
        <button type="button" aria-pressed={vue === "statistiques"} onClick={() => setVue("statistiques")}>Statistiques</button>
        <button type="button" aria-pressed={vue === "simulateur"} onClick={() => setVue("simulateur")}>Simulateur</button>
      </div>
      {vue === "journal" && <Journal />}
      {vue === "statistiques" && <Statistiques />}
      {vue === "simulateur" && <Simulateur />}
    </>
  );
}
