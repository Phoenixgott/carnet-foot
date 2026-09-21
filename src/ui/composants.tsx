/**
 * Composants réutilisables de l'interface.
 */
import { useEffect, useRef, useState } from "react";
import type { Verdict } from "../core/carnet-v1/criteres";
import { ICONE_VERDICT, LIBELLE_VERDICT } from "../core/carnet-v1/analyse";
import type { LigneVerification } from "../data/verification";
import type { AlerteCote } from "../core/cotes";
import { notifier } from "../pwa/pwa";
import { useAppli, type OptionsConfirmation, type Route } from "./contexte";

/** Icônes de la barre d'onglets (traits simples, couleur du texte). */
export function Icone({ nom }: { nom: Route }) {
  const commun = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const p = { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", ...commun };
  switch (nom) {
    case "accueil":
      return <svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>;
    case "matchs":
      return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14" /><circle cx="12" cy="12" r="3" /></svg>;
    case "live":
      return <svg {...p}><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 2M9.5 3h5" /></svg>;
    case "paris":
      return <svg {...p}><path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 9h6M9 13h6" /></svg>;
    case "donnees":
      return <svg {...p}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></svg>;
    case "reglages":
      return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 5.2l2.1 2.1M17.7 16.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 18.8l2.1-2.1M17.7 7.3l2.1-2.1" /></svg>;
  }
}

export function PastilleVerdict({ v }: { v: Verdict }) {
  return (
    <span className={`verdict ${v}`}>
      <span aria-hidden="true">{ICONE_VERDICT[v]}</span> {LIBELLE_VERDICT[v]}
    </span>
  );
}

/** Donnée inconnue : affichée ⏳, jamais inventée. */
export function Inconnu({ titre = "Donnée pas encore disponible" }: { titre?: string }) {
  return (
    <span className="attente" title={titre}>
      <span aria-hidden="true">⏳</span>
      <span className="sr-only">{titre}</span>
    </span>
  );
}

export function ListeControles({ lignes }: { lignes: LigneVerification[] }) {
  return (
    <ul className="controles">
      {lignes.map((l, i) => (
        <li key={i}>
          <span className={`pastille-ico ${l.ok === true ? "ok" : l.ok === false ? "ko" : "info"}`} aria-hidden="true">
            {l.ok === true ? "✓" : l.ok === false ? "✕" : "i"}
          </span>
          <div>
            <span className="sr-only">{l.ok === true ? "Conforme : " : l.ok === false ? "Écart : " : "Information : "}</span>
            {l.libelle}
            <small>{l.detail}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Boîte de confirmation accessible (élément <dialog> natif : focus piégé, Échap pour annuler).
 * Pilotée par `demande` ; appelle `repondre(true|false)`.
 */
export function Confirmation({ demande, repondre }: { demande: OptionsConfirmation | null; repondre: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (demande && !d.open) d.showModal();
    if (!demande && d.open) d.close();
  }, [demande]);
  return (
    <dialog
      ref={ref}
      className="confirmation"
      aria-labelledby="confirmation-titre"
      onCancel={(e: Event) => {
        e.preventDefault();
        repondre(false);
      }}
    >
      {demande && (
        <form method="dialog" onSubmit={(e: Event) => e.preventDefault()}>
          <h2 id="confirmation-titre">{demande.titre}</h2>
          <p>{demande.texte}</p>
          <div className="rangee">
            <button type="button" className="btn secondaire" onClick={() => repondre(false)}>
              Annuler
            </button>
            <button type="button" className={`btn ${demande.danger ? "danger" : ""}`} onClick={() => repondre(true)}>
              {demande.action}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/**
 * Bouton « copier » : copie le texte dans le presse-papiers ; si le navigateur bloque
 * la copie, le texte s'affiche sélectionnable pour une copie à la main.
 */
export function BoutonCopier({
  texte,
  libelle,
  succes,
  secondaire = false,
  large = false,
}: {
  texte: string;
  libelle: string;
  succes: string;
  secondaire?: boolean;
  large?: boolean;
}) {
  const { message } = useAppli();
  const [aCopier, setACopier] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={`btn${secondaire ? " secondaire" : ""}${large ? " large" : ""}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texte);
            setACopier(null);
            message(succes);
          } catch {
            setACopier(texte);
          }
        }}
      >
        {libelle}
      </button>
      {aCopier && (
        <div className="section" data-test="copie-manuelle">
          <p className="aide">Copie automatique bloquée : appuie longuement dans le texte ci-dessous, « Tout sélectionner », puis « Copier ».</p>
          <textarea readOnly value={aCopier} aria-label={libelle} onFocus={(e: Event) => (e.target as HTMLTextAreaElement).select()} />
        </div>
      )}
    </>
  );
}

/** Prévient d'une ou plusieurs cotes atteintes : message à l'écran et notification du téléphone. */
export async function signalerAlertes(alertes: readonly AlerteCote[], message: (t: string) => void): Promise<void> {
  if (!alertes.length) return;
  message(alertes.length === 1 ? "Cote atteinte : " + alertes[0].texte : `${alertes.length} cotes minimales atteintes`);
  for (const a of alertes) {
    await notifier("Cote atteinte", a.texte, "#/matchs", `cote-${a.matchId}-${a.marche}`).catch(() => "indisponible");
  }
}

/** Lit un fichier texte choisi par l'utilisateur. */
export function lireFichierTexte(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Lecture du fichier impossible."));
    r.readAsText(f);
  });
}

/** Zone de collage + bouton « Coller » + choix de fichier. */
export function ZoneTexte({
  id,
  libelle,
  valeur,
  changer,
  accept,
}: {
  id: string;
  libelle: string;
  valeur: string;
  changer: (t: string) => void;
  accept: string;
}) {
  const [info, setInfo] = useState<string | null>(null);
  return (
    <div className="section">
      <label className="champ" htmlFor={id}>
        {libelle}
      </label>
      <textarea
        id={id}
        value={valeur}
        onChange={(e: Event) => changer((e.target as HTMLTextAreaElement).value)}
        placeholder="Colle le texte ici"
        spellCheck={false}
        autoComplete="off"
      />
      <div className="rangee">
        <button
          type="button"
          className="btn secondaire"
          onClick={async () => {
            try {
              changer(await navigator.clipboard.readText());
              setInfo(null);
            } catch {
              setInfo("Le navigateur bloque la lecture du presse-papiers : appuie longuement dans la zone puis « Coller ».");
            }
          }}
        >
          Coller
        </button>
        <label className="btn secondaire fichier">
          Choisir un fichier
          <input
            type="file"
            accept={accept}
            className="sr-only"
            onChange={async (e: Event) => {
              const input = e.target as HTMLInputElement;
              const f = input.files?.[0];
              if (f) changer(await lireFichierTexte(f));
              input.value = "";
            }}
          />
        </label>
      </div>
      {info && <p className="aide">{info}</p>}
    </div>
  );
}
