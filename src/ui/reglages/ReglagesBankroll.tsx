/**
 * Ma bankroll : la somme de départ de l'utilisateur et la part misée par pari. Chacun a la sienne
 * (33 €, 200 €, 1 000 €…) : c'est le premier réglage demandé à un nouvel utilisateur.
 */
import { useState } from "react";
import { eur, lireSaisie } from "../../core/format";
import { bankrollDe, reglagesBankrollValides } from "../../data/contenu";
import { ecrireReglage } from "../../data/depot";
import { creerVersion } from "../../data/services";
import { ChampMontant } from "../champs";
import { useAppli } from "../contexte";

const t = (v: number) => String(v).replace(".", ",");

export function ReglagesBankroll() {
  const { contenu, recharger, message } = useAppli();
  const b = bankrollDe(contenu);
  const [depart, setDepart] = useState(t(b.depart));
  const [pct, setPct] = useState(t(b.pctMise));
  const [erreur, setErreur] = useState<string | null>(null);
  const mise = lireSaisie(depart);
  const p = lireSaisie(pct);

  const enregistrer = async (e: Event) => {
    e.preventDefault();
    const r = reglagesBankrollValides(mise, p);
    if (!r) {
      setErreur("Bankroll : un montant supérieur à 0 (ex. 33). Mise : un pourcentage entre 0,1 et 100 (ex. 2).");
      return;
    }
    setErreur(null);
    await creerVersion("avant-modification");
    await ecrireReglage("bankroll", r);
    await recharger();
    message("Bankroll enregistrée");
  };

  return (
    <section className="carte" aria-labelledby="titre-bankroll-reglages" data-test="reglages-bankroll">
      <h2 id="titre-bankroll-reglages">Ma bankroll</h2>
      <p className="aide">La somme avec laquelle tu as commencé. Tous tes gains et pertes sont comptés à partir d'elle.</p>
      <form className="section" onSubmit={enregistrer}>
        <div className="grille-champs">
          <ChampMontant id="bankroll-depart" libelle="Bankroll de départ (€)" valeur={depart} changer={setDepart} placeholder="ex. 33" />
          <ChampMontant id="bankroll-pct" libelle="Mise conseillée (% de la bankroll)" valeur={pct} changer={setPct} placeholder="ex. 2" />
        </div>
        {typeof mise === "number" && typeof p === "number" && mise > 0 && p > 0 && (
          <p className="aide" data-test="bankroll-exemple">Avec {eur(mise)} et {t(p)} %, la mise conseillée au départ est de {eur((mise * p) / 100)}.</p>
        )}
        {erreur && <p className="bandeau erreur" role="alert">{erreur}</p>}
        <button type="submit" className="btn">Enregistrer ma bankroll</button>
      </form>
    </section>
  );
}
