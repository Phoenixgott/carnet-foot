/**
 * Formulaire d'ajout ou de modification d'un pari : méthode, match (texte libre ou lié à un
 * match chargé), cote, mise, statut, gain saisi à la main (paris « manuel »), notes, photo du
 * ticket (redimensionnée avant d'être enregistrée, jamais envoyée nulle part).
 */
import { useEffect, useRef, useState } from "react";
import { METHODES } from "../../core/methodes";
import { alerteMise } from "../../core/mises";
import { LIBELLE_STATUT } from "../../core/paris";
import { eur, lireSaisie, lireSaisieSignee } from "../../core/format";
import type { BrouillonPari } from "../../data/brouillon-pari";
import { reglagesMisesDe } from "../../data/bankroll";
import { ErreurImport } from "../../data/import-carnet";
import { ajouterPari, enregistrerPhotoTicket, lirePhotoDuTicket, modifierPari, retirerPhotoTicket, type SaisiePari } from "../../data/services";
import type { Match, Pari, StatutPari } from "../../core/types";
import { redimensionnerImage, tailleLisible } from "../photo";
import { useAppli } from "../contexte";

const STATUTS: StatutPari[] = ["attente", "gagne", "perdu", "manuel", "rembourse"];
const METHODES_CHOIX = METHODES.map((m) => m.nom);

