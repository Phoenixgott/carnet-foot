/**
 * Remplace le formulaire d'ajout d'un pari pendant une pause (auto-exclusion) active.
 * Modifier ou supprimer un pari déjà noté reste possible : seul l'ajout d'un nouveau pari
 * est concerné, pour ne jamais bloquer la tenue du journal lui-même.
 */
import { useEffect, useState } from "react";
import { dureeLisible, secondesRestantes, type AutoExclusion } from "../../core/jeu-responsable";
import { ecrireReglage } from "../../data/depot";
import { useAppli } from "../contexte";

export function PauseActive({ pause }: { pause: AutoExclusion }) {
  const { confirmer, recharger, message } = useAppli();
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const secondes = secondesRestantes(pause, maintenant);

  const arreter = async () => {
    const ok = await confirmer({
      titre: "Arrêter la pause maintenant ?",
      texte: `Il reste ${dureeLisible(secondes)}. Tu l'avais posée toi-même : prends un instant avant de l'arrêter.`,
      action: "Arrêter la pause",
      danger: true,
    });
    if (!ok) return;
    await ecrireReglage("pause", null);
    await recharger();
    message("Pause arrêtée");
  };

  return (
    <div className="carte pause-active" aria-labelledby="titre-pause-active" data-test="pause-active">
      <h3 id="titre-pause-active">⏸️ Pause en cours</h3>
      <p>
        Tu as mis ton journal en pause{pause.raison ? ` (${pause.raison})` : ""}. Encore <b>{dureeLisible(secondes)}</b> avant de pouvoir noter un
        nouveau pari.
      </p>
      <p className="aide">Modifier ou supprimer un pari déjà noté reste possible. Change d'avis à tout moment : c'est toi qui décides.</p>
      <button type="button" className="btn secondaire" onClick={arreter}>Arrêter la pause</button>
    </div>
  );
}
