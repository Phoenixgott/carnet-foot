/**
 * Accueil, pensé pour quelqu'un qui n'y connaît rien : la bankroll en grand, trois gros boutons
 * « Que veux-tu faire ? », la semaine en une phrase, et les rappels importants.
 */
import { alertesCote } from "../../core/cotes";
import { analyserV2 } from "../../core/modele-v2/analyse";
import { eur, pc } from "../../core/format";
import { bilan } from "../../core/paris";
import { bilanHebdomadaire } from "../../core/bilan-hebdo";
import { demarrerPause, pauseActive, rappelPause } from "../../core/jeu-responsable";
import { pauseDe, reglagesJeuResponsableDe } from "../../data/jeu-responsable";
import { ecrireReglage } from "../../data/depot";
import { bankrollChoisie, bankrollDe, estVide } from "../../data/contenu";
import { ChoixBankroll, PremiersPas } from "../accueil/Bienvenue";
import { ReglagesRemiseAZero } from "../reglages/ReglagesRemiseAZero";
import { jourLocal } from "../../data/versions";
import { joursDepuis, RAPPEL_SAUVEGARDE_JOURS, useAppli } from "../contexte";
import { useCompte, useInclinaison3D } from "../animation";
import { Mascotte } from "../mascotte";

/** Petites icônes des cartes de la bankroll (décoratives, la valeur et l'étiquette suffisent à comprendre). */
function IconeStat({ nom }: { nom: "hausse" | "baisse" | "etoile" | "liste" }) {
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
    case "liste":
      return (
        <svg {...commun} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h8M5 8h8M5 12h8" />
          <circle cx="2.5" cy="4" r=".6" />
          <circle cx="2.5" cy="8" r=".6" />
          <circle cx="2.5" cy="12" r=".6" />
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
  const tauxAnime = useCompte(b.tauxReussite);
  const aujourdhui = jourLocal(new Date());
  const aVenir = contenu.matchs.filter((m) => !m.date || m.date >= aujourdhui);
  const aJouer = aVenir.filter((m) => analyserV2(m, "+1.5", contexteDe(m)).v === "ok" || analyserV2(m, "+2.5", contexteDe(m)).v === "ok").length;
  const rappel = !vide && (!dernierExport || joursDepuis(dernierExport) >= RAPPEL_SAUVEGARDE_JOURS);
  const alertes = aVenir.flatMap((m) => alertesCote(m, contexteDe));
  const pause = pauseDe(contenu);
  const enPause = pauseActive(pause, new Date());
  const rappel8 = !vide && !enPause ? rappelPause(contenu.paris, reglagesJeuResponsableDe(contenu), aujourdhui) : null;
  const dureePause = reglagesJeuResponsableDe(contenu).dureePauseHeures;
  const semaine = !vide ? bilanHebdomadaire(contenu.paris, aujourdhui).cetteSemaine : null;
  const gagnesSemaine = semaine ? Math.round(semaine.tauxReussite * semaine.nb) : 0;

  // Tout premier démarrage : une seule question, la bankroll de départ.
  if (vide && !bankrollChoisie(contenu)) {
    return (
      <>
        <div>
          <h1 tabIndex={-1}>Accueil</h1>
          <p className="chapeau">Tes données restent sur ce téléphone : rien n'est envoyé à un serveur.</p>
        </div>
        <ChoixBankroll />
      </>
    );
  }

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Accueil</h1>
        <p className="chapeau">Tes données restent sur ce téléphone : rien n'est envoyé à un serveur.</p>
      </div>

      <section className="gazon" aria-labelledby="titre-bankroll" ref={ref3d}>
        <div className="gazon-fond" aria-hidden="true">
          <span className="gazon-lueur gazon-lueur-1" />
          <span className="gazon-lueur gazon-lueur-2" />
          <span className="gazon-reflet" />
        </div>
        <Mascotte humeur={b.gains >= 0 ? "content" : "neutre"} />
        <span className="etiquette" id="titre-bankroll">Mon argent pour parier</span>
        <span className="gazon-chiffre" data-test="bankroll">{eur(bankrollAnime)}</span>
        <div className="gazon-ligne">
          <div className={b.gains >= 0 ? "gazon-pos" : "gazon-neg"}>
            <b>{eur(gainsAnime)}</b>
            <small><IconeStat nom={b.gains >= 0 ? "hausse" : "baisse"} /> Gagné / perdu</small>
          </div>
          <div>
            <b>{contenu.paris.length}</b>
            <small><IconeStat nom="liste" /> Paris notés</small>
          </div>
          <div>
            <b>{Number.isFinite(tauxAnime) ? pc(tauxAnime) : "—"}</b>
            <small><IconeStat nom="etoile" /> Gagnés</small>
          </div>
        </div>
      </section>

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
          <p>⏸️ Tu es en pause. Pour voir le temps qui reste ou l'arrêter : Réglages → Jeu responsable.</p>
        </div>
      )}

      {alertes.length > 0 && (
        <section className="alerte-cote" aria-labelledby="titre-alertes" data-test="alertes-accueil">
          <h2 id="titre-alertes">
            <span aria-hidden="true">🔔 </span>
            {alertes.length === 1 ? "Une cote est devenue intéressante" : `${alertes.length} cotes sont devenues intéressantes`}
          </h2>
          <ul>
            {alertes.map((a) => (
              <li key={a.matchId + a.marche}>{a.texte}</li>
            ))}
          </ul>
          <a className="btn" href="#/matchs">Voir les matchs</a>
        </section>
      )}

      <PremiersPas vide={vide} matchsConseilles={aJouer} />

      {semaine && (
        <section className="carte" aria-labelledby="titre-semaine" data-test="bilan-semaine">
          <h2 id="titre-semaine">Cette semaine</h2>
          <p className="phrase-semaine">
            {semaine.nb === 0 ? (
              "Pas encore de pari terminé cette semaine."
            ) : (
              <>
                <b className={semaine.gains >= 0 ? "pos" : "neg"}>{eur(semaine.gains)}</b> sur {semaine.nb} pari{semaine.nb > 1 ? "s" : ""} terminé
                {semaine.nb > 1 ? "s" : ""} ({gagnesSemaine} gagné{gagnesSemaine > 1 ? "s" : ""}).
              </>
            )}
          </p>
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

      {!vide && <ReglagesRemiseAZero />}
    </>
  );
}
