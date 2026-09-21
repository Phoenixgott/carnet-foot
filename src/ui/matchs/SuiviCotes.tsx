/**
 * Cotes d'un match : cotes actuelles et marge du bookmaker, cote minimale et alerte,
 * saisie de nouvelles cotes, historique des relevés.
 */
import { useState } from "react";
import { alertesCote, coteMinimale, dernierReleve, LIBELLE_MARCHE, MARCHES, sens } from "../../core/cotes";
import { estNombre, fr, lireSaisie } from "../../core/format";
import { margeBookmaker } from "../../core/marge";
import type { CotesMatch, Marche, Match, ReleveCotes } from "../../core/types";
import { ErreurImport } from "../../data/import-carnet";
import { definirCoteMinimale, enregistrerCotes } from "../../data/services";
import { Inconnu, signalerAlertes } from "../composants";
import { useAppli } from "../contexte";

const MOINS: Readonly<Record<Marche, "under15" | "under25">> = { over15: "under15", over25: "under25" };

/** Identifiant utilisable dans un attribut id (les id de matchs contiennent « | »). */
export const idHtml = (id: string) => "m-" + id.replace(/[^A-Za-z0-9_-]/g, "_");

const heureReleve = (r: ReleveCotes) =>
  r.le
    ? new Date(r.le).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "avant le suivi";

export function pourcent(x: number): string {
  return Number.isFinite(x) ? (x * 100).toFixed(1).replace(".", ",") + " %" : "?";
}

/** Marge du bookmaker, la plus fiable disponible (2,5 buts d'abord). */
export function margeAffichee(c: CotesMatch | null | undefined): { marge: number; ligne: string } | null {
  for (const [plus, moins, ligne] of [
    [c?.over25, c?.under25, "2,5 buts"],
    [c?.over15, c?.under15, "1,5 but"],
  ] as const) {
    const m = margeBookmaker(plus, moins);
    if (Number.isFinite(m)) return { marge: m, ligne };
  }
  return null;
}

function Fleche({ s }: { s: -1 | 0 | 1 }) {
  if (!s) return null;
  return (
    <span className={s > 0 ? "pos" : "neg"} aria-label={s > 0 ? "en hausse" : "en baisse"}>
      {s > 0 ? " ↑" : " ↓"}
    </span>
  );
}

function CoteMinimale({ m, marche }: { m: Match; marche: Marche }) {
  const { recharger, message, contexteDe } = useAppli();
  const min = coteMinimale(m, marche, contexteDe);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const id = `${idHtml(m.id)}-min-${marche}`;
  const appliquer = async (v: number | null) => {
    try {
      const alertes = await definirCoteMinimale(m.id, marche, v);
      setTexte("");
      await recharger();
      message(v === null ? "Cote mini calculée rétablie" : "Cote minimale enregistrée");
      await signalerAlertes(alertes, message);
    } catch (e) {
      setErreur(e instanceof ErreurImport ? e.message : String(e));
    }
  };
  return (
    <div className="section">
      <p className="aide">
        Cote minimale ({LIBELLE_MARCHE[marche]}) :{" "}
        {min ? (
          <b data-test={`cote-min-${marche}`}>
            {fr(min.valeur)} ({min.origine === "choisie" ? "choisie par toi" : "calculée, méthode +2.5"})
          </b>
        ) : (
          <>
            <Inconnu titre={marche === "over15" ? "Méthode +1.5 : elle se joue en live, choisis ta cote minimale" : "Pas encore calculable"} />{" "}
            {marche === "over15" ? "à choisir (la méthode +1.5 se joue en live)" : ""}
          </>
        )}
      </p>
      <form
        className="rangee"
        onSubmit={(e: Event) => {
          e.preventDefault();
          const v = lireSaisie(texte);
          if (v === null || v === undefined || v <= 1) {
            setErreur("Tape une cote supérieure à 1, par exemple 1,80.");
            return;
          }
          setErreur(null);
          appliquer(v);
        }}
      >
        <label className="champ" htmlFor={id} style={{ flex: "1 1 140px" }}>
          Ma cote minimale
          <input id={id} type="text" inputMode="decimal" placeholder="ex. 1,80" value={texte} onChange={(e: Event) => setTexte((e.target as HTMLInputElement).value)} />
        </label>
        <button type="submit" className="btn secondaire">Enregistrer</button>
        {min?.origine === "choisie" && (
          <button type="button" className="btn discret" onClick={() => appliquer(null)}>
            {marche === "over25" ? "Revenir à la cote calculée" : "Effacer"}
          </button>
        )}
      </form>
      {erreur && <p className="bandeau erreur" role="alert">{erreur}</p>}
    </div>
  );
}

