/**
 * Suivi des offres de freebet : bonus, date limite, conditions, statut.
 * Rappel avant expiration : bandeau (ici et sur l'accueil), notification une fois par jour quand
 * l'app est ouverte, et fichier d'agenda (.ics) que le téléphone rappelle même application fermée.
 */
import { useState } from "react";
import { eur, fr, pc } from "../../core/format";
import { evenementAgenda, nomFichierAgenda } from "../../core/ics";
import {
  bilanOffres,
  etatOffre,
  LIBELLE_STATUT_OFFRE,
  RAPPEL_OFFRES_JOURS,
  SAISIE_OFFRE_VIDE,
  saisieDepuisOffre,
  STATUTS_OFFRE,
  texteDelai,
  trierOffres,
  validerOffre,
  type OffreFreebet,
  type SaisieOffre,
  type StatutOffre,
} from "../../core/offres";
import { ecrireOffres, nouvelIdOffre } from "../../data/offres";
import { jourLocal } from "../../data/versions";
import { ChampMontant, Choix } from "../champs";
import { useAppli } from "../contexte";
import { telechargerFichier } from "../fichiers";

const CLASSE_ETAT = { terminee: "ok", expiree: "ko", urgente: "ko", bientot: "mid", "en-cours": "" } as const;
const LIBELLE_ETAT = { terminee: "Terminée", expiree: "Expirée", urgente: "Urgent", bientot: "Bientôt", "en-cours": "" } as const;

