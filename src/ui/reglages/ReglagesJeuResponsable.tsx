/**
 * Réglages de jeu responsable (phase 8) : rappels après une série de défaites ou un plafond du
 * jour dépassé, et pause (auto-exclusion) que l'utilisateur règle et retire lui-même. Rien n'est
 * envoyé nulle part ; rien n'est jamais un vrai blocage technique, sauf pendant une pause active,
 * où l'ajout d'un nouveau pari est remplacé par un rappel (voir PauseActive).
 */
import { useState } from "react";
import { lireSaisie } from "../../core/format";
import {
  completerReglagesJeuResponsable,
  demarrerPause,
  dureeLisible,
  pauseActive,
  secondesRestantes,
} from "../../core/jeu-responsable";
import { pauseDe, reglagesJeuResponsableDe } from "../../data/jeu-responsable";
import { ecrireReglage } from "../../data/depot";
import { ChampMontant } from "../champs";
import { useAppli } from "../contexte";

const t = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
const DUREES_RAPIDES: Array<[number, string]> = [[24, "24 h"], [72, "3 jours"], [168, "7 jours"]];

export function ReglagesJeuResponsable() {
  const { contenu, recharger, message, confirmer } = useAppli();
  const reglages = reglagesJeuResponsableDe(contenu);
  const pause = pauseDe(contenu);
  const maintenant = new Date();
  const active = pauseActive(pause, maintenant);

  const [defaites, setDefaites] = useState(t(reglages.rappelApresDefaites));
  const [plafond, setPlafond] = useState(t(reglages.rappelApresPlafondJour));
  const [duree, setDuree] = useState(String(reglages.dureePauseHeures).replace(".", ","));
  const [dureePerso, setDureePerso] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = async (e: Event) => {
    e.preventDefault();
    const d = lireSaisie(defaites);
    const p = lireSaisie(plafond);
    const h = lireSaisie(duree);
    if (d === undefined || p === undefined) {
      setErreur("Défaites et plafond : tape un nombre, ou laisse vide pour désactiver le rappel.");
      return;
    }
    if (h === undefined || h === null || h <= 0) {
      setErreur("Durée de pause : tape un nombre d'heures supérieur à 0.");
      return;
    }
    setErreur(null);
    await ecrireReglage("jeuResponsable", completerReglagesJeuResponsable({ rappelApresDefaites: d, rappelApresPlafondJour: p, dureePauseHeures: h }));
    await recharger();
    message("Réglages de jeu responsable enregistrés");
  };

  const demarrer = async (heures: number) => {
    await ecrireReglage("pause", demarrerPause(heures, new Date(), "Pause posée dans les réglages"));
    await recharger();
    message("Pause commencée");
  };

  const arreter = async () => {
    if (!pause) return;
    const ok = await confirmer({
      titre: "Arrêter la pause maintenant ?",
      texte: `Il reste ${dureeLisible(secondesRestantes(pause, new Date()))}. Tu l'avais posée toi-même : prends un instant avant de l'arrêter.`,
      action: "Arrêter la pause",
      danger: true,
    });
    if (!ok) return;
    await ecrireReglage("pause", null);
    await recharger();
    message("Pause arrêtée");
  };

  return (
    <section className="carte" aria-labelledby="titre-jeu-responsable" data-test="reglages-jeu-responsable">
      <h2 id="titre-jeu-responsable">Jeu responsable</h2>
      <p className="aide">
        Jouer comporte des risques : endettement, dépendance… Appelle le 09 74 75 13 13 (appel non surtaxé) ou va sur joueurs-info-service.fr.
      </p>

      {active && pause ? (
        <div className="bandeau attention" role="status" data-test="pause-reglages">
          <p>
            Pause en cours{pause.raison ? ` (${pause.raison})` : ""}. Encore <b>{dureeLisible(secondesRestantes(pause, maintenant))}</b>.
          </p>
          <button type="button" className="btn secondaire" onClick={arreter}>Arrêter la pause</button>
        </div>
      ) : (
        <div className="section">
          <span className="champ">Faire une pause maintenant</span>
          <div className="rangee">
            {DUREES_RAPIDES.map(([h, libelle]) => (
              <button key={h} type="button" className="btn secondaire" onClick={() => demarrer(h)}>{libelle}</button>
            ))}
          </div>
          <div className="rangee" style={{ alignItems: "flex-end" }}>
            <ChampMontant id="pause-perso" libelle="Ou une durée choisie (heures)" valeur={dureePerso} changer={setDureePerso} placeholder="ex. 48" />
            <button
              type="button"
              className="btn secondaire"
              onClick={() => {
                const h = lireSaisie(dureePerso);
                if (h === undefined || h === null || h <= 0) {
                  message("Tape un nombre d'heures supérieur à 0.");
                  return;
                }
                demarrer(h);
              }}
            >
              Commencer
            </button>
          </div>
          <p className="aide">Pendant une pause, aucun nouveau pari ne peut être ajouté au journal. Tu peux l'arrêter à tout moment.</p>
        </div>
      )}

      <h3>Rappels automatiques</h3>
      <form className="section" onSubmit={enregistrer}>
        <div className="grille-champs">
          <ChampMontant id="jr-defaites" libelle="Rappel après ce nombre de défaites d'affilée (facultatif)" valeur={defaites} changer={setDefaites} placeholder="ex. 3" />
          <ChampMontant id="jr-plafond" libelle="Rappel si la mise du jour dépasse (€, facultatif)" valeur={plafond} changer={setPlafond} placeholder="ex. 50" />
        </div>
        <ChampMontant id="jr-duree" libelle="Durée proposée pour la pause (heures)" valeur={duree} changer={setDuree} placeholder="ex. 24" />
        <p className="aide">Un rappel s'affiche sur l'accueil ; c'est toujours toi qui décides de poser une pause ou non.</p>
        {erreur && <p className="bandeau erreur" role="alert">{erreur}</p>}
        <button type="submit" className="btn secondaire">Enregistrer</button>
      </form>
    </section>
  );
}
