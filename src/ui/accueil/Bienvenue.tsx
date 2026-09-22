/**
 * Premier démarrage, en deux temps et sans jargon :
 * 1. « Combien as-tu pour parier ? » (la bankroll de départ de l'utilisateur, jamais imposée) ;
 * 2. « Par où commencer ? » : trois grandes tuiles, une par façon de commencer.
 */
import { useState } from "react";
import { eur, lireSaisie } from "../../core/format";
import { BANKROLL_PAR_DEFAUT, reglagesBankrollValides } from "../../data/contenu";
import { ecrireReglage } from "../../data/depot";
import { Icone } from "../composants";
import { useAppli } from "../contexte";
import { Mascotte } from "../mascotte";

const MONTANTS_RAPIDES = [20, 50, 100, 200];

export function ChoixBankroll() {
  const { recharger, message } = useAppli();
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (montant: number | null | undefined) => {
    const r = reglagesBankrollValides(montant, BANKROLL_PAR_DEFAUT.pctMise);
    if (!r) {
      setErreur("Tape un montant supérieur à 0, par exemple 33.");
      return;
    }
    await ecrireReglage("bankroll", r);
    await recharger();
    message(`C'est parti avec ${eur(r.depart)} !`);
  };

  return (
    <section className="carte bienvenue" aria-labelledby="bienvenue" data-test="bienvenue">
      <div className="bienvenue-entete">
        <Mascotte humeur="salut" />
        <div>
          <h2 id="bienvenue">Bienvenue !</h2>
          <p className="aide">Une seule question pour commencer.</p>
        </div>
      </div>
      <form
        className="section"
        onSubmit={(e: Event) => {
          e.preventDefault();
          valider(lireSaisie(saisie));
        }}
      >
        <label className="champ champ-geant" htmlFor="bienvenue-bankroll">
          Combien as-tu pour parier ?
          <span className="champ-euro">
            <input
              id="bienvenue-bankroll"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={saisie}
              placeholder="33"
              onChange={(e: Event) => setSaisie((e.target as HTMLInputElement).value)}
            />
            <span aria-hidden="true">€</span>
          </span>
        </label>
        <div className="puces-montants" role="group" aria-label="Montants rapides">
          {MONTANTS_RAPIDES.map((m) => (
            <button key={m} type="button" className="btn secondaire" onClick={() => setSaisie(String(m))}>
              {m} €
            </button>
          ))}
        </div>
        {erreur && <p className="bandeau erreur" role="alert">{erreur}</p>}
        <button type="submit" className="btn large">C'est parti</button>
        <p className="aide">C'est ta bankroll de départ. Tu pourras la changer à tout moment dans Réglages. Réservé aux plus de 18 ans.</p>
      </form>
    </section>
  );
}

type Tuile = { lien: string; icone: "paris" | "matchs" | "live" | "donnees"; titre: string; texte: string };

/** Les gros boutons de l'accueil : ce qu'on peut faire, en mots simples. */
export function PremiersPas({ vide, matchsConseilles }: { vide: boolean; matchsConseilles: number }) {
  const tuiles: Tuile[] = [
    {
      lien: "#/matchs",
      icone: "matchs",
      titre: "Trouver des matchs",
      texte: matchsConseilles > 0 ? `${matchsConseilles} match${matchsConseilles > 1 ? "s" : ""} conseillé${matchsConseilles > 1 ? "s" : ""} ✅` : "L'app te dit sur quels matchs parier.",
    },
    { lien: "#/live", icone: "live", titre: "Parier pendant un match", texte: "Un chrono te dit quand parier (+1.5)." },
    { lien: "#/paris", icone: "paris", titre: "Noter un pari", texte: "Note ce que tu as parié : l'app compte tes gains." },
  ];
  if (vide) tuiles.push({ lien: "#/donnees", icone: "donnees", titre: "J'ai déjà un carnet", texte: "Récupère tes anciens paris." });
  return (
    <section aria-labelledby="titre-premiers-pas" data-test="premiers-pas">
      <h2 id="titre-premiers-pas" className="titre-section">{vide ? "Par où commencer ?" : "Que veux-tu faire ?"}</h2>
      <ul className="tuiles-action">
        {tuiles.map((p) => (
          <li key={p.lien}>
            <a className="tuile-action" href={p.lien}>
              <span className="tuile-action-icone" aria-hidden="true"><Icone nom={p.icone} /></span>
              <span className="tuile-action-texte">
                <b>{p.titre}</b>
                <small>{p.texte}</small>
              </span>
              <span className="tuile-action-fleche" aria-hidden="true">›</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