export function Offres({
  offres,
  calculer,
}: {
  offres: OffreFreebet[];
  /** Envoie une offre vers le calculateur. */
  calculer: (o: OffreFreebet) => void;
}) {
  const { recharger, message, confirmer } = useAppli();
  const aujourdhui = jourLocal(new Date());
  const [edition, setEdition] = useState<{ id: string | null; saisie: SaisieOffre } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const bilan = bilanOffres(offres, aujourdhui);
  const triees = trierOffres(offres, aujourdhui);

  const sauver = async (suite: OffreFreebet[], msg: string) => {
    await ecrireOffres(suite);
    await recharger();
    message(msg);
  };

  const enregistrer = async (e: Event) => {
    e.preventDefault();
    if (!edition) return;
    const existante = edition.id ? (offres.find((o) => o.id === edition.id) ?? null) : null;
    const r = validerOffre(edition.saisie, existante, existante?.id ?? nouvelIdOffre(), new Date().toISOString());
    if ("erreur" in r) {
      setErreur(r.erreur);
      return;
    }
    setErreur(null);
    setEdition(null);
    await sauver(existante ? offres.map((o) => (o.id === r.offre.id ? r.offre : o)) : [...offres, r.offre], existante ? "Offre modifiée" : "Offre ajoutée");
  };

  const changerStatut = async (o: OffreFreebet, statut: StatutOffre) => {
    const maintenant = new Date().toISOString();
    await sauver(
      offres.map((x) => (x.id === o.id ? { ...x, statut, beneficeReel: statut === "terminee" ? x.beneficeReel : null, modifieLe: maintenant } : x)),
      statut === "terminee" ? "Offre terminée : touche « Modifier » pour saisir le bénéfice réel" : `Statut : ${LIBELLE_STATUT_OFFRE[statut].toLowerCase()}`,
    );
  };

  const supprimer = async (o: OffreFreebet) => {
    const ok = await confirmer({
      titre: "Supprimer cette offre ?",
      texte: `« ${o.bookmaker}${o.titre ? " : " + o.titre : ""} » sera supprimée de ton suivi. Une copie de sécurité de tes données est faite chaque jour.`,
      action: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await sauver(offres.filter((x) => x.id !== o.id), "Offre supprimée");
  };

  const agenda = (o: OffreFreebet) => {
    const ics = evenementAgenda(o, new Date());
    if (!ics) {
      message("Cette offre n'a pas de date limite.");
      return;
    }
    telechargerFichier(nomFichierAgenda(o), ics, "text/calendar");
    message("Fichier d'agenda enregistré : ouvre-le pour l'ajouter à ton agenda");
  };

  const champ = (k: keyof SaisieOffre) => (v: string) => setEdition((e) => (e ? { ...e, saisie: { ...e.saisie, [k]: v } } : e));

  return (
    <div className="section" data-test="offres">
      <div className="faits" data-test="bilan-offres">
        <div className="fait"><span>Offres en cours</span><b data-test="nb-en-cours">{bilan.enCours}</b></div>
        <div className="fait"><span>Freebets à utiliser</span><b data-test="a-utiliser">{eur(bilan.aUtiliser)}</b></div>
        {bilan.expirees > 0 && <div className="fait"><span>Expirées</span><b className="neg">{bilan.expirees}</b></div>}
        <div className="fait"><span>Terminées</span><b>{bilan.terminees}</b></div>
        <div className="fait">
          <span>Bénéfice réalisé</span>
          <b className={bilan.benefice >= 0 ? "pos" : "neg"} data-test="benefice-realise">{eur(bilan.benefice)}</b>
        </div>
        <div className="fait">
          <span>Conversion moyenne</span>
          <b data-test="conversion-moyenne">{Number.isFinite(bilan.conversionMoyenne) ? pc(bilan.conversionMoyenne) : "⏳"}</b>
        </div>
      </div>

      {!edition && (
        <button
          type="button"
          className="btn large"
          onClick={() => {
            setErreur(null);
            setEdition({ id: null, saisie: { ...SAISIE_OFFRE_VIDE } });
          }}
        >
          Ajouter une offre
        </button>
      )}

      {edition && (
        <form className="carte" onSubmit={enregistrer} aria-labelledby="titre-form-offre" data-test="form-offre">
          <h3 id="titre-form-offre">{edition.id ? "Modifier l'offre" : "Nouvelle offre"}</h3>
          <ChampMontant id="offre-bookmaker" libelle="Bookmaker" valeur={edition.saisie.bookmaker} changer={champ("bookmaker")} placeholder="ex. Unibet" />
          <ChampMontant id="offre-titre" libelle="Intitulé de l'offre (facultatif)" valeur={edition.saisie.titre} changer={champ("titre")} placeholder="ex. Freebet 10 € pour 10 € misés" />
          <ChampMontant id="offre-montant" libelle="Montant du freebet (€)" valeur={edition.saisie.montant} changer={champ("montant")} placeholder="ex. 10" />
          <ChampMontant id="offre-qualif" libelle="Mise du pari qui débloque (€)" valeur={edition.saisie.qualifMise} changer={champ("qualifMise")} placeholder="ex. 10" />
          <ChampMontant id="offre-cote-min" libelle="Cote minimale exigée" valeur={edition.saisie.coteMin} changer={champ("coteMin")} placeholder="ex. 1,50" />
          <label className="champ" htmlFor="offre-date">
            Date limite (dernier jour pour utiliser le freebet)
            <input id="offre-date" type="date" value={edition.saisie.dateLimite} onChange={(e: Event) => champ("dateLimite")((e.target as HTMLInputElement).value)} />
          </label>
          <label className="champ" htmlFor="offre-conditions">
            Conditions (facultatif)
            <textarea
              id="offre-conditions"
              value={edition.saisie.conditions}
              placeholder="ex. pari simple, cote min 1,50, freebet valable 7 jours"
              onChange={(e: Event) => champ("conditions")((e.target as HTMLTextAreaElement).value)}
            />
          </label>
          <Choix<"non" | "oui">
            libelle="Le freebet rend-il la mise en cas de gain ?"
            valeur={edition.saisie.rembourse ? "oui" : "non"}
            options={[["non", "Non (cas courant)"], ["oui", "Oui (remboursé)"]]}
            changer={(v) => setEdition((e) => (e ? { ...e, saisie: { ...e.saisie, rembourse: v === "oui" } } : e))}
          />
          <label className="champ" htmlFor="offre-statut">
            Statut
            <select id="offre-statut" value={edition.saisie.statut} onChange={(e: Event) => champ("statut")((e.target as HTMLSelectElement).value)}>
              {STATUTS_OFFRE.map((s) => (
                <option key={s.statut} value={s.statut}>{s.libelle}</option>
              ))}
            </select>
          </label>
          {edition.saisie.statut === "terminee" && (
            <ChampMontant
              id="offre-benefice"
              libelle="Bénéfice réel obtenu (€)"
              valeur={edition.saisie.beneficeReel}
              changer={champ("beneficeReel")}
              placeholder="ex. 6,50"
              aide="Compte dans le bilan et le taux de conversion moyen. Négatif si tu as perdu."
            />
          )}
          {erreur && <p className="bandeau erreur" role="alert">{erreur}</p>}
          <button type="submit" className="btn large">Enregistrer l'offre</button>
          <button type="button" className="btn secondaire" onClick={() => setEdition(null)}>Annuler</button>
        </form>
      )}

      {triees.length === 0 && !edition ? (
        <p className="vide" data-test="offres-vide">Aucune offre suivie. Ajoute-en une pour ne plus laisser un freebet expirer.</p>
      ) : (
        <ul className="offres" data-test="liste-offres">
          {triees.map((o) => {
            const etat = etatOffre(o, aujourdhui);
            return (
              <li key={o.id} className={`offre offre-${etat}`} data-etat={etat} aria-label={`Offre ${o.bookmaker}`}>
                <div className="offre-haut">
                  <b>{o.bookmaker}{o.titre ? ` · ${o.titre}` : ""}</b>
                  {LIBELLE_ETAT[etat] && <span className={`verdict ${CLASSE_ETAT[etat]}`}>{LIBELLE_ETAT[etat]}</span>}
                </div>
                <div className="faits">
                  <div className="fait"><span>Freebet</span><b>{o.montant !== null ? eur(o.montant) : "⏳"}</b></div>
                  {o.qualifMise !== null && <div className="fait"><span>Pari qui débloque</span><b>{eur(o.qualifMise)}</b></div>}
                  {o.coteMin !== null && <div className="fait"><span>Cote minimale</span><b>{fr(o.coteMin)}</b></div>}
                  <div className="fait">
                    <span>Date limite</span>
                    <b data-test="delai">{o.dateLimite ? (o.statut === "terminee" ? o.dateLimite : texteDelai(o.dateLimite, aujourdhui)) : "⏳"}</b>
                  </div>
                  {o.rembourse && <div className="fait"><span>Freebet remboursé</span><b>Oui</b></div>}
                  {o.statut === "terminee" && (
                    <div className="fait">
                      <span>Bénéfice réel</span>
                      <b className={(o.beneficeReel ?? 0) >= 0 ? "pos" : "neg"}>{o.beneficeReel !== null ? eur(o.beneficeReel) : "⏳"}</b>
                    </div>
                  )}
                </div>
                {o.conditions && <p className="aide">{o.conditions}</p>}
                <label className="champ" htmlFor={`statut-${o.id}`}>
                  Statut de l'offre {o.bookmaker}
                  <select id={`statut-${o.id}`} value={o.statut} onChange={(e: Event) => changerStatut(o, (e.target as HTMLSelectElement).value as StatutOffre)}>
                    {STATUTS_OFFRE.map((s) => (
                      <option key={s.statut} value={s.statut}>{s.libelle}</option>
                    ))}
                  </select>
                </label>
                <div className="rangee rangee-serree">
                  {o.statut !== "terminee" && (
                    <button type="button" className="btn" onClick={() => calculer(o)}>Calculer</button>
                  )}
                  {o.dateLimite && o.statut !== "terminee" && (
                    <button type="button" className="btn secondaire" aria-label={`Ajouter l'offre ${o.bookmaker} à l'agenda`} onClick={() => agenda(o)}>
                      Ajouter à l'agenda
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn secondaire"
                    aria-label={`Modifier l'offre ${o.bookmaker}`}
                    onClick={() => {
                      setErreur(null);
                      setEdition({ id: o.id, saisie: saisieDepuisOffre(o) });
                    }}
                  >
                    Modifier
                  </button>
                  <button type="button" className="btn discret" aria-label={`Supprimer l'offre ${o.bookmaker}`} onClick={() => supprimer(o)}>Supprimer</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="bandeau info">
        <b>Rappels.</b> Les offres qui expirent dans les {RAPPEL_OFFRES_JOURS} jours sont signalées ici et sur l'accueil, et tu reçois une notification par jour
        quand tu ouvres l'application (si les notifications sont activées). Application fermée, seul l'agenda du téléphone peut te rappeler :
        touche « Ajouter à l'agenda » (alarmes la veille et 3 jours avant, à 9 h).
      </p>
    </div>
  );
}
