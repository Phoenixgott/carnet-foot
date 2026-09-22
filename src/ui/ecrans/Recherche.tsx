/**
 * Recherche : retrouve un match ou un pari par un mot.
 * Tout reste sur l'appareil, comme le reste de l'application.
 */
import { useEffect, useRef, useState } from "react";
import { rechercher, type ResultatRecherche } from "../../core/recherche";
import { useAppli } from "../contexte";

const LIBELLE_TYPE: Record<ResultatRecherche["type"], string> = { match: "Match", pari: "Pari" };

export function Recherche() {
  const { contenu } = useAppli();
  const [q, setQ] = useState("");
  const champ = useRef<HTMLInputElement | null>(null);
  useEffect(() => champ.current?.focus(), []);

  const resultats = rechercher(q, contenu.matchs, contenu.paris);

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Recherche</h1>
        <p className="chapeau">Tape le nom d'une équipe pour retrouver un match ou un pari.</p>
      </div>

      <label className="champ" htmlFor="recherche-mot">
        <span className="sr-only">Rechercher</span>
        <input
          ref={champ}
          id="recherche-mot"
          type="search"
          value={q}
          placeholder="ex. Lens"
          onChange={(e: Event) => setQ((e.target as HTMLInputElement).value)}
        />
      </label>

      {q.trim().length >= 2 && (
        <p className="aide" role="status" data-test="recherche-nb">
          {resultats.length === 0 ? "Aucun résultat." : `${resultats.length} résultat${resultats.length > 1 ? "s" : ""}.`}
        </p>
      )}

      {resultats.length > 0 && (
        <ul className="liste-recherche" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }} data-test="resultats-recherche">
          {resultats.map((r) => (
            <li key={r.type + r.id}>
              <a className="carte" href={r.lien} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <span className="etiquette">{LIBELLE_TYPE[r.type]}</span>
                <p style={{ margin: "4px 0 0", fontWeight: 700 }}>{r.titre}</p>
                {r.detail && <p className="aide" style={{ margin: "2px 0 0" }}>{r.detail}</p>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