interface Saisie {
  date: string;
  matchId: string;
  match: string;
  ligue: string;
  methode: Pari["methode"];
  cote: string;
  mise: string;
  statut: StatutPari;
  pnl: string;
  notes: string;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function saisieVide(): Saisie {
  return { date: aujourdhui(), matchId: "", match: "", ligue: "", methode: "+2.5", cote: "", mise: "", statut: "attente", pnl: "", notes: "" };
}

function saisieDepuisPari(p: Pari): Saisie {
  return {
    date: p.date,
    matchId: p.matchId ?? "",
    match: p.match,
    ligue: p.ligue ?? "",
    methode: p.methode,
    cote: String(p.cote).replace(".", ","),
    mise: String(p.mise).replace(".", ","),
    statut: p.statut,
    pnl: p.pnl !== undefined ? String(p.pnl).replace(".", ",") : "",
    notes: p.notes ?? "",
  };
}

function saisieDepuisBrouillon(b: BrouillonPari): Saisie {
  return {
    date: b.date || aujourdhui(),
    matchId: b.matchId ?? "",
    match: b.match,
    ligue: b.ligue ?? "",
    methode: b.methode,
    cote: b.cote !== null ? String(b.cote).replace(".", ",") : "",
    mise: b.mise !== null ? String(b.mise).replace(".", ",") : "",
    statut: b.statut,
    pnl: b.pnl !== undefined ? String(b.pnl).replace(".", ",") : "",
    notes: b.notes ?? "",
  };
}

export function FormulairePari({
  existant,
  brouillon,
  annuler,
  termine,
}: {
  /** null : ajout. */
  existant: Pari | null;
  /** Pré-remplissage venu du Live ou du Freebet (ignoré en modification). */
  brouillon?: BrouillonPari | null;
  annuler: () => void;
  termine: () => void;
}) {
  const { contenu, message } = useAppli();
  const [s, setS] = useState<Saisie>(() => (existant ? saisieDepuisPari(existant) : brouillon ? saisieDepuisBrouillon(brouillon) : saisieVide()));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; taille: number; nouvelle: boolean } | null>(null);
  const [photoRetiree, setPhotoRetiree] = useState(false);
  const fichierPhoto = useRef<Blob | null>(null);
  const champ = <K extends keyof Saisie>(k: K) => (v: Saisie[K]) => setS((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!existant) return;
    let vivant = true;
    lirePhotoDuTicket(existant.id).then((p) => {
      if (vivant && p) setPhoto({ url: URL.createObjectURL(p.blob), taille: p.blob.size, nouvelle: false });
    });
    return () => {
      vivant = false;
    };
  }, [existant]);

  const reglagesMises = reglagesMisesDe(contenu);
  const miseSaisie = lireSaisie(s.mise);
  const alerte =
    typeof miseSaisie === "number" && miseSaisie > 0
      ? alerteMise(
          existant ? contenu.paris.filter((p) => p.id !== existant.id) : contenu.paris,
          reglagesMises,
          s.date,
          miseSaisie,
        )
      : null;

  const matchsTries = [...contenu.matchs].sort(
    (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.heure).localeCompare(String(b.heure)),
  );
  const nomMatch = (m: Match) => `${m.domicile?.nom ?? "?"} – ${m.exterieur?.nom ?? "?"}`;
  const lierMatch = (id: string) => {
    const m = contenu.matchs.find((x) => x.id === id);
    setS((x) => ({ ...x, matchId: id, match: m ? nomMatch(m) : x.match, ligue: m?.ligue ?? x.ligue, date: m?.date ?? x.date }));
  };

  const choisirPhoto = async (f: File) => {
    try {
      const blob = await redimensionnerImage(f);
      fichierPhoto.current = blob;
      setPhoto({ url: URL.createObjectURL(blob), taille: blob.size, nouvelle: true });
      setPhotoRetiree(false);
    } catch (e) {
      message(e instanceof Error ? e.message : "Photo illisible.");
    }
  };

  const valider = async (e: Event) => {
    e.preventDefault();
    if (!s.match.trim()) {
      setErreur("Indique le match.");
      return;
    }
    const cote = lireSaisie(s.cote);
    if (cote === undefined || cote === null || cote <= 1) {
      setErreur("Cote : tape un nombre supérieur à 1, par exemple 1,85.");
      return;
    }
    const mise = lireSaisie(s.mise);
    if (mise === undefined || mise === null || mise < 0) {
      setErreur("Mise : tape un nombre positif ou nul.");
      return;
    }
    let pnl: number | undefined;
    if (s.statut === "manuel") {
      const x = lireSaisieSignee(s.pnl);
      if (x === undefined) {
        setErreur("Gain sécurisé : tape un nombre, par exemple 6,5 ou −1,2.");
        return;
      }
      pnl = x ?? 0;
    }
    setErreur(null);
    setEnCours(true);
    const saisie: SaisiePari = {
      date: s.date,
      match: s.match.trim(),
      methode: s.methode,
      cote,
      mise,
      statut: s.statut,
      ...(pnl !== undefined ? { pnl } : {}),
      ...(s.notes.trim() ? { notes: s.notes.trim() } : {}),
      ligue: s.ligue.trim() || null,
      matchId: s.matchId || null,
    };
    try {
      const p = existant ? await modifierPari(existant.id, saisie) : await ajouterPari(saisie);
      if (fichierPhoto.current) await enregistrerPhotoTicket(p.id, fichierPhoto.current);
      else if (photoRetiree) await retirerPhotoTicket(p.id);
      message(existant ? "Pari modifié" : "Pari ajouté");
      termine();
    } catch (err) {
      setErreur(err instanceof ErreurImport ? err.message : "Opération impossible : " + String(err));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form className="carte" onSubmit={valider} aria-labelledby="titre-form-pari" data-test="form-pari">
      <h3 id="titre-form-pari">{existant ? "Modifier le pari" : "Ajouter un pari"}</h3>
      <label className="champ" htmlFor="pari-match-lie">
        Lier à un match chargé (facultatif)
        <select id="pari-match-lie" value={s.matchId} onChange={(e: Event) => lierMatch((e.target as HTMLSelectElement).value)}>
          <option value="">Aucun, ou match non chargé</option>
          {matchsTries.map((m) => (
            <option key={m.id} value={m.id}>
              {nomMatch(m)} · {m.date ?? "date ⏳"}
            </option>
          ))}
        </select>
      </label>
      <label className="champ" htmlFor="pari-match">
        Match
        <input id="pari-match" type="text" value={s.match} placeholder="ex. Lens – Brest" onChange={(e: Event) => champ("match")((e.target as HTMLInputElement).value)} />
      </label>
      <div className="grille-champs">
        <label className="champ" htmlFor="pari-date">
          Date
          <input id="pari-date" type="date" value={s.date} onChange={(e: Event) => champ("date")((e.target as HTMLInputElement).value)} />
        </label>
        <label className="champ" htmlFor="pari-methode">
          Méthode
          <select id="pari-methode" value={s.methode} onChange={(e: Event) => champ("methode")((e.target as HTMLSelectElement).value as Pari["methode"])}>
            {METHODES_CHOIX.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grille-champs">
        <label className="champ" htmlFor="pari-cote">
          Cote
          <input id="pari-cote" type="text" inputMode="decimal" value={s.cote} placeholder="ex. 1,85" onChange={(e: Event) => champ("cote")((e.target as HTMLInputElement).value)} />
        </label>
        <label className="champ" htmlFor="pari-mise">
          Mise (€)
          <input id="pari-mise" type="text" inputMode="decimal" value={s.mise} placeholder="ex. 10" onChange={(e: Event) => champ("mise")((e.target as HTMLInputElement).value)} />
        </label>
      </div>
      {alerte && (alerte.parPari || alerte.parJour?.depasse) && (
        <p className="bandeau attention" role="status" data-test="alerte-plafond-pari">
          {alerte.parPari && <>Cette mise dépasse ton plafond par pari. </>}
          {alerte.parJour?.depasse && (
            <>
              Déjà {eur(alerte.parJour.dejaEngage)} misés le {s.date} : au-delà de ton plafond de {eur(alerte.parJour.plafond)}.{" "}
            </>
          )}
          La décision reste la tienne.
        </p>
      )}
      <label className="champ" htmlFor="pari-statut">
        Résultat
        <select id="pari-statut" value={s.statut} onChange={(e: Event) => champ("statut")((e.target as HTMLSelectElement).value as StatutPari)}>
          {STATUTS.map((st) => (
            <option key={st} value={st}>{LIBELLE_STATUT[st]}</option>
          ))}
        </select>
      </label>
      {s.statut === "manuel" && (
        <label className="champ" htmlFor="pari-pnl">
          Gain sécurisé (€) — négatif si perte
          <input id="pari-pnl" type="text" inputMode="decimal" value={s.pnl} placeholder="ex. 6,50" onChange={(e: Event) => champ("pnl")((e.target as HTMLInputElement).value)} />
          <small className="aide">Pour un cash-out, une couverture ou un freebet : le gain net, pas la mise.</small>
        </label>
      )}
      <label className="champ" htmlFor="pari-notes">
        Notes (facultatif)
        <textarea id="pari-notes" value={s.notes} onChange={(e: Event) => champ("notes")((e.target as HTMLTextAreaElement).value)} />
      </label>
      <div className="section">
        <span className="champ">Photo du ticket (facultatif)</span>
        {photo && (
          <div className="photo-ticket">
            <img src={photo.url} alt="" />
            <div>
              <small className="aide">{tailleLisible(photo.taille)}</small>
              <button
                type="button"
                className="btn discret"
                onClick={() => {
                  setPhoto(null);
                  fichierPhoto.current = null;
                  setPhotoRetiree(true);
                }}
              >
                Retirer la photo
              </button>
            </div>
          </div>
        )}
        <label className="btn secondaire fichier">
          {photo ? "Remplacer la photo" : "Ajouter une photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e: Event) => {
              const input = e.target as HTMLInputElement;
              const f = input.files?.[0];
              if (f) await choisirPhoto(f);
              input.value = "";
            }}
          />
        </label>
        <p className="aide">La photo reste sur ce téléphone : elle n'est ni dans la sauvegarde fichier, ni dans l'historique des versions.</p>
      </div>
      {erreur && (
        <p className="bandeau erreur" role="alert">
          {erreur}
        </p>
      )}
      <div className="rangee">
        <button type="submit" className="btn large" disabled={enCours}>
          {enCours ? "Enregistrement…" : existant ? "Enregistrer le pari" : "Ajouter le pari"}
        </button>
        <button type="button" className="btn secondaire" onClick={annuler}>Annuler</button>
      </div>
    </form>
  );
}
