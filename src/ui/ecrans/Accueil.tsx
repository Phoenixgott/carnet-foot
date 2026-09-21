/**
 * Accueil : bankroll et bilan en un coup d'œil, état des données, rappels.
 */
import { alertesCote } from "../../core/cotes";
import { offresARappeler, texteDelai } from "../../core/offres";
import { offresDe } from "../../data/offres";
import { analyserV2 } from "../../core/modele-v2/analyse";
import { dateCourte, eur, pc } from "../../core/format";
import { bilan } from "../../core/paris";
import { bankrollDe, estVide } from "../../data/contenu";
import { jourLocal } from "../../data/versions";
import { joursDepuis, RAPPEL_SAUVEGARDE_JOURS, useAppli } from "../contexte";

export function Accueil() {
  const { contenu, dernierExport, contexteDe } = useAppli();
  const vide = estVide(contenu);
  const b = bilan(contenu.paris, bankrollDe(contenu));
  const jours = [...new Set(contenu.matchs.map((m) => m.date).filter(Boolean))].sort() as string[];
  const aJouer = contenu.matchs.filter((m) => analyserV2(m, "+1.5", contexteDe(m)).v === "ok" || analyserV2(m, "+2.5", contexteDe(m)).v === "ok").length;
  const rappel = !vide && (!dernierExport || joursDepuis(dernierExport) >= RAPPEL_SAUVEGARDE_JOURS);
  // Alertes de cote des matchs à venir (ou sans date)
  const aujourdhui = jourLocal(new Date());
  const offresBientot = offresARappeler(offresDe(contenu), aujourdhui);
  const alertes = contenu.matchs.filter((m) => !m.date || m.date >= aujourdhui).flatMap((m) => alertesCote(m, contexteDe));

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Accueil</h1>
        <p className="chapeau">Tes données restent sur ce téléphone : rien n'est envoyé à un serveur.</p>
      </div>

      {vide ? (
        <section className="carte" aria-labelledby="bienvenue">
          <h2 id="bienvenue">Récupère tes données du carnet</h2>
          <ol className="aide" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>Ouvre ton carnet, onglet « Mes paris ».</li>
            <li>Tout en bas, touche « Tout exporter » : le texte est copié.</li>
            <li>Reviens ici, onglet « Données », et colle-le.</li>
          </ol>
          <a className="btn large" href="#/donnees">Importer depuis le carnet</a>
          <p className="aide">Ou commence directement : récupère les matchs du jour avec l'autre conversation Claude.</p>
          <a className="btn secondaire large" href="#/matchs">Récupérer les matchs</a>
        </section>
      ) : (
        <section className="gazon" aria-labelledby="titre-bankroll">
          <span className="etiquette" id="titre-bankroll">Bankroll</span>
          <span className="gazon-chiffre" data-test="bankroll">{eur(b.bankroll)}</span>
          <div className="gazon-ligne">
            <div>
              <b>{eur(b.gains)}</b>
              <small>Gagné / perdu</small>
            </div>
            <div>
              <b>{pc(b.rentabilite)}</b>
              <small>Rentabilité</small>
            </div>
            <div>
              <b>{pc(b.tauxReussite)}</b>
              <small>Paris gagnés</small>
            </div>
          </div>
        </section>
      )}

      {offresBientot.length > 0 && (
        <section className="alerte-cote" aria-labelledby="titre-offres-bientot" data-test="offres-bientot">
          <h2 id="titre-offres-bientot">
            <span aria-hidden="true">🎁 </span>
            {offresBientot.length === 1 ? "Un freebet expire bientôt" : `${offresBientot.length} freebets expirent bientôt`}
          </h2>
          <ul>
            {offresBientot.map((o) => (
              <li key={o.id}>
                {o.bookmaker}
                {o.titre ? ` · ${o.titre}` : ""}
                {o.montant !== null ? ` (${eur(o.montant)})` : ""} : {texteDelai(o.dateLimite!, aujourdhui)}
              </li>
            ))}
          </ul>
          <a className="btn" href="#/freebet?vue=offres">Voir mes offres</a>
        </section>
      )}

      {alertes.length > 0 && (
        <section className="alerte-cote" aria-labelledby="titre-alertes" data-test="alertes-accueil">
          <h2 id="titre-alertes">
            <span aria-hidden="true">🔔 </span>
            {alertes.length === 1 ? "Une cote a atteint ta cote minimale" : `${alertes.length} cotes ont atteint ta cote minimale`}
          </h2>
          <ul>
            {alertes.map((a) => (
              <li key={a.matchId + a.marche}>{a.texte}</li>
            ))}
          </ul>
          <a className="btn" href="#/matchs">Voir les matchs</a>
        </section>
      )}

      {rappel && (
        <div className="bandeau attention" role="status">
          <p>
            {dernierExport
              ? `Ta dernière sauvegarde fichier date de ${joursDepuis(dernierExport)} jours.`
              : "Tu n'as encore jamais enregistré de sauvegarde fichier."}{" "}
            Si le navigateur efface ses données, c'est ta seule copie.
          </p>
          <a className="btn" href="#/donnees">Sauvegarder maintenant</a>
        </div>
      )}

      {!vide && (
        <section className="carte" aria-labelledby="titre-matchs">
          <h2 id="titre-matchs">Matchs</h2>
          {contenu.matchs.length ? (
            <div className="faits">
              <div className="fait"><span>Matchs chargés</span><b>{contenu.matchs.length}</b></div>
              <div className="fait"><span>Jours</span><b>{jours.length ? jours.map(dateCourte).join(" · ") : "⏳"}</b></div>
              <div className="fait"><span>Au moins une méthode « On joue »</span><b>{aJouer}</b></div>
            </div>
          ) : (
            <p className="aide">Aucun match chargé : récupère ceux du jour dans l'onglet « Matchs ».</p>
          )}
          <a className="btn secondaire" href="#/matchs">{contenu.matchs.length ? "Voir les matchs" : "Récupérer les matchs"}</a>
        </section>
      )}

      {!vide && (
        <section className="carte" aria-labelledby="titre-paris">
          <h2 id="titre-paris">Paris</h2>
          <div className="faits">
            <div className="fait"><span>Paris notés</span><b>{contenu.paris.length}</b></div>
            <div className="fait"><span>Terminés</span><b>{b.nbTermines}</b></div>
            {b.parMethode.map((m) => (
              <div className="fait" key={m.methode}>
                <span>Méthode {m.methode} ({m.nb})</span>
                <b className={m.gains >= 0 ? "pos" : "neg"}>{eur(m.gains)}</b>
              </div>
            ))}
          </div>
          <a className="btn secondaire" href="#/paris">Voir le journal</a>
        </section>
      )}
    </>
  );
}
