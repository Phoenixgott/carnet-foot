/**
 * Bouton « Tout remettre à zéro » : efface paris, matchs et réglages pour repartir comme au
 * premier jour. Une copie de sécurité est faite juste avant (Données → Historique des versions).
 */
import { remettreAZero } from "../../data/services";
import { useAppli } from "../contexte";

export function ReglagesRemiseAZero() {
  const { confirmer, recharger, rechargerResultats, message } = useAppli();

  const effacer = async () => {
    const ok = await confirmer({
      titre: "Tout remettre à zéro ?",
      texte:
        "Tous tes paris, tes matchs, ta bankroll et tes réglages seront effacés : l'application repart comme au premier jour. Une copie de sécurité est gardée dans Données → Historique des versions, au cas où tu changerais d'avis.",
      action: "Tout effacer",
      danger: true,
    });
    if (!ok) return;
    await remettreAZero();
    await recharger();
    await rechargerResultats();
    message("Tout est remis à zéro");
    location.hash = "#/accueil";
  };

  return (
    <section className="carte zone-danger" aria-labelledby="titre-remise-a-zero" data-test="remise-a-zero">
      <h2 id="titre-remise-a-zero">Tout remettre à zéro</h2>
      <p className="aide">Efface tout pour recommencer comme au premier jour.</p>
      <button type="button" className="btn danger large" onClick={effacer}>
        Tout remettre à zéro
      </button>
    </section>
  );
}
