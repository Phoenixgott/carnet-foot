/**
 * Réglages Mises et objectifs : Kelly fractionné, plafonds par pari et par jour (blocage doux :
 * un avertissement, jamais un vrai blocage), objectif de gain et budget mensuel.
 */
import { useState } from "react";
import { lireSaisie } from "../../core/format";
import { completerReglagesMises, type MethodeMise } from "../../core/mises";
import { completerReglagesObjectifs, type ReglagesObjectifs } from "../../core/objectifs";
import { reglagesMisesDe, reglagesObjectifsDe } from "../../data/bankroll";
import { ecrireReglage } from "../../data/depot";
import { ChampMontant, Choix } from "../champs";
import { useAppli } from "../contexte";

const t = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

export function ReglagesMises() {
  const { contenu, recharger, message } = useAppli();
  const mises = reglagesMisesDe(contenu);
  const objectifs = reglagesObjectifsDe(contenu);
  const [fraction, setFraction] = useState(String(mises.fractionKelly).replace(".", ","));
  const [plafondPari, setPlafondPari] = useState(t(mises.plafondParPari));
  const [plafondJour, setPlafondJour] = useState(t(mises.plafondParJour));
  const [gainVise, setGainVise] = useState(t(objectifs.gainVise));
  const [budgetMax, setBudgetMax] = useState(t(objectifs.budgetMax));
  const [erreur, setErreur] = useState<string | null>(null);

  const changerMises = async (methode: MethodeMise) => {
    await ecrireReglage("mises", completerReglagesMises({ ...mises, methode }));
    await recharger();
  };

  const enregistrerMises = async (e: Event) => {
    e.preventDefault();
    const f = lireSaisie(fraction);
    if (f === undefined || f === null || f <= 0 || f > 1) {
      setErreur("Fraction de Kelly : tape un nombre entre 0 (exclu) et 1, par exemple 0,5 pour demi-Kelly.");
      return;
    }
    const pp = lireSaisie(plafondPari);
    const pj = lireSaisie(plafondJour);
    if (pp === undefined || pj === undefined) {
      setErreur("Plafonds : tape un nombre, ou laisse vide pour aucun plafond.");
      return;
    }
    setErreur(null);
    await ecrireReglage("mises", completerReglagesMises({ ...mises, fractionKelly: f, plafondParPari: pp, plafondParJour: pj }));
    await recharger();
    message("Mises enregistrées");
  };

  const enregistrerObjectifs = async (e: Event) => {
    e.preventDefault();
    const g = lireSaisie(gainVise);
    const b = lireSaisie(budgetMax);
    if (g === undefined || b === undefined) {
      setErreur("Objectifs : tape un nombre, ou laisse vide pour aucun objectif.");
      return;
    }
    setErreur(null);
    await ecrireReglage("objectifs", completerReglagesObjectifs({ gainVise: g, budgetMax: b } satisfies ReglagesObjectifs));
    await recharger();
    message("Objectifs enregistrés");
  };

  return (
    <section className="carte" aria-labelledby="titre-mises" data-test="reglages-mises">
      <h2 id="titre-mises">Mises et objectifs</h2>

      <h3>Mise conseillée</h3>
      <Choix<MethodeMise>
        libelle="Façon de calculer la mise conseillée"
        valeur={mises.methode}
        options={[["fixe", "% fixe de la bankroll (règle du carnet)"], ["kelly", "Kelly fractionné"]]}
        changer={changerMises}
      />
      {mises.methode === "kelly" && (
        <p className="aide">
          Utilise la probabilité du nouveau modèle (onglet Matchs) et la cote pour calculer la mise. Sans match lié ou sans probabilité connue, la
          mise fixe est utilisée à la place.
        </p>
      )}
      <form className="section" onSubmit={enregistrerMises}>
        <ChampMontant
          id="mises-fraction"
          libelle="Fraction de Kelly (1 = plein Kelly, 0,5 = demi-Kelly)"
          valeur={fraction}
          changer={setFraction}
          placeholder="ex. 0,5"
        />
        <div className="grille-champs">
          <ChampMontant id="mises-plafond-pari" libelle="Plafond par pari (€, facultatif)" valeur={plafondPari} changer={setPlafondPari} placeholder="ex. 50" />
          <ChampMontant id="mises-plafond-jour" libelle="Plafond par jour (€, facultatif)" valeur={plafondJour} changer={setPlafondJour} placeholder="ex. 100" />
        </div>
        <p className="aide">Un plafond dépassé n'empêche rien : un avertissement s'affiche, la décision reste la tienne.</p>
        {erreur && <p className="bandeau erreur" role="alert">{erreur}</p>}
        <button type="submit" className="btn secondaire">Enregistrer les mises</button>
      </form>

      <h3>Objectif et budget mensuel</h3>
      <form className="section" onSubmit={enregistrerObjectifs}>
        <div className="grille-champs">
          <ChampMontant id="objectifs-gain" libelle="Gain visé ce mois-ci (€, facultatif)" valeur={gainVise} changer={setGainVise} placeholder="ex. 50" />
          <ChampMontant id="objectifs-budget" libelle="Budget maximum misé (€, facultatif)" valeur={budgetMax} changer={setBudgetMax} placeholder="ex. 300" />
        </div>
        <button type="submit" className="btn secondaire">Enregistrer les objectifs</button>
      </form>
    </section>
  );
}
