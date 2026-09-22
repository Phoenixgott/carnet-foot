/**
 * Chances de gagner (≥ 2 buts) selon la minute où tu entres, méthode +1.5 : répond directement à
 * « si je parie maintenant, ou si j'attends ? ». La zone ombrée est la fourchette d'incertitude du
 * modèle (pas une 2ᵉ donnée) ; « Maintenant » marque la minute en cours. Un seul survol/glissé du
 * doigt suit le point le plus proche, avec une infobulle ; le détail complet reste dans le tableau
 * replié en dessous (toujours atteignable, écrans lecteurs compris).
 */
import { useRef, useState } from "react";
import { fr, pc } from "../../core/format";
import { MINUTES_TABLEAU, tableauLive } from "../../core/modele-v2/live";

const L = 28;
const R = 12;
const T = 20;
const B = 24;
const largeur = 600;
const hauteur = 230;
const REPERES = [0.25, 0.5, 0.75];

export function GraphiqueChances({
  lambda,
  sigma,
  rep,
  minute,
}: {
  lambda: number;
  sigma: number;
  rep?: readonly number[];
  minute: number;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const points = tableauLive(lambda, sigma, rep);
  const n = points.length;
  const xAt = (i: number) => L + (n > 1 ? (i / (n - 1)) * (largeur - L - R) : 0);
  const yAt = (v: number) => T + (1 - Math.min(Math.max(v, 0), 1)) * (hauteur - T - B);

  const ligne = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.p).toFixed(1)}`).join(" ");
  const bandeHaut = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.pHaut).toFixed(1)}`).join(" ");
  const bandeBas = [...points].reverse().map((p, i) => `L${xAt(n - 1 - i).toFixed(1)},${yAt(p.pBas).toFixed(1)}`).join(" ");
  const bande = `${bandeHaut} ${bandeBas} Z`;

  const mMin = MINUTES_TABLEAU[0];
  const mMax = MINUTES_TABLEAU[n - 1];
  const mClamp = Math.min(Math.max(minute, mMin), mMax);
  const xMaintenant = L + ((mClamp - mMin) / (mMax - mMin)) * (largeur - L - R);
  const dansLaPlage = minute >= mMin && minute <= mMax;

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

  const pt = actif !== null ? points[actif] : null;
  const debut = points[0];
  const fin = points[n - 1];

  return (
    <div className="graphique-chances" data-test="graphique-chances">
      <div className="gc-legende">
        <span className="gc-puce-ligne" aria-hidden="true" /> Chances estimées
        <span className="gc-puce-bande" aria-hidden="true" /> Fourchette (marge d'erreur)
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${largeur} ${hauteur}`}
        role="img"
        aria-label={
          `Chances de gagner selon la minute : ${pc(debut.p)} à la ${debut.minute}ᵉ minute, ` +
          `${pc(fin.p)} à la ${fin.minute}ᵉ minute. Plus tu attends, moins tu as de chances.`
        }
        onPointerMove={(e: PointerEvent) => setActif(pointLePlusProche(e.clientX))}
        onPointerDown={(e: PointerEvent) => setActif(pointLePlusProche(e.clientX))}
        onPointerLeave={() => setActif(null)}
      >
        {REPERES.map((v) => (
          <g key={v}>
            <line x1={L} y1={yAt(v)} x2={largeur - R} y2={yAt(v)} className="gc-grille" />
            <text x={0} y={yAt(v) + 4} className="gc-texte gc-texte-muet">{Math.round(v * 100)}%</text>
          </g>
        ))}
        <path d={bande} className="gc-bande" />
        <path d={ligne} className="gc-ligne" />
        {dansLaPlage && (
          <>
            <line x1={xMaintenant} y1={T} x2={xMaintenant} y2={hauteur - B} className="gc-maintenant" />
            <text x={xMaintenant} y={T - 6} textAnchor="middle" className="gc-texte gc-maintenant-texte">Maintenant</text>
          </>
        )}
        {actif !== null && (
          <>
            <line x1={xAt(actif)} y1={T} x2={xAt(actif)} y2={hauteur - B} className="gc-curseur" />
            <circle cx={xAt(actif)} cy={yAt(points[actif].p)} r={5} className="gc-point" />
          </>
        )}
        {points.map((p, i) => (
          <text key={p.minute} x={xAt(i)} y={hauteur - 6} textAnchor="middle" className="gc-texte gc-texte-muet">{p.minute}′</text>
        ))}
      </svg>
      <div className="gc-infobulle" aria-live="polite" data-test="gc-infobulle">
        {pt ? (
          <>
            <b className="num">{pc(pt.p)}</b> de chances à la <b>{pt.minute}ᵉ minute</b> (entre {pc(pt.pBas)} et {pc(pt.pHaut)}) · cote juste{" "}
            {fr(pt.coteJuste)}, cote minimale <b>{fr(pt.coteMinimale)}</b>
          </>
        ) : (
          <span className="aide">Effleure la courbe pour voir le détail à une minute.</span>
        )}
      </div>
      <details className="repli">
        <summary>Voir les chiffres, minute par minute</summary>
        <div className="tableau-defilant">
          <table className="tableau-live" data-test="tableau-live">
            <thead>
              <tr>
                <th scope="col">Minute</th>
                <th scope="col">Chances</th>
                <th scope="col">Fourchette</th>
                <th scope="col">Cote juste</th>
                <th scope="col">Cote minimale</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.minute} className={Math.abs(p.minute - minute) < 3 ? "actuelle" : ""}>
                  <th scope="row">{p.minute}ᵉ</th>
                  <td data-test="tab-chances">{pc(p.p)}</td>
                  <td data-test="tab-fourchette">{pc(p.pBas)}–{pc(p.pHaut)}</td>
                  <td data-test="tab-cote-juste">{fr(p.coteJuste)}</td>
                  <td data-test="tab-cote-mini"><b>{fr(p.coteMinimale)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="aide">
          La cote minimale est celle à exiger pour rester gagnant même si l'estimation est un peu trop optimiste. Ce sont des estimations :
          elles peuvent se tromper.
        </p>
      </details>
    </div>
  );
}
