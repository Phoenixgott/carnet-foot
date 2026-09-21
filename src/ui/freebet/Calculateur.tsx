/**
 * Calculateur Freebet : le pari qui débloque le freebet, puis le freebet, chacun couvert sur
 * l'issue inverse (autre bookmaker ou exchange). Donne les mises, le coût du pari qui débloque,
 * le profit garanti et le taux de conversion du freebet.
 */
import {
  analyserFreebet,
  freebetCalculable,
  jambeFreebet,
  jambeQualification,
  qualifCalculable,
  verifierEntreeFreebet,
  type EntreeFreebet,
  type ModeCouverture,
} from "../../core/freebet";
import { eur, fr, lireSaisie, pc } from "../../core/format";
import type { OffreFreebet } from "../../core/offres";
import { texteDelai } from "../../core/offres";
import { jourLocal } from "../../data/versions";
import { ChampMontant, ChampNombre, Choix } from "../champs";

export interface SaisieCalcul {
  mode: ModeCouverture;
  rembourse: boolean;
  qMise: string;
  qCote: string;
  qInverse: string;
  qComm: string;
  fMontant: string;
  fCote: string;
  fInverse: string;
  fComm: string;
}

/** Champs vides : aucun chiffre d'exemple qui pourrait être pris pour une vraie cote. */
export const CALCUL_VIDE: SaisieCalcul = {
  mode: "book",
  rembourse: false,
  qMise: "",
  qCote: "",
  qInverse: "",
  qComm: "5",
  fMontant: "",
  fCote: "",
  fInverse: "",
  fComm: "5",
};

const nombre = (t: string) => {
  const x = lireSaisie(t);
  return typeof x === "number" ? x : NaN;
};

