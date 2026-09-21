/**
 * « Récupérer les matchs », en 3 étapes comme dans le carnet :
 *  1. choisir le jour et les compétitions, copier la demande ;
 *  2. l'envoyer dans une nouvelle conversation Claude avec la recherche web ;
 *  3. coller sa réponse : aperçu (nouveaux, mis à jour, doublons, valeurs écartées), puis import.
 * Plus : la demande de compléments et la mise à jour des cotes du jour J.
 */
import { useState } from "react";
import { fiabilite } from "../../core/carnet-v1/fiabilite";
import {
  COMPETITIONS,
  COMPETITIONS_PAR_DEFAUT,
  construireDemande,
  construireDemandeComplements,
  construireDemandeCotes,
  LIBELLE_GROUPE,
  MAX_TOTAL_CHOIX,
  OPTIONS_PAR_DEFAUT,
  PAR_REPONSE_CHOIX,
  type GroupeCompetition,
} from "../../core/demande";
import { dateCourte } from "../../core/format";
import { saisonDe } from "../../core/saison";
import type { Match } from "../../core/types";
import { reglage } from "../../data/contenu";
import { ecrireReglage, lireReglage } from "../../data/depot";
import { ErreurImport } from "../../data/import-carnet";
import type { AnalyseImportMatchs } from "../../data/import-matchs";
import { importerMatchs, previsualiserImportMatchs } from "../../data/services";
import { jourLocal } from "../../data/versions";
import { BoutonCopier, signalerAlertes, ZoneTexte } from "../composants";
import { useAppli } from "../contexte";

export interface ReglagesDemande {
  parReponse: number;
  maxTotal: number | null;
}

const nom = (m: Match) => `${m.domicile?.nom ?? "?"} – ${m.exterieur?.nom ?? "?"}`;

/** File d'attente des changements de réglages : exécutés un par un, dans l'ordre. */
let file: Promise<void> = Promise.resolve();
const enFile = (travail: () => Promise<void>) => {
  file = file.then(travail, travail).catch(() => {});
  return file;
};

/** Infos à compléter tout de suite (hors cotes et absents, publiés tard). */
export function infosEssentiellesManquantes(m: Match): string[] {
  return fiabilite(m)
    .missing.filter((x) => !x.later)
    .map((x) => x.label);
}

