/**
 * Courbe de bankroll : un seul repère (survol ou glissé du doigt) qui suit le point le plus
 * proche, avec une infobulle date + bankroll. Le détail complet reste lisible sans le graphique,
 * dans le tableau replié en dessous (repère toujours atteignable, écrans lecteurs compris).
 */
import { useRef, useState } from "react";
import { eur } from "../../core/format";
import type { PointCourbe } from "../../core/bankroll";

const L = 8;
const R = 8;
const T = 14;
const B = 20;
const largeur = 600;
const hauteur = 200;

function dateLisible(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function GraphiqueBankroll({ courbe }: { courbe: readonly PointCourbe[] }) {
  const [actif, setActif] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const valeurs = courbe.map((p) => p.bankroll);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const marge = (max - min) * 0.1 || Math.max(max * 0.1, 1);
  const yMin = min - marge;
  const yMax = max + marge;
  const n = courbe.length;
  const xAt = (i: number) => L + (n > 1 ? (i / (n - 1)) * (largeur - L - R) : 0);
  const yAt = (v: number) => T + (1 - (v - yMin) / (yMax - yMin || 1)) * (hauteur - T - B);

  const chemin = courbe.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.bankroll).toFixed(1)}`).join(" ");
  const aire = `${chemin} L${xAt(n - 1).toFixed(1)},${(hauteur - B).toFixed(1)} L${xAt(0).toFixed(1)},${(hauteur - B).toFixed(1)} Z`;
  const depart = courbe[0].bankroll;
  const actuelle = courbe[n - 1].bankroll;

  const pointLePlusProche = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((clientX - rect.left) / rect.width) * largeur;
    let meilleur = 0;
    let ecart = Infinity;
    for (let i = 0; i < n; i++) {
      const e = Math.abs(xAt(i) - x);
      if (e < ecart) {
        ecart = e;
        meilleur = i;
      }
    }
    return meilleur;
  };

  const pt = actif !== null ? courbe[actif] : null;

  return (
    <div className="graphique-bankroll">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${largeur} ${hauteur}`}
        role="img"
        aria-label={`Courbe de bankroll, de ${eur(depart)} à ${eur(actuelle)}, sur ${n - 1} paris`}
        onPointerMove={(e: PointerEvent) => setActif(pointLePlusProche(e.clientX))}
        onPointerDown={(e: PointerEvent) => setActif(pointLePlusProche(e.clientX))}
        onPointerLeave={() => setActif(null)}
      >
        <line x1={L} y1={yAt(depart)} x2={largeur - R} y2={yAt(depart)} className="gb-repere" />
        <path d={aire} className="gb-aire" />
        <path d={chemin} className="gb-ligne" />
        {actif !== null && (
          <>
            <line x1={xAt(actif)} y1={T} x2={xAt(actif)} y2={hauteur - B} className="gb-curseur" />
            <circle cx={xAt(actif)} cy={yAt(courbe[actif].bankroll)} r={5} className="gb-point" />
          </>
        )}
        <circle cx={xAt(n - 1)} cy={yAt(actuelle)} r={5} className="gb-point gb-point-fin" />
        <text x={xAt(0)} y={hauteur - 4} className="gb-texte gb-texte-muet">Départ {eur(depart)}</text>
        <text x={xAt(n - 1)} y={hauteur - 4} textAnchor="end" className="gb-texte">{eur(actuelle)}</text>
      </svg>
      <div className="gb-infobulle" aria-live="polite">
        {pt ? (
          <>
            <b className="num">{eur(pt.bankroll)}</b> <span>{pt.date ? dateLisible(pt.date) : "avant le premier pari"}</span>
          </>
        ) : (
          <span className="aide">Effleure la courbe pour voir un point.</span>
        )}
      </div>
      <details className="repli">
        <summary>Voir le détail ({n - 1} paris)</summary>
        <div className="tableau-defilant">
          <table className="tableau-live">
            <thead>
              <tr>
                <th scope="col">Pari</th>
                <th scope="col">Date</th>
                <th scope="col">Bankroll</th>
              </tr>
            </thead>
            <tbody>
              {courbe.map((p, i) => (
                <tr key={i}>
                  <th scope="row">{i === 0 ? "Départ" : i}</th>
                  <td>{p.date ? dateLisible(p.date) : "—"}</td>
                  <td>{eur(p.bankroll)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
