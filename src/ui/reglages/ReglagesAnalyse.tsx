/**
 * Réglages de l'analyse : poids des absents et seuils des critères +1.5 et +2.5.
 * Par défaut, ceux du carnet d'origine.
 */
import { useState } from "react";
import { CONTEXTES, SEUILS_CARNET, type SeuilsCriteres } from "../../core/carnet-v1/criteres";
import { lireSaisie } from "../../core/format";
import { REGLAGES_ANALYSE_DEFAUT, type ReglagesAnalyse as Reglages } from "../../core/modele-v2/reglages";
import { reglagesAnalyseDe } from "../../data/analyse";
import { ecrireReglage } from "../../data/depot";
import { useAppli } from "../contexte";

const POIDS: Array<[number, string]> = [
  [0, "Ignorés"],
  [0.5, "Faible"],
  [1, "Normal"],
  [1.5, "Fort"],
  [2, "Très fort"],
];

type Champ = { cle: string; libelle: string; aide: string; min: number; max: number; pourcent?: boolean; entier?: boolean };

const CHAMPS_15: Champ[] = [
  { cle: "butsParMatch", libelle: "« Marque peu » ou « encaisse peu » à (buts par match)", aide: "Carnet : 1", min: 0, max: 3 },
  { cle: "pctPlus15", libelle: "Matchs à 2+ buts, minimum par équipe (%)", aide: "Carnet : 70", min: 0, max: 100 },
];
const CHAMPS_25: Champ[] = [
  { cle: "moyenneCompetition", libelle: "Moyenne de buts de la compétition, plus de", aide: "Carnet : 2,7", min: 0, max: 6 },
  { cle: "formeMin", libelle: "Forme : buts récents au moins à (% de la moyenne)", aide: "Carnet : 70", min: 0, max: 200, pourcent: true },
  { cle: "h2hMinMatchs", libelle: "Confrontations directes : minimum pour juger", aide: "Carnet : 3", min: 1, max: 10, entier: true },
  { cle: "h2hBon", libelle: "Confrontations à 3+ buts : bon signe à partir de (%)", aide: "Carnet : 60", min: 0, max: 100, pourcent: true },
  { cle: "h2hMauvais", libelle: "… bloquant en dessous de (%)", aide: "Carnet : 40", min: 0, max: 100, pourcent: true },
  { cle: "scoreOk", libelle: "Signaux favorables pour « On joue »", aide: "Carnet : 4", min: 1, max: 6, entier: true },
];

const versTexte = (v: number, pourcent?: boolean) => String(pourcent ? Math.round(v * 100) : v).replace(".", ",");

function textesDe(r: Reglages): Record<string, string> {
  const t: Record<string, string> = {};
  for (const c of CHAMPS_15) t["15." + c.cle] = versTexte((r.seuils.plus15 as any)[c.cle], c.pourcent);
  for (const c of CHAMPS_25) t["25." + c.cle] = versTexte((r.seuils.plus25 as any)[c.cle], c.pourcent);
  return t;
}