/* ------------------------------------------------------------------ */
function Etape1() {
  const { contenu, recharger } = useAppli();
  const choisies = reglage<string[]>(contenu, "competitions") ?? [...COMPETITIONS_PAR_DEFAUT];
  const options = { ...OPTIONS_PAR_DEFAUT, ...(reglage<ReglagesDemande>(contenu, "demande") ?? {}) };
  const [date, setDate] = useState(jourLocal(new Date()));
  const [unMatch, setUnMatch] = useState("");
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const texte = dateOk ? construireDemande({ date, unMatch, competitions: choisies, ...options }) : "";

  // Chaque changement repart de la valeur enregistrée (et non de l'affichage, qui peut avoir
  // un temps de retard), les uns après les autres : deux touches rapides ne s'annulent pas.
  const basculer = (cle: string, oui: boolean) =>
    enFile(async () => {
      const actuelles = (await lireReglage<string[]>("competitions")) ?? [...COMPETITIONS_PAR_DEFAUT];
      const suite = oui ? [...actuelles, cle] : actuelles.filter((c) => c !== cle);
      await ecrireReglage("competitions", COMPETITIONS.map((c) => c.cle).filter((c) => suite.includes(c)));
      await recharger();
    });
  const changerOptions = (o: Partial<ReglagesDemande>) =>
    enFile(async () => {
      const actuelles = { ...OPTIONS_PAR_DEFAUT, ...((await lireReglage<ReglagesDemande>("demande")) ?? {}) };
      await ecrireReglage("demande", { ...actuelles, ...o });
      await recharger();
    });

  return (
    <li className="etape">
      <span className="etape-num" aria-hidden="true">1</span>
      <div className="section">
        <h3>Copie la demande</h3>
        <div className="grille-champs">
          <label className="champ" htmlFor="demande-date">
            Jour des matchs
            <input id="demande-date" type="date" value={date} onChange={(e: Event) => setDate((e.target as HTMLInputElement).value)} />
          </label>
          <label className="champ" htmlFor="demande-un-match">
            Un seul match ? (facultatif)
            <input
              id="demande-un-match"
              type="text"
              placeholder="ex. Lens – Brest"
              value={unMatch}
              onChange={(e: Event) => setUnMatch((e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        {dateOk && <p className="aide">Saison des statistiques : {saisonDe(date)}.</p>}
        {!unMatch.trim() &&
          (Object.keys(LIBELLE_GROUPE) as GroupeCompetition[]).map((g) => (
            <fieldset className="puces" key={g}>
              <legend>{LIBELLE_GROUPE[g]}</legend>
              {COMPETITIONS.filter((c) => c.groupe === g).map((c) => (
                <label key={c.cle} title={c.libelle}>
                  <input type="checkbox" checked={choisies.includes(c.cle)} onChange={(e: Event) => basculer(c.cle, (e.target as HTMLInputElement).checked)} />
                  <span>{c.cle}</span>
                </label>
              ))}
            </fieldset>
          ))}
        <div className="grille-champs">
          <label className="champ" htmlFor="demande-par-reponse">
            Matchs par réponse
            <select
              id="demande-par-reponse"
              value={String(options.parReponse)}
              onChange={(e: Event) => changerOptions({ parReponse: Number((e.target as HTMLSelectElement).value) })}
            >
              {PAR_REPONSE_CHOIX.map((n) => (
                <option key={n} value={String(n)}>{n}, puis « SUITE DISPONIBLE »</option>
              ))}
            </select>
          </label>
          {!unMatch.trim() && (
            <label className="champ" htmlFor="demande-max">
              Nombre de matchs au total
              <select
                id="demande-max"
                value={options.maxTotal === null ? "tous" : String(options.maxTotal)}
                onChange={(e: Event) => {
                  const v = (e.target as HTMLSelectElement).value;
                  changerOptions({ maxTotal: v === "tous" ? null : Number(v) });
                }}
              >
                {MAX_TOTAL_CHOIX.map((n) => (
                  <option key={String(n)} value={n === null ? "tous" : String(n)}>{n === null ? "Tous les matchs du jour" : `Au plus ${n}`}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!unMatch.trim() && choisies.length === 0 && (
          <p className="bandeau attention">Aucune compétition cochée : la demande portera sur la Ligue 1.</p>
        )}
        {dateOk ? (
          <>
            <BoutonCopier texte={texte} libelle="Copier la demande" succes="Demande copiée. Colle-la dans une nouvelle conversation." large />
            <details className="repli">
              <summary>Voir le texte de la demande</summary>
              <pre className="code" data-test="texte-demande">{texte}</pre>
            </details>
          </>
        ) : (
          <p className="bandeau attention">Choisis le jour des matchs.</p>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
function Etape3() {
  const { contenu, recharger, message } = useAppli();
  const [texte, setTexte] = useState("");
  const [apercu, setApercu] = useState<AnalyseImportMatchs | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<{ analyse: AnalyseImportMatchs; touches: Match[] } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const analyser = (t: string) => {
    setTexte(t);
    setErreur(null);
    setApercu(null);
    if (!t.trim()) return;
    setFait(null);
    try {
      setApercu(previsualiserImportMatchs(t, contenu.matchs));
    } catch (e) {
      setErreur(e instanceof ErreurImport ? e.message : "Lecture impossible : " + String(e));
    }
  };

  const importer = async () => {
    if (!apercu) return;
    setEnCours(true);
    try {
      const r = await importerMatchs(apercu);
      setFait({ analyse: apercu, touches: apercu.aEcrire });
      setApercu(null);
      setTexte("");
      await recharger();
      message(r.ecrits ? "Matchs enregistrés" : "Rien de nouveau");
      await signalerAlertes(r.alertes, message);
    } catch (e) {
      setErreur(e instanceof ErreurImport ? e.message : "Import impossible : " + String(e));
    } finally {
      setEnCours(false);
    }
  };

  const a = apercu;
  const incomplets = fait ? fait.touches.map((m) => ({ m, manque: infosEssentiellesManquantes(m) })).filter((x) => x.manque.length) : [];
  const seulementTard = fait && !incomplets.length && fait.touches.some((m) => fiabilite(m).missing.length > 0);

  return (
    <li className="etape">
      <span className="etape-num" aria-hidden="true">3</span>
      <div className="section">
        <h3>Colle sa réponse</h3>
        <p className="aide">Colle toute la réponse, même avec du texte autour. Les matchs s'ajoutent à ceux déjà chargés ; un match déjà présent est complété, jamais dupliqué.</p>
        <ZoneTexte id="reponse-claude" libelle="Réponse de Claude" valeur={texte} accept=".json,.txt,application/json,text/plain" changer={analyser} />
        {erreur && (
          <div className="bandeau erreur" role="alert">
            <p>{erreur}</p>
          </div>
        )}
        {a && (
          <div className="section" data-test="apercu-matchs">
            <div className="faits">
              <div className="fait"><span>Matchs reçus</span><b>{a.nbRecus}</b></div>
              <div className="fait"><span>Nouveaux</span><b data-test="nb-nouveaux">{a.nouveaux.length}</b></div>
              <div className="fait"><span>Déjà présents, complétés</span><b data-test="nb-mis-a-jour">{a.misAJour.length}</b></div>
              <div className="fait"><span>Déjà présents, rien de nouveau</span><b>{a.inchanges.length}</b></div>
              {a.ignores.length > 0 && <div className="fait"><span>Ignorés</span><b>{a.ignores.length}</b></div>}
            </div>
            {a.nouveaux.length > 0 && (
              <div>
                <h4>Nouveaux</h4>
                <ul className="liste-simple">
                  {a.nouveaux.map((m) => (
                    <li key={m.id}>
                      <b>{nom(m)}</b> <small>{m.ligue ?? ""} · {dateCourte(m.date)} {m.heure ?? ""}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.misAJour.length > 0 && (
              <div>
                <h4>Complétés</h4>
                <ul className="liste-simple">
                  {a.misAJour.map((x) => (
                    <li key={x.apres.id}>
                      <b>{nom(x.apres)}</b>
                      {x.cotesChangees && <span className="puce-info">cotes suivies</span>}
                      <small>{x.champs.join(", ")}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(a.avertissements.length > 0 || a.ignores.length > 0) && (
              <div className="bandeau attention">
                <p>À savoir :</p>
                <ul>
                  {[...a.ignores, ...a.avertissements].map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {a.aEcrire.length ? (
              <button type="button" className="btn large" onClick={importer} disabled={enCours}>
                {enCours ? "Enregistrement…" : `Enregistrer ${a.nouveaux.length ? a.nouveaux.length + " nouveau" + (a.nouveaux.length > 1 ? "x" : "") : ""}${a.nouveaux.length && a.misAJour.length ? " et " : ""}${a.misAJour.length ? a.misAJour.length + " complété" + (a.misAJour.length > 1 ? "s" : "") : ""}`}
              </button>
            ) : (
              <p className="bandeau info">Rien de nouveau dans cette réponse : aucun match à enregistrer.</p>
            )}
            {a.suiteDisponible && <p className="aide">Cette réponse annonce une suite : enregistre-la, puis écris « continue » dans l'autre conversation.</p>}
          </div>
        )}
        {fait && (
          <div className="bandeau ok" role="status" data-test="resultat-matchs">
            <p>
              <b>
                {fait.analyse.nouveaux.length} match{fait.analyse.nouveaux.length > 1 ? "s" : ""} ajouté{fait.analyse.nouveaux.length > 1 ? "s" : ""},{" "}
                {fait.analyse.misAJour.length} complété{fait.analyse.misAJour.length > 1 ? "s" : ""}.
              </b>
            </p>
            {fait.analyse.suiteDisponible && (
              <p data-test="suite-disponible">
                Il reste des matchs : écris <b>continue</b> dans l'autre conversation, puis colle la suite ici.
              </p>
            )}
            {seulementTard && <p>Seuls les cotes et les absents manquent : c'est normal avant le jour J. Mets-les à jour le jour du match (plus bas).</p>}
          </div>
        )}
        {incomplets.length > 0 && (
          <div className="bandeau attention" data-test="complements">
            <p>
              Il manque des infos sur {incomplets.length} match{incomplets.length > 1 ? "s" : ""} :
            </p>
            <ul>
              {incomplets.slice(0, 6).map((x) => (
                <li key={x.m.id}>
                  {nom(x.m)} : {x.manque.join(", ")}
                </li>
              ))}
              {incomplets.length > 6 && <li>…</li>}
            </ul>
            <BoutonCopier
              texte={construireDemandeComplements(incomplets, incomplets[0].m.date || jourLocal(new Date()))}
              libelle="Copier la demande de compléments"
              succes="Demande copiée. Colle-la dans la même conversation que les matchs."
            />
            <p className="aide">À coller dans la même conversation, puis colle la réponse ici : les infos s'ajoutent aux matchs.</p>
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
function MiseAJourJourJ() {
  const { contenu } = useAppli();
  const aujourdhui = jourLocal(new Date());
  const jours = [...new Set(contenu.matchs.map((m) => m.date).filter((d): d is string => !!d && d >= aujourdhui))].sort();
  const [jour, setJour] = useState<string>("");
  const choisi = jours.includes(jour) ? jour : (jours[0] ?? "");
  const matchs = contenu.matchs
    .filter((m) => m.date === choisi)
    .sort((x, y) => String(x.heure).localeCompare(String(y.heure)));
  if (!jours.length) return null;
  return (
    <section className="section" aria-labelledby="titre-jour-j">
      <h3 id="titre-jour-j">Le jour du match : cotes et absents</h3>
      <p className="aide">
        Les cotes bougent et les absents sont annoncés tard. Copie cette demande (dans la même conversation ou une nouvelle), puis colle la réponse
        à l'étape 3 : chaque changement de cote est gardé dans le suivi du match.
      </p>
      <label className="champ" htmlFor="jour-j">
        Matchs du
        <select id="jour-j" value={choisi} onChange={(e: Event) => setJour((e.target as HTMLSelectElement).value)}>
          {jours.map((j) => (
            <option key={j} value={j}>
              {j === aujourdhui ? "aujourd'hui" : dateCourte(j)} ({contenu.matchs.filter((m) => m.date === j).length} matchs)
            </option>
          ))}
        </select>
      </label>
      <BoutonCopier
        texte={construireDemandeCotes(matchs)}
        libelle={`Copier la demande de cotes (${matchs.length} match${matchs.length > 1 ? "s" : ""})`}
        succes="Demande de cotes copiée."
        secondaire
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function Recuperer({ ouvert }: { ouvert: boolean }) {
  return (
    <details className="carte recuperer" open={ouvert} data-test="recuperer">
      <summary>
        <span className="recuperer-titre">Récupérer les matchs</span>
        <span className="aide">3 étapes, 2 minutes</span>
      </summary>
      <ol className="etapes">
        <Etape1 />
        <li className="etape">
          <span className="etape-num" aria-hidden="true">2</span>
          <div className="section">
            <h3>Envoie-la à Claude</h3>
            <p className="aide">
              Ouvre une <b>nouvelle conversation</b>, active la <b>recherche web</b>, colle et envoie. Si Claude écrit « SUITE DISPONIBLE », réponds{" "}
              <b>continue</b> et colle chaque partie à l'étape 3.
            </p>
          </div>
        </li>
        <Etape3 />
      </ol>
      <MiseAJourJourJ />
    </details>
  );
}
