/**
 * Mes données : import depuis le carnet d'origine, sauvegarde en un fichier,
 * restauration, historique des versions et protection du stockage.
 */
import { useEffect, useState } from "react";
import { eur } from "../../core/format";
import { bankrollDe, estVide } from "../../data/contenu";
import { ErreurImport } from "../../data/import-carnet";
import { listerVersions } from "../../data/depot";
import { lireSauvegarde, type SauvegardeLue } from "../../data/sauvegarde";
import {
  creerVersion,
  demanderStockagePersistant,
  etatStockage,
  importerCarnet,
  noterExportFichier,
  preparerSauvegarde,
  previsualiserImportCarnet,
  restaurerSauvegarde,
  restaurerVersion,
  type EtatStockage,
  type ResultatImport,
} from "../../data/services";
import { LIBELLE_RAISON, type Version } from "../../data/versions";
import { EST_APERCU } from "../../pwa/pwa";
import { ListeControles, ZoneTexte } from "../composants";
import { joursDepuis, useAppli } from "../contexte";

const messageErreur = (e: unknown) =>
  e instanceof ErreurImport ? e.message : "Opération impossible : " + (e instanceof Error ? e.message : String(e));

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* ------------------------------------------------------------------ */
function ImportCarnet() {
  const { contenu, recharger, message, confirmer } = useAppli();
  const [texte, setTexte] = useState("");
  const [apercu, setApercu] = useState<ReturnType<typeof previsualiserImportCarnet> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [enCours, setEnCours] = useState(false);

  const analyser = (t: string) => {
    setResultat(null);
    setErreur(null);
    setApercu(null);
    if (!t.trim()) return;
    try {
      setApercu(previsualiserImportCarnet(t));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };

  const importer = async () => {
    if (!apercu) return;
    if (!estVide(contenu)) {
      const ok = await confirmer({
        titre: "Remplacer les données ?",
        texte: `L'application contient ${contenu.paris.length} paris et ${contenu.matchs.length} matchs. Ils seront remplacés par ceux du carnet. Une copie de sécurité est faite avant : tu pourras revenir en arrière depuis l'historique.`,
        action: "Remplacer",
      });
      if (!ok) return;
    }
    setEnCours(true);
    try {
      const r = await importerCarnet(apercu.analyse);
      setResultat(r);
      if (r.ok) {
        setApercu(null);
        setTexte("");
        await recharger();
        message("Import réussi");
      }
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  };

  const a = apercu?.analyse;
  return (
    <section className="carte" aria-labelledby="titre-import">
      <h2 id="titre-import">Importer depuis le carnet</h2>
      <p className="aide">
        Dans ton carnet, onglet « Mes paris », touche « Tout exporter » tout en bas, puis colle le texte ici. Le carnet n'est pas modifié. Tu peux
        recommencer autant de fois que tu veux : l'import remplace les données de l'application par celles du carnet.
      </p>
      <ZoneTexte
        id="texte-carnet"
        libelle="Texte de l'export du carnet"
        valeur={texte}
        accept=".json,.txt,application/json,text/plain"
        changer={(t) => {
          setTexte(t);
          analyser(t);
        }}
      />
      {erreur && (
        <div className="bandeau erreur" role="alert">
          <p>{erreur}</p>
        </div>
      )}
      {a && apercu && (
        <div className="section" data-test="apercu-import">
          <h3>Contenu de l'export</h3>
          <div className="faits">
            <div className="fait"><span>Type</span><b>{a.format === "export-complet" ? "Export complet" : "Ancienne sauvegarde"}</b></div>
            {a.exporteLe && <div className="fait"><span>Exporté le</span><b>{dateHeure(a.exporteLe)}</b></div>}
            <div className="fait"><span>Paris</span><b>{a.contenu.paris.length}</b></div>
            <div className="fait">
              <span>Matchs</span>
              <b>{a.contenu.matchs.length}{a.matchsExempleIgnores ? ` (+${a.matchsExempleIgnores} d'exemple ignorés)` : ""}</b>
            </div>
            <div className="fait"><span>Bankroll de départ</span><b>{eur(bankrollDe(a.contenu).depart)}</b></div>
          </div>
          {a.avertissements.length > 0 && (
            <div className="bandeau attention">
              <p>À savoir :</p>
              <ul>{a.avertissements.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          <h3>Contrôles avant import</h3>
          <ListeControles lignes={apercu.avant.lignes} />
          {apercu.avant.ok ? (
            <button type="button" className="btn large" onClick={importer} disabled={enCours}>
              {enCours ? "Import en cours…" : estVide(contenu) ? "Importer ces données" : "Remplacer les données de l'application"}
            </button>
          ) : (
            <div className="bandeau erreur" role="alert"><p>Des écarts empêchent l'import. Rien n'a été modifié.</p></div>
          )}
        </div>
      )}
      {resultat && (
        <div className="section" data-test="resultat-import">
          {resultat.ok ? (
            <div className="bandeau ok" role="status">
              <p>
                <b>Import réussi.</b> {resultat.apres?.lignes.filter((l) => l.ok).length} contrôles conformes après relecture de la base.
              </p>
            </div>
          ) : (
            <div className="bandeau erreur" role="alert">
              <p>
                <b>Import annulé.</b> {resultat.retourArriere ? "Un écart est apparu après l'écriture : l'état précédent a été remis en place." : "Rien n'a été modifié."}
              </p>
            </div>
          )}
          {resultat.apres && <ListeControles lignes={resultat.apres.lignes} />}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
function telecharger(nom: string, texte: string) {
  const url = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Fichier partageable par le menu Partager d'Android (JSON, sinon texte). */
function fichierPartageable(nom: string, texte: string): File | null {
  if (typeof navigator.canShare !== "function") return null;
  const json = new File([texte], nom, { type: "application/json" });
  if (navigator.canShare({ files: [json] })) return json;
  const txt = new File([texte], nom.replace(/\.json$/, ".txt"), { type: "text/plain" });
  return navigator.canShare({ files: [txt] }) ? txt : null;
}

function Sauvegarde() {
  const { contenu, dernierExport, recharger, message, confirmer } = useAppli();
  const [texteCopie, setTexteCopie] = useState<string | null>(null);
  const [aRestaurer, setARestaurer] = useState("");
  const [lue, setLue] = useState<SauvegardeLue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const partageDispo = !EST_APERCU && typeof navigator.canShare === "function";

  const apresExport = async (msg: string) => {
    await noterExportFichier();
    await recharger();
    message(msg);
  };

  const verifier = async (t: string) => {
    changerTexteRestauration(t);
    if (!t.trim()) return;
    try {
      setLue(await lireSauvegarde(t));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };
  function changerTexteRestauration(t: string) {
    setARestaurer(t);
    setLue(null);
    setErreur(null);
  }

  const restaurer = async () => {
    if (!lue) return;
    const ok = await confirmer({
      titre: "Restaurer cette sauvegarde ?",
      texte: `Les données actuelles (${contenu.paris.length} paris, ${contenu.matchs.length} matchs) seront remplacées par celles de la sauvegarde (${lue.resume.nbParis} paris, ${lue.resume.nbMatchs} matchs). Une copie de sécurité est faite avant.`,
      action: "Restaurer",
      danger: true,
    });
    if (!ok) return;
    try {
      await restaurerSauvegarde(aRestaurer);
      changerTexteRestauration("");
      await recharger();
      message("Sauvegarde restaurée");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };

  return (
    <section className="carte" aria-labelledby="titre-sauvegarde">
      <h2 id="titre-sauvegarde">Sauvegarde en un fichier</h2>
      <p className="aide">
        {dernierExport
          ? `Dernière sauvegarde fichier : ${dateHeure(dernierExport.toISOString())} (il y a ${joursDepuis(dernierExport)} jour${joursDepuis(dernierExport) > 1 ? "s" : ""}).`
          : "Aucune sauvegarde fichier pour l'instant."}{" "}
        Garde-la hors du téléphone (Drive, mail) : si le navigateur efface ses données, c'est ta seule copie.
      </p>
      {EST_APERCU && (
        <p className="aide">Dans cet aperçu, le téléphone bloque l'enregistrement de fichiers : utilise « Copier le texte », puis colle-le dans une note ou un mail.</p>
      )}
      <div className="rangee">
        {!EST_APERCU && (
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const f = await preparerSauvegarde();
              telecharger(f.nom, f.texte);
              await apresExport("Fichier enregistré dans tes téléchargements");
            }}
          >
            Enregistrer le fichier
          </button>
        )}
        {partageDispo && (
          <button
            type="button"
            className="btn secondaire"
            onClick={async () => {
              const f = await preparerSauvegarde();
              const fichier = fichierPartageable(f.nom, f.texte);
              if (!fichier) {
                message("Ce téléphone ne permet pas de partager ce fichier : utilise « Enregistrer le fichier ».");
                return;
              }
              try {
                await navigator.share({ files: [fichier], title: "Sauvegarde Carnet de Paris Foot" });
                await apresExport("Sauvegarde partagée");
              } catch (e) {
                if ((e as Error)?.name !== "AbortError") message("Partage impossible : utilise « Enregistrer le fichier ».");
              }
            }}
          >
            Partager (Drive, mail…)
          </button>
        )}
        <button
          type="button"
          className="btn secondaire"
          onClick={async () => {
            const f = await preparerSauvegarde();
            try {
              await navigator.clipboard.writeText(f.texte);
              setTexteCopie(null);
              await apresExport("Sauvegarde copiée");
            } catch {
              setTexteCopie(f.texte);
            }
          }}
        >
          Copier le texte
        </button>
      </div>
      {texteCopie && (
        <div className="section">
          <p className="aide">Copie automatique bloquée : sélectionne tout le texte ci-dessous et copie-le à la main.</p>
          <textarea readOnly value={texteCopie} aria-label="Texte de la sauvegarde" onFocus={(e: Event) => (e.target as HTMLTextAreaElement).select()} />
          <button type="button" className="btn secondaire" onClick={() => apresExport("Sauvegarde notée comme faite").then(() => setTexteCopie(null))}>
            J'ai copié le texte
          </button>
        </div>
      )}

      <h3>Restaurer une sauvegarde</h3>
      <ZoneTexte id="texte-sauvegarde" libelle="Fichier ou texte de sauvegarde" valeur={aRestaurer} accept=".json,.txt,application/json,text/plain" changer={verifier} />
      {erreur && (
        <div className="bandeau erreur" role="alert">
          <p>{erreur}</p>
        </div>
      )}
      {lue && (
        <div className="section">
          <div className="faits">
            <div className="fait"><span>Créée le</span><b>{lue.creeLe ? dateHeure(lue.creeLe) : "⏳"}</b></div>
            <div className="fait"><span>Paris</span><b>{lue.resume.nbParis}</b></div>
            <div className="fait"><span>Matchs</span><b>{lue.resume.nbMatchs}</b></div>
            <div className="fait"><span>Bankroll</span><b>{eur(lue.resume.bankroll)}</b></div>
          </div>
          <div className="bandeau ok"><p>Sauvegarde intacte : son empreinte est vérifiée.</p></div>
          <button type="button" className="btn danger large" onClick={restaurer}>Restaurer cette sauvegarde</button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Historique() {
  const { contenu, recharger, message, confirmer } = useAppli();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const rafraichir = () => listerVersions().then(setVersions).catch(() => setVersions([]));
  useEffect(() => {
    rafraichir();
  }, [contenu]);

  return (
    <section className="carte" aria-labelledby="titre-historique">
      <h2 id="titre-historique">Historique des versions</h2>
      <p className="aide">
        Une copie complète est faite automatiquement chaque jour (30 gardées) et avant chaque import ou restauration (15 gardées). Ces copies restent
        dans l'application : elles ne remplacent pas la sauvegarde fichier.
      </p>
      <button
        type="button"
        className="btn secondaire"
        onClick={async () => {
          await creerVersion("manuelle");
          await rafraichir();
          message("Copie créée");
        }}
      >
        Créer une copie maintenant
      </button>
      {versions === null ? (
        <p className="aide">Chargement…</p>
      ) : versions.length === 0 ? (
        <p className="vide">Aucune copie pour l'instant.</p>
      ) : (
        <ul className="versions">
          {versions.map((v) => (
            <li key={v.id}>
              <span>
                <b>{LIBELLE_RAISON[v.raison]}</b> · {dateHeure(v.creeLe)}
                <br />
                <small>
                  {v.resume.nbParis} paris · {v.resume.nbMatchs} matchs · bankroll {eur(v.resume.bankroll)}
                </small>
              </span>
              <button
                type="button"
                className="btn discret"
                aria-label={`Restaurer la version du ${dateHeure(v.creeLe)}`}
                onClick={async () => {
                  const ok = await confirmer({
                    titre: "Revenir à cette version ?",
                    texte: `Les données actuelles seront remplacées par celles du ${dateHeure(v.creeLe)} (${v.resume.nbParis} paris, ${v.resume.nbMatchs} matchs). Une copie de l'état actuel est faite avant.`,
                    action: "Revenir à cette version",
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await restaurerVersion(v.id);
                    await recharger();
                    message("Version restaurée");
                  } catch (e) {
                    message(messageErreur(e));
                  }
                }}
              >
                Restaurer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Stockage() {
  const { contenu } = useAppli();
  const [etat, setEtat] = useState<EtatStockage | null>(null);
  const rafraichir = () => etatStockage().then(setEtat);
  useEffect(() => {
    rafraichir();
  }, [contenu]);
  const mo = (o: number | null) => (o === null ? "⏳" : (o / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo");
  return (
    <section className="carte" aria-labelledby="titre-stockage">
      <h2 id="titre-stockage">Stockage sur ce téléphone</h2>
      <div className="faits">
        <div className="fait">
          <span>Protection contre l'effacement</span>
          <b>{etat?.persistant === true ? "Activée" : etat?.persistant === false ? "Non activée" : "⏳"}</b>
        </div>
        <div className="fait"><span>Espace utilisé</span><b>{mo(etat?.utiliseOctets ?? null)}</b></div>
      </div>
      {etat?.persistant === false && (
        <>
          <p className="aide">
            Sans protection, Android peut effacer les données de l'application s'il manque de place. Il l'accorde plus volontiers quand l'app est
            installée sur l'écran d'accueil.
          </p>
          <button type="button" className="btn secondaire" onClick={() => demanderStockagePersistant().then(rafraichir)}>
            Protéger mes données
          </button>
        </>
      )}
    </section>
  );
}

export function Donnees() {
  return (
    <>
      <div>
        <h1 tabIndex={-1}>Mes données</h1>
        <p className="chapeau">Tout est enregistré sur ce téléphone, dans le navigateur. Rien n'est envoyé à un serveur.</p>
      </div>
      <ImportCarnet />
      <Sauvegarde />
      <Historique />
      <Stockage />
    </>
  );
}
