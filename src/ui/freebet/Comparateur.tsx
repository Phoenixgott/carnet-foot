/**
 * Comparateur : quel match choisir pour utiliser un freebet ? Classe les combinaisons
 * (match, ligne de buts, côté) par taux de conversion, avec les cotes des matchs chargés.
 */
import { useState } from "react";
import { appreciationConversion, type ModeCouverture } from "../../core/freebet";
import { comparerFreebet, libelleCandidat, type Candidat } from "../../core/freebet-comparateur";
import { dateCourte, eur, fr, lireSaisie, pc } from "../../core/format";
import { jourLocal } from "../../data/versions";
import { ChampMontant, Choix, nombreOuNull } from "../champs";
import { useAppli } from "../contexte";

/** Nombre de combinaisons affichées. */
const NB_AFFICHEES = 10;

export interface ReglagesComparateur {
  montant: string;
  rembourse: boolean;
  mode: ModeCouverture;
  commission: string;
  coteMin: string;
}

export const COMPARATEUR_VIDE: ReglagesComparateur = { montant: "", rembourse: false, mode: "book", commission: "5", coteMin: "" };

export function Comparateur({
  reglages: r,
  changer,
  utiliser,
}: {
  reglages: ReglagesComparateur;
  changer: (p: Partial<ReglagesComparateur>) => void;
  /** Envoie une combinaison vers le calculateur. */
  utiliser: (c: Candidat, r: ReglagesComparateur) => void;
}) {
  const { contenu } = useAppli();
  const [toutes, setToutes] = useState(false);
  const montant = nombreOuNull(r.montant);
  const commission = lireSaisie(r.commission);
  const coteMin = nombreOuNull(r.coteMin);
  const commissionOk = r.mode === "book" || (typeof commission === "number" && commission >= 0 && commission < 100);
  const res =
    montant !== null && montant > 0 && commissionOk
      ? comparerFreebet(contenu.matchs, {
          montant,
          rembourse: r.rembourse,
          mode: r.mode,
          commission: typeof commission === "number" ? commission / 100 : 0,
          coteMin: coteMin !== null && coteMin > 1 ? coteMin : null,
          aPartirDu: jourLocal(new Date()),
        })
      : null;
  const affichees = res ? (toutes ? res.candidats : res.candidats.slice(0, NB_AFFICHEES)) : [];

  return (
    <div className="section" data-test="comparateur">
      <p className="aide">
        Pour chaque match qui a les cotes « plus de » et « moins de » d'une même ligne, je simule le freebet sur un côté et sa couverture sur
        l'autre, puis je classe par taux de conversion (la part du freebet transformée en argent réel).
      </p>
      <section className="carte" aria-labelledby="titre-cmp-offre">
        <h3 id="titre-cmp-offre">Ton freebet</h3>
        <ChampMontant id="cmp-montant" libelle="Montant du freebet (€)" valeur={r.montant} changer={(montant) => changer({ montant })} placeholder="ex. 10" />
        <ChampMontant
          id="cmp-cote-min"
          libelle="Cote minimale de l'offre (facultatif)"
          valeur={r.coteMin}
          changer={(coteMin) => changer({ coteMin })}
          placeholder="ex. 1,50"
          aide="Les combinaisons dont la cote est en dessous sont écartées."
        />
        <Choix<ModeCouverture>
          libelle="Couverture"
          valeur={r.mode}
          options={[["book", "Autre bookmaker"], ["lay", "Exchange (lay)"]]}
          changer={(mode) => changer({ mode })}
        />
        {r.mode === "lay" && <ChampMontant id="cmp-commission" libelle="Commission de l'exchange (%)" valeur={r.commission} changer={(commission) => changer({ commission })} />}
        <Choix<"non" | "oui">
          libelle="Freebet remboursé ?"
          valeur={r.rembourse ? "oui" : "non"}
          options={[["non", "Non (cas courant)"], ["oui", "Oui"]]}
          changer={(v) => changer({ rembourse: v === "oui" })}
        />
      </section>

      {contenu.matchs.length === 0 && <p className="vide">Aucun match chargé. Récupère les matchs dans l'onglet « Matchs » : le comparateur utilise leurs cotes.</p>}
      {contenu.matchs.length > 0 && res === null && (
        <p className="bandeau info" data-test="cmp-a-saisir">Saisis le montant du freebet pour voir le classement.</p>
      )}
      {res && (
        <>
          <h3>Meilleures combinaisons</h3>
          {res.candidats.length === 0 ? (
            <p className="vide" data-test="cmp-vide">
              Aucune combinaison possible : il faut, pour un match à venir, les cotes « plus de » <b>et</b> « moins de » d'une même ligne.
              {res.sansCotes > 0 ? ` ${res.sansCotes} match${res.sansCotes > 1 ? "s" : ""} ${res.sansCotes > 1 ? "n'en ont" : "n'en a"} pas.` : ""} Demande les cotes
              dans l'onglet « Matchs » (« Copier la demande de cotes »).
            </p>
          ) : (
            <ol className="candidats" data-test="candidats">
              {affichees.map((c, i) => {
                const a = appreciationConversion(c.conversion);
                return (
                  <li key={`${c.matchId}|${c.ligne}|${c.cote}`} className="candidat">
                    <div className="candidat-haut">
                      <b>
                        {i + 1}. {c.match}
                      </b>
                      <span className={`verdict ${a}`} data-test="candidat-conversion">{pc(c.conversion)}</span>
                    </div>
                    <p className="aide">
                      {c.ligue ?? ""}
                      {c.date ? ` · ${dateCourte(c.date)}` : ""}
                      {c.heure ? ` ${c.heure}` : ""}
                      {c.bookmaker ? ` · cotes ${c.bookmaker}` : ""}
                    </p>
                    <div className="faits">
                      <div className="fait"><span>Freebet sur</span><b>{libelleCandidat(c)} à {fr(c.coteFreebet)}</b></div>
                      <div className="fait"><span>Couverture sur l'autre côté à</span><b>{fr(c.coteInverse)}</b></div>
                      <div className="fait"><span>Mise de couverture</span><b>{eur(c.miseCouverture)}</b></div>
                      <div className="fait"><span>Gain garanti</span><b className="pos">{eur(c.gain)}</b></div>
                      <div className="fait"><span>Marge du bookmaker</span><b>{fr(c.marge * 100, 1)} %</b></div>
                    </div>
                    <button type="button" className="btn secondaire" onClick={() => utiliser(c, r)}>
                      Calculer avec ce match
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {res.candidats.length > NB_AFFICHEES && (
            <button type="button" className="btn discret" onClick={() => setToutes(!toutes)}>
              {toutes ? "Voir moins" : `Voir les ${res.candidats.length} combinaisons`}
            </button>
          )}
          {res.ecartees > 0 && (
            <p className="aide" data-test="cmp-ecartees">
              {res.ecartees} combinaison{res.ecartees > 1 ? "s" : ""} écartée{res.ecartees > 1 ? "s" : ""} : cote sous la cote minimale de l'offre.
            </p>
          )}
          {res.sansCotes > 0 && res.candidats.length > 0 && (
            <p className="aide" data-test="cmp-sans-cotes">
              {res.sansCotes} match{res.sansCotes > 1 ? "s" : ""} sans les cotes « plus de » et « moins de » d'une même ligne : non évalué{res.sansCotes > 1 ? "s" : ""}.
            </p>
          )}
          <p className="bandeau attention">
            Un match n'a qu'un seul jeu de cotes : le pari inverse est supposé à la cote du même bookmaker. Chez un autre site, la cote inverse
            peut être meilleure (donc la conversion aussi). Ce classement aide à choisir le match ; le calculateur, avec les vraies cotes des deux
            sites, donne le chiffre final. Sur les paris « plus/moins de buts », la conversion dépasse rarement 60 à 70 %.
          </p>
        </>
      )}
    </div>
  );
}
