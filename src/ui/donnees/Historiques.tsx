/**
 * Historiques de résultats : import des fichiers CSV de football-data.co.uk
 * (un ou plusieurs à la fois), aperçu, doublons, puis résumé par championnat et saison.
 * Ils servent au nouveau modèle (avantage du terrain, part des buts en 1re mi-temps),
 * aux fiches équipe, et serviront au backtest (phase 7).
 */
import { useState } from "react";
import { dateCourte, fr } from "../../core/format";
import { ErreurImport } from "../../data/import-carnet";
import { resumerResultats, type GroupeResultats } from "../../data/import-csv";
import { importerResultats, previsualiserCsv, supprimerGroupeResultats, type ApercuCsv } from "../../data/services";
import { lireFichierTexte } from "../composants";
import { useAppli } from "../contexte";

interface ApercuFichier {
  nom: string;
  apercu: ApercuCsv | null;
  erreur: string | null;
}

const pc = (x: number) => Math.round(x * 100) + " %";
const annee = (iso: string) => dateCourte(iso) + " " + iso.slice(0, 4);

function TableauGroupes({ groupes, supprimer }: { groupes: GroupeResultats[]; supprimer?: (g: GroupeResultats) => void }) {
  return (
    <ul className="groupes" data-test={supprimer ? "historiques-enregistres" : "historiques-apercu"}>
      {groupes.map((g) => (
        <li key={g.cle}>
          <div>
            <b>
              {g.championnat} {g.saison}
            </b>
            <small>
              {g.nb} matchs, du {annee(g.du)} au {annee(g.au)}
            </small>
            <small>
              {fr(g.moyenneButs)} buts par match · 2+ buts {pc(g.partPlus15)} · 3+ buts {pc(g.partPlus25)}
            </small>
          </div>
          {supprimer && (
            <button type="button" className="btn discret" aria-label={`Supprimer ${g.championnat} ${g.saison}`} onClick={() => supprimer(g)}>
              Supprimer
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Historiques() {
  const { message, confirmer, resultats, rechargerResultats } = useAppli();
  const enregistres = resumerResultats(resultats);
  const [fichiers, setFichiers] = useState<ApercuFichier[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const rafraichir = rechargerResultats;

  const choisir = async (liste: FileList | null) => {
    setErreur(null);
    if (!liste?.length) return;
    const sortie: ApercuFichier[] = [];
    for (const f of Array.from(liste)) {
      try {
        sortie.push({ nom: f.name, apercu: await previsualiserCsv(await lireFichierTexte(f)), erreur: null });
      } catch (e) {
        sortie.push({ nom: f.name, apercu: null, erreur: e instanceof ErreurImport ? e.message : "Lecture impossible : " + String(e) });
      }
    }
    setFichiers(sortie);
  };

  const valides = fichiers.filter((f) => f.apercu);
  const aImporter = valides.flatMap((f) => f.apercu!.analyse.resultats);

  const importer = async () => {
    setEnCours(true);
    try {
      const n = await importerResultats(aImporter);
      setFichiers([]);
      await rafraichir();
      message(`${n} résultats enregistrés`);
    } catch (e) {
      setErreur(e instanceof ErreurImport ? e.message : "Import impossible : " + String(e));
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (g: GroupeResultats) => {
    const ok = await confirmer({
      titre: `Supprimer ${g.championnat} ${g.saison} ?`,
      texte: `Les ${g.nb} résultats de ce championnat pour cette saison seront supprimés. Tu pourras les réimporter depuis le fichier CSV.`,
      action: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await supprimerGroupeResultats(g.division, g.saison);
    await rafraichir();
    message("Historique supprimé");
  };

  return (
    <section className="carte" aria-labelledby="titre-historiques">
      <h2 id="titre-historiques">Historiques de résultats (CSV)</h2>
      <p className="aide">
        Sur football-data.co.uk, rubrique « Data Files », télécharge le fichier CSV d'un championnat et d'une saison (ex. France, Ligue 1), puis
        choisis-le ici. Tu peux en choisir plusieurs à la fois. Ils donnent au nouveau modèle le vrai avantage du terrain de chaque
        championnat, remplissent les fiches équipe, et serviront aux tests sur les saisons passées (phase 7).
      </p>
      <p className="aide">
        Ce sont des données publiques : elles ne sont pas dans la sauvegarde fichier ni dans l'historique des versions. En cas de perte, il suffit
        de réimporter les fichiers.
      </p>
      <label className="btn secondaire fichier">
        Choisir des fichiers CSV
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          multiple
          className="sr-only"
          data-test="fichiers-csv"
          onChange={async (e: Event) => {
            const input = e.target as HTMLInputElement;
            await choisir(input.files);
            input.value = "";
          }}
        />
      </label>
      {erreur && (
        <div className="bandeau erreur" role="alert">
          <p>{erreur}</p>
        </div>
      )}
      {fichiers.length > 0 && (
        <div className="section" data-test="apercu-csv">
          {fichiers.map((f) => (
            <div key={f.nom} className="section">
              <h3>{f.nom}</h3>
              {f.erreur ? (
                <div className="bandeau erreur" role="alert">
                  <p>{f.erreur}</p>
                </div>
              ) : (
                <>
                  <div className="faits">
                    <div className="fait"><span>Matchs joués lus</span><b>{f.apercu!.analyse.resultats.length}</b></div>
                    <div className="fait"><span>Nouveaux</span><b data-test="csv-nouveaux">{f.apercu!.comparaison.nouveaux}</b></div>
                    <div className="fait"><span>Déjà enregistrés (identiques)</span><b data-test="csv-identiques">{f.apercu!.comparaison.identiques}</b></div>
                    {f.apercu!.comparaison.modifies > 0 && (
                      <div className="fait"><span>Déjà enregistrés, corrigés par ce fichier</span><b>{f.apercu!.comparaison.modifies}</b></div>
                    )}
                    {f.apercu!.analyse.nbPasJoues > 0 && (
                      <div className="fait"><span>Pas encore joués (ignorés)</span><b>{f.apercu!.analyse.nbPasJoues}</b></div>
                    )}
                    {f.apercu!.analyse.nbDoublonsFichier > 0 && (
                      <div className="fait"><span>En double dans le fichier (gardés une fois)</span><b>{f.apercu!.analyse.nbDoublonsFichier}</b></div>
                    )}
                  </div>
                  <TableauGroupes groupes={f.apercu!.analyse.groupes} />
                  {f.apercu!.analyse.ignorees.length > 0 && (
                    <div className="bandeau attention">
                      <p>Lignes écartées ({f.apercu!.analyse.ignorees.length}) :</p>
                      <ul>
                        {f.apercu!.analyse.ignorees.slice(0, 5).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                        {f.apercu!.analyse.ignorees.length > 5 && <li>…</li>}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {aImporter.length > 0 && (
            <button type="button" className="btn large" disabled={enCours} onClick={importer}>
              {enCours ? "Enregistrement…" : `Enregistrer ${aImporter.length} résultats`}
            </button>
          )}
        </div>
      )}
      <h3>Enregistrés sur ce téléphone</h3>
      {enregistres.length === 0 ? (
        <p className="vide">Aucun historique pour l'instant.</p>
      ) : (
        <TableauGroupes groupes={enregistres} supprimer={supprimer} />
      )}
    </section>
  );
}