function NouvellesCotes({ m }: { m: Match }) {
  const { recharger, message } = useAppli();
  const vide = { over15: "", under15: "", over25: "", under25: "", bookmaker: m.cotes?.bookmaker ?? dernierReleve(m)?.bookmaker ?? "" };
  const [v, setV] = useState(vide);
  const [erreur, setErreur] = useState<string | null>(null);
  const base = idHtml(m.id);
  const champs: Array<[keyof typeof vide, string]> = [
    ["over15", "Plus de 1,5"],
    ["under15", "Moins de 1,5"],
    ["over25", "Plus de 2,5"],
    ["under25", "Moins de 2,5"],
  ];
  return (
    <form
      className="section"
      data-test="saisie-cotes"
      onSubmit={async (e: Event) => {
        e.preventDefault();
        const saisie: CotesMatch = {};
        for (const [k, libelle] of champs) {
          if (k === "bookmaker") continue;
          const x = lireSaisie(v[k]);
          if (x === undefined || (x !== null && x <= 1)) {
            setErreur(`${libelle} : tape une cote supérieure à 1, par exemple 1,85.`);
            return;
          }
          if (x !== null) (saisie as Record<string, number>)[k] = x;
        }
        if (!Object.keys(saisie).length) {
          setErreur("Tape au moins une cote.");
          return;
        }
        if (v.bookmaker.trim()) saisie.bookmaker = v.bookmaker.trim();
        setErreur(null);
        try {
          const alertes = await enregistrerCotes(m.id, saisie);
          setV({ ...vide, bookmaker: v.bookmaker });
          await recharger();
          message("Cotes enregistrées");
          await signalerAlertes(alertes, message);
        } catch (err) {
          setErreur(err instanceof ErreurImport ? err.message : String(err));
        }
      }}
    >
      <h4>Nouvelles cotes</h4>
      <p className="aide">Une case vide garde la cote précédente. Chaque changement est daté dans l'historique.</p>
      <div className="grille-cotes">
        {champs.map(([k, libelle]) => (
          <label className="champ" htmlFor={`${base}-${k}`} key={k}>
            {libelle}
            <input
              id={`${base}-${k}`}
              type="text"
              inputMode="decimal"
              placeholder={estNombre(m.cotes?.[k as keyof CotesMatch]) ? fr(m.cotes![k as keyof CotesMatch] as number) : "ex. 1,85"}
              value={v[k]}
              onChange={(e: Event) => setV({ ...v, [k]: (e.target as HTMLInputElement).value })}
            />
          </label>
        ))}
      </div>
      <label className="champ" htmlFor={`${base}-bookmaker`}>
        Bookmaker
        <input id={`${base}-bookmaker`} type="text" value={v.bookmaker} onChange={(e: Event) => setV({ ...v, bookmaker: (e.target as HTMLInputElement).value })} />
      </label>
      {erreur && <p className="bandeau erreur" role="alert">{erreur}</p>}
      <button type="submit" className="btn">Enregistrer ces cotes</button>
    </form>
  );
}

function Historique({ m }: { m: Match }) {
  const h = Array.isArray(m.historiqueCotes) ? m.historiqueCotes : [];
  if (!h.length) return <p className="aide">Pas encore de relevé : les cotes seront suivies dès qu'elles arrivent.</p>;
  const lignes = h.map((r, i) => ({ r, p: i > 0 ? h[i - 1] : null })).reverse();
  return (
    <div>
      <h4>Évolution ({h.length} relevé{h.length > 1 ? "s" : ""})</h4>
      <ul className="releves" data-test="historique-cotes">
        {lignes.map(({ r, p }, i) => (
          <li key={i}>
            <span>
              {heureReleve(r)}
              <small>
                {r.origine === "saisie" ? "saisie" : "import"}
                {r.bookmaker ? " · " + r.bookmaker : ""}
              </small>
            </span>
            <span className="num">
              +1,5 {r.over15 === null ? "⏳" : fr(r.over15)}
              <Fleche s={sens(p?.over15 ?? null, r.over15)} />
            </span>
            <span className="num">
              +2,5 {r.over25 === null ? "⏳" : fr(r.over25)}
              <Fleche s={sens(p?.over25 ?? null, r.over25)} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bandeau d'alerte affiché sur la carte quand une cote atteint la cote minimale. */
export function AlerteCotes({ m }: { m: Match }) {
  const { contexteDe } = useAppli();
  const alertes = alertesCote(m, contexteDe);
  if (!alertes.length) return null;
  return (
    <div className="alerte-cote" role="status" data-test="alerte-cote">
      {alertes.map((a) => (
        <p key={a.marche}>
          <span aria-hidden="true">🔔 </span>Cote atteinte : {LIBELLE_MARCHE[a.marche]} à <b>{fr(a.cote)}</b>, cote mini {fr(a.minimale.valeur)}.
        </p>
      ))}
    </div>
  );
}

export function SuiviCotes({ m }: { m: Match }) {
  const c = m.cotes;
  const marge = margeAffichee(c);
  return (
    <details className="repli cotes">
      <summary>
        Cotes et suivi
        {Array.isArray(m.historiqueCotes) && m.historiqueCotes.length > 1 ? ` · ${m.historiqueCotes.length} relevés` : ""}
      </summary>
      <div className="section">
        <div className="faits">
          {MARCHES.map((k) => (
            <div className="fait" key={k}>
              <span>{LIBELLE_MARCHE[k].replace(/^./, (x) => x.toUpperCase())}</span>
              <b>
                {estNombre(c?.[k]) ? fr(c![k] as number) : <Inconnu titre="Cote inconnue" />}
                <small className="sous-valeur">
                  {" "}
                  (moins : {estNombre(c?.[MOINS[k]]) ? fr(c![MOINS[k]] as number) : "⏳"})
                </small>
              </b>
            </div>
          ))}
          <div className="fait">
            <span>Marge du bookmaker</span>
            <b data-test="marge">{marge ? `${pourcent(marge.marge)} (${marge.ligne})` : <Inconnu titre="Il faut les cotes « plus de » et « moins de » d'une même ligne" />}</b>
          </div>
          <div className="fait">
            <span>Bookmaker</span>
            <b>{c?.bookmaker || <Inconnu titre="Bookmaker inconnu" />}</b>
          </div>
        </div>
        {MARCHES.map((k) => (
          <CoteMinimale key={k} m={m} marche={k} />
        ))}
        <NouvellesCotes m={m} />
        <Historique m={m} />
      </div>
    </details>
  );
}
