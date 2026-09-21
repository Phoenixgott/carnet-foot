/**
 * Mes paris : bilan et journal (lecture seule en phase 1).
 * Bilan calculé avec les mêmes règles que le carnet d'origine.
 */
import { dateCourte, eur, fr, pc } from "../../core/format";
import { bilan, gainPari, LIBELLE_STATUT, miseConseillee } from "../../core/paris";
import { bankrollDe } from "../../data/contenu";
import { useAppli } from "../contexte";

export function Paris() {
  const { contenu } = useAppli();
  const reglages = bankrollDe(contenu);
  const b = bilan(contenu.paris, reglages);
  const journal = [...contenu.paris].sort((x, y) => y.ordre - x.ordre);

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Mes paris</h1>
        <p className="chapeau">
          Journal importé du carnet. L'ajout et la modification des paris arrivent en phase 6 : d'ici là, continue de noter tes paris dans le carnet,
          puis réimporte.
        </p>
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
        Bankroll de départ {eur(reglages.depart)} · mise conseillée {eur(miseConseillee(contenu.paris, reglages))} ({fr(reglages.pctMise, 1)} % de la
        bankroll). Rentabilité calculée sans les mises Freebet.
      </p>

      <section className="section" aria-labelledby="titre-journal">
        <h2 id="titre-journal">Journal ({journal.length})</h2>
        {journal.length === 0 ? (
          <p className="vide">Aucun pari pour l'instant.</p>
        ) : (
          <ul className="liste-paris" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {journal.map((p) => {
              const g = gainPari(p);
              const termine = p.statut !== "attente" && p.statut !== "rembourse";
              return (
                <li className="pari" key={p.id}>
                  <span className="pari-match">{p.match || "Match sans nom"}</span>
                  <span className={`statut ${p.statut}`}>{LIBELLE_STATUT[p.statut]}</span>
                  <span className="pari-meta">
                    {p.date ? dateCourte(p.date) : "date ⏳"} · Méthode {p.methode} · cote <span className="num">{fr(p.cote)}</span> · mise{" "}
                    <span className="num">{eur(p.mise)}</span>
                  </span>
                  <span className={`pari-gain ${g > 0 ? "pos" : g < 0 ? "neg" : ""}`}>{termine ? eur(g) : "—"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