export function ReglagesAnalyse() {
  const { contenu, recharger, message } = useAppli();
  const r = reglagesAnalyseDe(contenu);
  const [textes, setTextes] = useState<Record<string, string>>(() => textesDe(r));
  const [contextes, setContextes] = useState<string[]>(r.seuils.plus15.contextesAcceptes);
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = async (suite: Reglages, msg: string) => {
    await ecrireReglage("analyse", suite);
    await recharger();
    message(msg);
  };

  const valider = async (e: Event) => {
    e.preventDefault();
    const seuils: SeuilsCriteres = JSON.parse(JSON.stringify(r.seuils));
    for (const [groupe, champs] of [["15", CHAMPS_15], ["25", CHAMPS_25]] as const) {
      for (const c of champs) {
        const v = lireSaisie(textes[groupe + "." + c.cle] ?? "");
        if (v === null || v === undefined || v < c.min || v > c.max || (c.entier && !Number.isInteger(v))) {
          setErreur(`${c.libelle} : tape ${c.entier ? "un nombre entier" : "un nombre"} de ${c.min} à ${c.max}.`);
          return;
        }
        (groupe === "15" ? (seuils.plus15 as any) : (seuils.plus25 as any))[c.cle] = c.pourcent ? v / 100 : v;
      }
    }
    if (seuils.plus25.h2hMauvais > seuils.plus25.h2hBon) {
      setErreur("Confrontations : le seuil « bloquant » doit être inférieur ou égal au seuil « bon signe ».");
      return;
    }
    seuils.plus15.contextesAcceptes = contextes;
    setErreur(null);
    await enregistrer({ ...r, seuils }, "Critères enregistrés");
  };

  return (
    <section className="carte" aria-labelledby="titre-analyse" data-test="reglages-analyse">
      <h2 id="titre-analyse">Analyse des matchs</h2>
      <p className="aide">Par défaut, les critères du carnet. Les verdicts de tous les matchs changent dès l'enregistrement.</p>

      <h3 id="titre-poids">Poids des absents dans le nouveau modèle</h3>
      <div className="segments" role="group" aria-labelledby="titre-poids">
        {POIDS.map(([p, libelle]) => (
          <button
            key={p}
            type="button"
            aria-pressed={r.poidsAbsents === p}
            onClick={() => enregistrer({ ...r, poidsAbsents: p }, `Poids des absents : ${libelle.toLowerCase()}`)}
          >
            {libelle}
          </button>
        ))}
      </div>
      <p className="aide">
        Normal : attaquant absent −6 % de buts attendus, meilleur buteur absent −8 %, défense affaiblie +5 %. « Fort » multiplie ces effets
        par 1,5 ; « Ignorés » les supprime.
      </p>

      <form className="section" onSubmit={valider}>
        <h3>Méthode +1.5</h3>
        {CHAMPS_15.map((c) => (
          <label className="champ" htmlFor={"seuil-15-" + c.cle} key={c.cle}>
            {c.libelle}
            <input
              id={"seuil-15-" + c.cle}
              type="text"
              inputMode="decimal"
              value={textes["15." + c.cle]}
              onChange={(e: Event) => setTextes({ ...textes, ["15." + c.cle]: (e.target as HTMLInputElement).value })}
            />
            <small className="aide">{c.aide}</small>
          </label>
        ))}
        <fieldset className="puces">
          <legend>Contextes acceptés (les autres : « match imprévisible »)</legend>
          {Object.entries(CONTEXTES).map(([cle, libelle]) => (
            <label key={cle}>
              <input
                type="checkbox"
                checked={contextes.includes(cle)}
                onChange={(e: Event) =>
                  setContextes((e.target as HTMLInputElement).checked ? [...contextes, cle] : contextes.filter((x) => x !== cle))
                }
              />
              <span>{libelle}</span>
            </label>
          ))}
        </fieldset>

        <h3>Méthode +2.5</h3>
        {CHAMPS_25.map((c) => (
          <label className="champ" htmlFor={"seuil-25-" + c.cle} key={c.cle}>
            {c.libelle}
            <input
              id={"seuil-25-" + c.cle}
              type="text"
              inputMode="decimal"
              value={textes["25." + c.cle]}
              onChange={(e: Event) => setTextes({ ...textes, ["25." + c.cle]: (e.target as HTMLInputElement).value })}
            />
            <small className="aide">{c.aide}</small>
          </label>
        ))}
        {erreur && (
          <p className="bandeau erreur" role="alert">
            {erreur}
          </p>
        )}
        <button type="submit" className="btn">Enregistrer les critères</button>
        <button
          type="button"
          className="btn secondaire"
          onClick={async () => {
            setTextes(textesDe(REGLAGES_ANALYSE_DEFAUT));
            setContextes([...SEUILS_CARNET.plus15.contextesAcceptes]);
            setErreur(null);
            await enregistrer({ ...REGLAGES_ANALYSE_DEFAUT, poidsAbsents: r.poidsAbsents }, "Critères du carnet rétablis");
          }}
        >
          Revenir aux critères du carnet
        </button>
      </form>
    </section>
  );
}