export function Calculateur({
  saisie: s,
  changer,
  offre,
}: {
  saisie: SaisieCalcul;
  changer: (p: Partial<SaisieCalcul>) => void;
  /** Offre à l'origine du calcul (montant, mise et cote minimale préremplis), si elle existe. */
  offre: OffreFreebet | null;
}) {
  const lay = s.mode === "lay";
  const entree: EntreeFreebet = {
    mode: s.mode,
    qMise: nombre(s.qMise),
    qCote: nombre(s.qCote),
    qCoteInverse: nombre(s.qInverse),
    qCommission: nombre(s.qComm) / 100,
    fMontant: nombre(s.fMontant),
    fCote: nombre(s.fCote),
    fCoteInverse: nombre(s.fInverse),
    fCommission: nombre(s.fComm) / 100,
    fRembourse: s.rembourse,
  };
  const probleme = verifierEntreeFreebet(entree);
  const bilan = analyserFreebet(entree);
  // Chaque pari se calcule seul, sans attendre l'autre (comme dans le carnet)
  const qualif = qualifCalculable(entree) ? jambeQualification(entree.qMise, entree.qCote, entree.qCoteInverse, s.mode, entree.qCommission) : null;
  const freebet = freebetCalculable(entree)
    ? jambeFreebet(entree.fMontant, entree.fCote, entree.fCoteInverse, s.mode, entree.fCommission, s.rembourse)
    : null;
  const lieu = lay ? "en lay sur l'exchange" : "sur le résultat inverse, chez l'autre bookmaker";
  const libelleInverse = lay ? "Cote lay (même issue)" : "Cote inverse (autre site)";
  const aujourdhui = jourLocal(new Date());
  const sousCoteMin = offre?.coteMin != null && Number.isFinite(entree.fCote) && entree.fCote < offre.coteMin;

  return (
    <div className="section" data-test="calculateur">
      <p className="aide">
        Tu paries chez le bookmaker de l'offre sur une issue, et chez un autre bookmaker (ou en lay sur un exchange) sur l'issue inverse. Quoi
        qu'il arrive, tu gagnes : c'est la seule méthode garantie, à condition que les deux paris soient acceptés aux cotes saisies.
      </p>
      {offre && (
        <div className="bandeau info" data-test="offre-du-calcul">
          <p>
            <b>{offre.bookmaker}</b>
            {offre.titre ? ` · ${offre.titre}` : ""}
            {offre.montant !== null ? ` · freebet de ${eur(offre.montant)}` : ""}
            {offre.coteMin !== null ? ` · cote minimale ${fr(offre.coteMin)}` : ""}
            {offre.dateLimite ? ` · ${texteDelai(offre.dateLimite, aujourdhui)}` : ""}
          </p>
          {offre.conditions && <p className="aide">{offre.conditions}</p>}
        </div>
      )}
      <Choix<ModeCouverture>
        libelle="Où places-tu le pari inverse ?"
        valeur={s.mode}
        options={[["book", "Autre bookmaker"], ["lay", "Exchange (lay)"]]}
        changer={(mode) => changer({ mode })}
      />
      <Choix<"non" | "oui">
        libelle="Le freebet rend-il la mise en cas de gain ?"
        valeur={s.rembourse ? "oui" : "non"}
        options={[["non", "Non (cas courant)"], ["oui", "Oui (remboursé)"]]}
        changer={(v) => changer({ rembourse: v === "oui" })}
      />

      <section className="carte" aria-labelledby="titre-fb-qualif">
        <h3 id="titre-fb-qualif">1. Le pari qui débloque le freebet</h3>
        <p className="aide">En argent réel. Il coûte au plus quelques euros.</p>
        <ChampMontant id="fb-q-mise" libelle="Mise chez le bookmaker de l'offre (€)" valeur={s.qMise} changer={(qMise) => changer({ qMise })} placeholder="ex. 10" />
        <ChampNombre id="fb-q-cote" libelle="Cote chez le bookmaker de l'offre" valeur={s.qCote} changer={(qCote) => changer({ qCote })} pas={0.05} min={1.01} defaut={2} placeholder="ex. 2,05" />
        <ChampNombre id="fb-q-inverse" libelle={libelleInverse} valeur={s.qInverse} changer={(qInverse) => changer({ qInverse })} pas={0.05} min={1.01} defaut={2} placeholder="ex. 1,95" />
        {lay && <ChampMontant id="fb-q-comm" libelle="Commission de l'exchange (%)" valeur={s.qComm} changer={(qComm) => changer({ qComm })} />}
        {qualif && (
          <div className={`reponse ${qualif.resultat > -entree.qMise * 0.05 ? "ok" : "mid"}`} data-test="rep-qualif">
            <strong>Mise {eur(qualif.miseCouverture)}</strong>
            <p>
              {lieu}. Quoi qu'il arrive : <b>{eur(qualif.resultat)}</b>
              {qualif.resultat < 0 ? ", c'est le prix pour débloquer le freebet" : ""}.
            </p>
            {lay && <p>Il faut {eur(qualif.miseCouverture * (entree.qCoteInverse - 1))} sur ton compte exchange.</p>}
          </div>
        )}
      </section>

      <section className="carte" aria-labelledby="titre-fb-freebet">
        <h3 id="titre-fb-freebet">2. Le freebet</h3>
        <p className="aide">Place-le sur une grosse cote, entre 3 et 6 : tu en récupères plus.</p>
        <ChampMontant id="fb-f-montant" libelle="Montant du freebet (€)" valeur={s.fMontant} changer={(fMontant) => changer({ fMontant })} placeholder="ex. 10" />
        <ChampNombre id="fb-f-cote" libelle="Cote chez le bookmaker de l'offre" valeur={s.fCote} changer={(fCote) => changer({ fCote })} pas={0.05} min={1.01} defaut={3} placeholder="ex. 4,50" />
        {sousCoteMin && (
          <p className="bandeau attention" role="status" data-test="sous-cote-min">
            Cette cote ({fr(entree.fCote)}) est sous la cote minimale de l'offre ({fr(offre!.coteMin!)}) : le freebet risque d'être refusé.
          </p>
        )}
        <ChampNombre id="fb-f-inverse" libelle={libelleInverse} valeur={s.fInverse} changer={(fInverse) => changer({ fInverse })} pas={0.05} min={1.01} defaut={1.5} placeholder="ex. 1,30" />
        {lay && <ChampMontant id="fb-f-comm" libelle="Commission de l'exchange (%)" valeur={s.fComm} changer={(fComm) => changer({ fComm })} />}
        {freebet && (
          <div className={`reponse ${freebet.resultat > 0 ? "ok" : "ko"}`} data-test="rep-freebet">
            <strong>Mise {eur(freebet.miseCouverture)}</strong>
            <p>
              {lieu}. Quoi qu'il arrive, tu gagnes <b>{eur(freebet.resultat)}</b>.
            </p>
            {lay && <p>Il faut {eur(freebet.miseCouverture * (entree.fCoteInverse - 1))} sur ton compte exchange.</p>}
          </div>
        )}
      </section>

      <section className="carte" aria-labelledby="titre-fb-bilan">
        <h3 id="titre-fb-bilan">Bilan</h3>
        {probleme === "Saisis toutes les valeurs." ? (
          <p className="bandeau info" data-test="calcul-a-saisir">Saisis les mises, les montants et les cotes pour voir le bilan.</p>
        ) : probleme ? (
          <p className="bandeau erreur" role="alert" data-test="calcul-erreur">{probleme}</p>
        ) : (
          bilan && (
            <>
              <div className="faits" data-test="bilan-freebet">
                <div className="fait">
                  <span>Pari qui débloque</span>
                  <b className={bilan.qualif.resultat >= 0 ? "pos" : "neg"} data-test="bilan-qualif">{eur(bilan.qualif.resultat)}</b>
                </div>
                <div className="fait"><span>Coût du pari qui débloque</span><b data-test="bilan-cout">{eur(bilan.cout)}</b></div>
                <div className="fait"><span>Freebet</span><b className="pos" data-test="bilan-gain">{eur(bilan.freebet.resultat)}</b></div>
                <div className="fait">
                  <span><b>Bénéfice garanti</b></span>
                  <b className={bilan.total >= 0 ? "pos" : "neg"} style={{ fontSize: 20 }} data-test="bilan-total">{eur(bilan.total)}</b>
                </div>
                <div className="fait"><span>Taux de conversion du freebet</span><b data-test="bilan-conversion">{pc(bilan.conversion)}</b></div>
                <div className="fait"><span>Conversion nette (coût compté)</span><b data-test="bilan-conversion-nette">{pc(bilan.conversionNette)}</b></div>
              </div>
              <div className={`reponse ${bilan.appreciation}`} data-test="appreciation">
                <strong>{bilan.appreciation === "ok" ? "Bonne opération" : bilan.appreciation === "mid" ? "Correct" : "À améliorer"}</strong>
                <p>
                  Tu transformes {pc(bilan.conversion)} du freebet en argent réel.{" "}
                  {bilan.appreciation === "ok" ? "C'est un bon taux." : "Cherche un match où les deux cotes sont plus proches."}
                </p>
              </div>
            </>
          )
        )}
      </section>

      <p className="bandeau attention">
        Choisis un pari à <b>2 résultats possibles seulement</b> (+/− 2,5 buts, un match de tennis). Relis les conditions de l'offre : cote
        minimum, délai. Le gain n'est garanti que si les deux paris sont acceptés aux cotes saisies (une cote qui bouge, un pari annulé ou un compte
        limité cassent la garantie). Aucun exchange n'est autorisé en France : couvre chez un autre bookmaker.
      </p>
    </div>
  );
}
