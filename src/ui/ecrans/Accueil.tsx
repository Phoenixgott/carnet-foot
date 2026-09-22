/**
 * Accueil : bankroll et bilan en un coup d'œil, état des données, rappels.
 */
import { alertesCote } from "../../core/cotes";
import { offresARappeler, texteDelai } from "../../core/offres";
import { offresDe } from "../../data/offres";
import { analyserV2 } from "../../core/modele-v2/analyse";
import { dateCourte, eur, pc } from "../../core/format";
import { bilan } from "../../core/paris";
import { bilanHebdomadaire } from "../../core/bilan-hebdo";
import { demarrerPause, pauseActive, rappelPause } from "../../core/jeu-responsable";
import { pauseDe, reglagesJeuResponsableDe } from "../../data/jeu-responsable";
import { ecrireReglage } from "../../data/depot";
import { bankrollChoisie, bankrollDe, estVide } from "../../data/contenu";
import { ChoixBankroll, PremiersPas } from "../accueil/Bienvenue";
import { jourLocal } from "../../data/versions";
import { joursDepuis, RAPPEL_SAUVEGARDE_JOURS, useAppli } from "../contexte";
import { useCompte, useInclinaison3D } from "../animation";
import { Mascotte } from "../mascotte";

/** Petites icônes des cartes de la bankroll (décoratives, la valeur et l'étiquette suffisent à comprendre). */
function IconeStat({ nom }: { nom: "hausse" | "baisse" | "pourcent" | "etoile" }) {
  const commun = { viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" };
  switch (nom) {
    case "hausse":
      return (
        <svg {...commun} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 11 6 7 9 10 14 3" />
          <path d="M10 3h4v4" />
        </svg>
      );
    case "baisse":
      return (
        <svg {...commun} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5 6 9 9 6 14 13" />
          <path d="M10 13h4v-4" />
        </svg>
      );
    case "pourcent":
      return (
        <svg {...commun} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="5" r="1.6" />
          <circle cx="11" cy="11" r="1.6" />
          <path d="M12 4 4 12" />
        </svg>
      );
    case "etoile":
      return (
        <svg {...commun} fill="currentColor" stroke="none">
          <path d="M8 1.3 9.8 5.4 14 6 11 9 11.7 13.3 8 11.3 4.3 13.3 5 9 2 6 6.2 5.4 Z" />
        </svg>
      );
  }
}

export function Accueil() {
  const { contenu, dernierExport, contexteDe, recharger, message } = useAppli();
  const vide = estVide(contenu);
  const b = bilan(contenu.paris, bankrollDe(contenu));
  const ref3d = useInclinaison3D<HTMLElement>();
  const bankrollAnime = useCompte(b.bankroll);
  const gainsAnime = useCompte(b.gains);
  const rentabiliteAnimee = useCompte(b.rentabilite);
  const tauxAnime = useCompte(b.tauxReussite);
  const jours = [...new Set(contenu.matchs.map((m) => m.date).filter(Boolean))].sort() as string[];
  const aJouer = contenu.matchs.filter((m) => analyserV2(m, "+1.5", contexteDe(m)).v === "ok" || analyserV2(m, "+2.5", contexteDe(m)).v === "ok").length;
  const rappel = !vide && (!dernierExport || joursDepuis(dernierExport) >= RAPPEL_SAUVEGARDE_JOURS);
  // Alertes de cote des matchs à venir (ou sans date)
  const aujourdhui = jourLocal(new Date());
  const offresBientot = offresARappeler(offresDe(contenu), aujourdhui);
  const alertes = contenu.matchs.filter((m) => !m.date || m.date >= aujourdhui).flatMap((m) => alertesCote(m, contexteDe));
  const pause = pauseDe(contenu);
  const enPause = pauseActive(pause, new Date());
  const rappel8 = !vide && !enPause ? rappelPause(contenu.paris, reglagesJeuResponsableDe(contenu), aujourdhui) : null;
  const dureePause = reglagesJeuResponsableDe(contenu).dureePauseHeures;
  const semaine = !vide ? bilanHebdomadaire(contenu.paris, aujourdhui) : null;

  const bandeauOffres =
    offresBientot.length > 0 ? (
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
    ) : null;

  // Tout premier démarrage : une seule question, la bankroll de départ.
  if (vide && !bankrollChoisie(contenu)) {
    return (
      <>
        <div>
          <h1 tabIndex={-1}>Accueil</h1>
          <p className="chapeau">Tes données restent sur ce téléphone : rien n'est envoyé à un serveur.</p>
        </div>
        <ChoixBankroll />
        {bandeauOffres}
      </>
    );
  }

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Accueil</h1>
        <p className="chapeau">Tes données restent sur ce téléphone : rien n'est envoyé à un serveur.</p>
        {!vide && (
          <p className="aide">
            <a href="#/recherche">🔍 Rechercher un match, un pari, une offre</a>
          </p>
        )}
      </div>

      {
        <section className="gazon" aria-labelledby="titre-bankroll" ref={ref3d}>
          <div className="gazon-fond" aria-hidden="true">
            <span className="gazon-lueur gazon-lueur-1" />
            <span className="gazon-lueur gazon-lueur-2" />
            <span className="gazon-reflet" />
          </div>
          <Mascotte humeur={b.gains >= 0 ? "content" : "neutre"} />
          <span className="etiquette" id="titre-bankroll">Bankroll</span>
          <span className="gazon-chiffre" data-test="bankroll">{eur(bankrollAnime)}</span>
          <div className="gazon-ligne">
            <div className={b.gains >= 0 ? "gazon-pos" : "gazon-neg"}>
              <b>{eur(gainsAnime)}</b>
              <small><IconeStat nom={b.gains >= 0 ? "hausse" : "baisse"} /> Gagné / perdu</small>
            </div>
            <div>
              <b>{Number.isFinite(rentabiliteAnimee) ? pc(rentabiliteAnimee) : "—"}</b>
              <small><IconeStat nom="pourcent" /> Rentabilité</small>
            </div>
            <div>
              <b>{Number.isFinite(tauxAnime) ? pc(tauxAnime) : "—"}</b>
              <small><IconeStat nom="etoile" /> Paris gagnés</small>
            </div>
          </div>
        </section>
      }

      {vide && <PremiersPas />}

      {bandeauOffres}

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

      {rappel8 && (
        <div className="bandeau attention" role="status" data-test="rappel-jeu-responsable">
          <p>{rappel8.texte}</p>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              await ecrireReglage("pause", demarrerPause(dureePause, new Date(), rappel8.texte));
              await recharger();
              message("Pause commencée");
            }}
          >
            Faire une pause de {dureePause} h
          </button>
        </div>
      )}

      {enPause && pause && (
        <div className="bandeau info" role="status" data-test="pause-accueil">
          <p>Ton journal est en pause. Réglages → Jeu responsable pour voir le temps restant ou l'arrêter.</p>
        </div>
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

      {semaine && (
        <section className="carte" aria-labelledby="titre-semaine" data-test="bilan-semaine">
          <h2 id="titre-semaine">Cette semaine</h2>
          {semaine.cetteSemaine.nb === 0 ? (
            <p className="aide">Aucun pari terminé cette semaine pour l'instant.</p>
          ) : (
            <>
              <div className="faits">
                <div className="fait"><span>Paris terminés</span><b>{semaine.cetteSemaine.nb}</b></div>
                <div className="fait">
                  <span>Gagné / perdu</span>
                  <b className={semaine.cetteSemaine.gains >= 0 ? "pos" : "neg"}>{eur(semaine.cetteSemaine.gains)}</b>
                </div>
                <div className="fait"><span>Paris gagnés</span><b>{pc(semaine.cetteSemaine.tauxReussite)}</b></div>
              </div>
              <p className="aide">
                {semaine.cetteSemaine.meilleureMethode && (
                  <>Ce qui a marché : {semaine.cetteSemaine.meilleureMethode.methode} ({eur(semaine.cetteSemaine.meilleureMethode.gains)}). </>
                )}
                {semaine.cetteSemaine.pireMethode && (
                  <>Ce qui a moins marché : {semaine.cetteSemaine.pireMethode.methode} ({eur(semaine.cetteSemaine.pireMethode.gains)}). </>
                )}
                {semaine.semainePrecedente.nb > 0 && (
                  <>La semaine précédente : {eur(semaine.semainePrecedente.gains)} sur {semaine.semainePrecedente.nb} pari
                    {semaine.semainePrecedente.nb > 1 ? "s" : ""}.</>
                )}
              </p>
            </>
          )}
          <a className="btn secondaire" href="#/paris?vue=statistiques">Voir les statistiques</a>
        </section>
      )}
    </>
  );
}
