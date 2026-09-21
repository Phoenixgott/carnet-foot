/**
 * Champs de saisie partagés, pensés pour le pouce : champ de cote avec gros boutons − et +,
 * choix entre quelques options en gros boutons, champ de montant.
 */
import { useId } from "react";
import { fr, lireSaisie } from "../core/format";

/** Nombre tapé, ou null si la case est vide ou illisible. */
export const nombreOuNull = (s: string): number | null => {
  const x = lireSaisie(s);
  return typeof x === "number" ? x : null;
};

/** Champ numérique avec gros boutons − et + (saisie au pouce). */
export function ChampNombre({
  id,
  libelle,
  valeur,
  changer,
  pas,
  min,
  defaut,
  placeholder,
}: {
  id: string;
  libelle: string;
  valeur: string;
  changer: (t: string) => void;
  pas: number;
  min: number;
  defaut: number;
  placeholder?: string;
}) {
  const bouger = (delta: number) => {
    const x = lireSaisie(valeur);
    const base = typeof x === "number" ? x : defaut;
    changer(fr(Math.max(min, Math.round((base + delta) * 100) / 100)));
  };
  return (
    <div className="champ-nombre">
      <label className="champ" htmlFor={id}>{libelle}</label>
      <div className="stepper">
        <button type="button" className="btn secondaire" aria-label={`Diminuer : ${libelle}`} onClick={() => bouger(-pas)}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={valeur}
          placeholder={placeholder}
          onChange={(e: Event) => changer((e.target as HTMLInputElement).value)}
        />
        <button type="button" className="btn secondaire" aria-label={`Augmenter : ${libelle}`} onClick={() => bouger(pas)}>+</button>
      </div>
    </div>
  );
}

/** Montant ou nombre libre (clavier numérique), sans boutons − et +. */
export function ChampMontant({
  id,
  libelle,
  valeur,
  changer,
  placeholder,
  aide,
}: {
  id: string;
  libelle: string;
  valeur: string;
  changer: (t: string) => void;
  placeholder?: string;
  aide?: string;
}) {
  return (
    <label className="champ" htmlFor={id}>
      {libelle}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={valeur}
        placeholder={placeholder}
        onChange={(e: Event) => changer((e.target as HTMLInputElement).value)}
      />
      {aide && <small className="aide">{aide}</small>}
    </label>
  );
}

/** Choix entre quelques options, en gros boutons. */
export function Choix<T extends string>({
  libelle,
  valeur,
  options,
  changer,
}: {
  libelle: string;
  valeur: T;
  options: Array<[T, string]>;
  changer: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="section">
      <span className="champ" id={id}>{libelle}</span>
      <div className="segments segments-gros" role="group" aria-labelledby={id}>
        {options.map(([v, t]) => (
          <button key={v} type="button" aria-pressed={valeur === v} onClick={() => changer(v)}>{t}</button>
        ))}
      </div>
    </div>
  );
}
