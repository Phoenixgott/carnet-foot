/**
 * Journal des paris : liste, ajout, modification, suppression. Les paris venus du carnet et ceux
 * ajoutés dans l'app se modifient de la même façon (l'app est désormais le carnet de paris).
 */
import { useEffect, useState } from "react";
import { dateCourte, eur, fr } from "../../core/format";
import { gainPari, LIBELLE_STATUT } from "../../core/paris";
import type { BrouillonPari } from "../../data/brouillon-pari";
import { retirerBrouillonPari } from "../../data/brouillon-pari";
import { lirePhotoDuTicket, supprimerPari } from "../../data/services";
import type { Pari } from "../../core/types";
import { useAppli } from "../contexte";
import { FormulairePari } from "./FormulairePari";

function VignettePhoto({ pariId }: { pariId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    let objectUrl: string | null = null;
    lirePhotoDuTicket(pariId).then((p) => {
      if (vivant && p) {
        objectUrl = URL.createObjectURL(p.blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      vivant = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pariId]);
  if (!url) return null;
  return <img className="pari-photo" src={url} alt="Ticket du pari" />;
}

export function Journal() {
  const { contenu, recharger, message, confirmer } = useAppli();
  const [edition, setEdition] = useState<{ id: string | null } | null>(null);
  const [brouillon, setBrouillon] = useState<BrouillonPari | null>(null);
  const [photos, setPhotos] = useState<Set<string>>(new Set());

  // Un pari préparé depuis le Live ou le Freebet ouvre directement le formulaire.
  useEffect(() => {
    retirerBrouillonPari().then((b) => {
      if (b) {
        setBrouillon(b);
        setEdition({ id: null });
      }
    });
  }, []);

  useEffect(() => {
    let vivant = true;
    Promise.all(contenu.paris.map((p) => lirePhotoDuTicket(p.id).then((ph) => (ph ? p.id : null)))).then((ids) => {
      if (vivant) setPhotos(new Set(ids.filter((x): x is string => !!x)));
    });
    return () => {
      vivant = false;
    };
  }, [contenu.paris]);

  const journal = [...contenu.paris].sort((a, b) => b.ordre - a.ordre);
  const enEdition = edition?.id ? (contenu.paris.find((p) => p.id === edition.id) ?? null) : null;

  const supprimer = async (p: Pari) => {
    const ok = await confirmer({
      titre: "Supprimer ce pari ?",
      texte: `« ${p.match} » (${LIBELLE_STATUT[p.statut]}) sera retiré de ton journal. Une copie de sécurité de tes données est faite avant.`,
      action: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await supprimerPari(p.id);
    await recharger();
    message("Pari supprimé");
  };

  return (
    <div className="section" data-test="journal">
      {!edition && (
        <button type="button" className="btn large" onClick={() => setEdition({ id: null })}>
          Ajouter un pari
        </button>
      )}
      {edition && (
        <FormulairePari
          existant={enEdition}
          brouillon={brouillon}
          annuler={() => {
            setEdition(null);
            setBrouillon(null);
          }}
          termine={async () => {
            setEdition(null);
            setBrouillon(null);
            await recharger();
          }}
        />
      )}
      <h2>Journal ({journal.length})</h2>
      {journal.length === 0 ? (
        <p className="vide">
          Aucun pari pour l'instant. Ajoutes-en un, ou importe l'export de ton carnet dans l'onglet « Données ».
        </p>
      ) : (
        <ul className="liste-paris" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {journal.map((p) => {
            const g = gainPari(p);
            const termine = p.statut !== "attente" && p.statut !== "rembourse";
            return (
              <li className="pari" key={p.id} data-test="ligne-pari">
                {photos.has(p.id) && <VignettePhoto pariId={p.id} />}
                <span className="pari-match">{p.match || "Match sans nom"}</span>
                <span className={`statut ${p.statut}`}>{LIBELLE_STATUT[p.statut]}</span>
                <span className="pari-meta">
                  {p.date ? dateCourte(p.date) : "date ⏳"} · Méthode {p.methode} · cote <span className="num">{fr(p.cote)}</span> · mise{" "}
                  <span className="num">{eur(p.mise)}</span>
                  {p.ligue ? ` · ${p.ligue}` : ""}
                </span>
                {p.notes && <span className="pari-notes">{p.notes}</span>}
                <span className={`pari-gain ${g > 0 ? "pos" : g < 0 ? "neg" : ""}`}>{termine ? eur(g) : "—"}</span>
                <div className="rangee rangee-serree pari-actions">
                  <button type="button" className="btn discret" aria-label={`Modifier le pari ${p.match}`} onClick={() => setEdition({ id: p.id })}>
                    Modifier
                  </button>
                  <button type="button" className="btn discret" aria-label={`Supprimer le pari ${p.match}`} onClick={() => supprimer(p)}>
                    Supprimer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
