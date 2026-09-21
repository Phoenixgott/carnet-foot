/**
 * Freebet : calculateur (profit garanti par couverture), comparateur (quel match choisir),
 * suivi des offres (date limite, statut, rappels). Seule méthode garantie mathématiquement,
 * à condition que les deux paris soient acceptés aux cotes saisies.
 */
import { useEffect, useState } from "react";
import type { Candidat } from "../../core/freebet-comparateur";
import { fr } from "../../core/format";
import { offresARappeler, type OffreFreebet } from "../../core/offres";
import { offresDe } from "../../data/offres";
import { jourLocal } from "../../data/versions";
import { parametresRoute, useAppli } from "../contexte";
import { Calculateur, CALCUL_VIDE, type SaisieCalcul } from "../freebet/Calculateur";
import { Comparateur, COMPARATEUR_VIDE, type ReglagesComparateur } from "../freebet/Comparateur";
import { Offres } from "../freebet/Offres";

type Vue = "calcul" | "comparateur" | "offres";
const VUES: Vue[] = ["calcul", "comparateur", "offres"];

export function Freebet() {
  const { contenu } = useAppli();
  const [vue, setVue] = useState<Vue>("calcul");
  const [calcul, setCalcul] = useState<SaisieCalcul>(CALCUL_VIDE);
  const [offreDuCalcul, setOffreDuCalcul] = useState<OffreFreebet | null>(null);
  const [comparateur, setComparateur] = useState<ReglagesComparateur>(COMPARATEUR_VIDE);
  const offres = offresDe(contenu);
  const bientot = offresARappeler(offres, jourLocal(new Date())).length;

  // Vue demandée par l'adresse (« #/freebet?vue=offres », depuis l'accueil ou une notification)
  const demande = parametresRoute().get("vue");
  useEffect(() => {
    if (demande && (VUES as string[]).includes(demande)) {
      setVue(demande as Vue);
      history.replaceState(null, "", "#/freebet");
    }
  }, [demande]);

  const changerCalcul = (p: Partial<SaisieCalcul>) => setCalcul((c) => ({ ...c, ...p }));

  const calculerOffre = (o: OffreFreebet) => {
    setOffreDuCalcul(o);
    setCalcul({
      ...CALCUL_VIDE,
      rembourse: o.rembourse,
      fMontant: o.montant !== null ? fr(o.montant) : "",
      qMise: o.qualifMise !== null ? fr(o.qualifMise) : "",
    });
    setVue("calcul");
  };

  const calculerCandidat = (c: Candidat, r: ReglagesComparateur) => {
    setCalcul((s) => ({
      ...s,
      mode: r.mode,
      rembourse: r.rembourse,
      fMontant: r.montant,
      fCote: fr(c.coteFreebet),
      fInverse: fr(c.coteInverse),
      fComm: r.commission,
      qComm: r.commission,
    }));
    setVue("calcul");
  };

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Freebet</h1>
        <p className="chapeau">Match betting : profit garanti par couverture chez un autre bookmaker. La seule méthode vraiment garantie.</p>
      </div>
      <div className="segments" role="group" aria-label="Section">
        <button type="button" aria-pressed={vue === "calcul"} onClick={() => setVue("calcul")}>Calculateur</button>
        <button type="button" aria-pressed={vue === "comparateur"} onClick={() => setVue("comparateur")}>Comparateur</button>
        <button type="button" aria-pressed={vue === "offres"} onClick={() => setVue("offres")}>
          Offres{offres.length ? ` (${offres.length})` : ""}
          {bientot > 0 && <span className="pastille-alerte" aria-label={`${bientot} expire bientôt`}> ●</span>}
        </button>
      </div>
      {vue === "calcul" && <Calculateur saisie={calcul} changer={changerCalcul} offre={offreDuCalcul} />}
      {vue === "comparateur" && (
        <Comparateur reglages={comparateur} changer={(p) => setComparateur((c) => ({ ...c, ...p }))} utiliser={calculerCandidat} />
      )}
      {vue === "offres" && <Offres offres={offres} calculer={calculerOffre} />}
    </>
  );
}
