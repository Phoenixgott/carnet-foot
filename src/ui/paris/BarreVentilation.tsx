/**
 * Ventilation en barres horizontales divergentes (vert si le solde est positif, rouge sinon),
 * une ligne par catégorie (méthode, compétition, jour de la semaine, tranche de cote).
 * Peu de catégories à la fois : les chiffres (nombre, ROI, réussite) restent toujours visibles,
 * sans repli sur une infobulle.
 */
import { eur, pc } from "../../core/format";
import type { Ventilation } from "../../core/bankroll";

export function BarreVentilation<T>({ lignes }: { lignes: ReadonlyArray<Ventilation<T>> }) {
  if (!lignes.length) return <p className="vide">Aucun pari terminé pour l'instant.</p>;
  const maxAbs = Math.max(...lignes.map((l) => Math.abs(l.gains)), 1);
  return (
    <div className="ventilation" data-test="ventilation">
      {lignes.map((l) => (
        <div className="vent-ligne" key={String(l.cle)}>
          <div className="vent-entete">
            <span className="vent-libelle">{l.libelle}</span>
            <b className={`num ${l.gains >= 0 ? "pos" : "neg"}`}>{eur(l.gains)}</b>
          </div>
          <div className="vent-piste">
            <div className={`vent-barre ${l.gains >= 0 ? "pos" : "neg"}`} style={{ width: `${Math.max((Math.abs(l.gains) / maxAbs) * 100, 2)}%` }} />
          </div>
          <p className="aide vent-details">
            {l.nb} pari{l.nb > 1 ? "s" : ""} · ROI {pc(l.roi)} · réussite {pc(l.tauxReussite)}
          </p>
        </div>
      ))}
    </div>
  );
}
