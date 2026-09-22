/**
 * Mascotte : un petit ballon animé, purement décoratif (aria-hidden), qui réagit à la situation :
 * « salut » pour accueillir sur l'écran vide, « content » quand le bilan est positif, sinon « neutre ».
 * Jamais de mine triste sur une perte : un compagnon encourageant, pas culpabilisant.
 */
export type HumeurMascotte = "salut" | "content" | "neutre";

function etoile(cx: number, cy: number, s: number): string {
  const p = [
    [cx, cy - s],
    [cx + s * 0.28, cy - s * 0.28],
    [cx + s, cy],
    [cx + s * 0.28, cy + s * 0.28],
    [cx, cy + s],
    [cx - s * 0.28, cy + s * 0.28],
    [cx - s, cy],
    [cx - s * 0.28, cy - s * 0.28],
  ];
  return "M" + p.map(([x, y]) => `${x},${y}`).join(" L") + " Z";
}

export function Mascotte({ humeur = "neutre" }: { humeur?: HumeurMascotte }) {
  const content = humeur === "content";
  return (
    <div className={`mascotte mascotte-${humeur}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="mascotte-svg">
        <ellipse className="mascotte-ombre" cx="60" cy="106" rx="28" ry="6" fill="#16231C" />
        {content && (
          <>
            <path className="mascotte-etincelle" d={etoile(16, 22, 7)} fill="#E9B949" />
            <path className="mascotte-etincelle mascotte-etincelle-2" d={etoile(102, 88, 6)} fill="#E9B949" />
          </>
        )}
        <g className="mascotte-corps">
          <circle cx="60" cy="58" r="42" fill="#F7FAF8" stroke="#16231C" strokeWidth="3" />
          <path d="M60,37 L72.4,46 L67.6,60.5 L52.4,60.5 L47.6,46 Z" fill="#16231C" />
          <path d="M85,28 L91.7,32.8 L89.1,40.7 L80.9,40.7 L78.3,32.8 Z" fill="#16231C" opacity=".85" />
          <path d="M38,65 L44.7,69.8 L42.1,77.7 L33.9,77.7 L31.3,69.8 Z" fill="#16231C" opacity=".85" />
          <ellipse cx="40" cy="63" rx="5.5" ry="3.5" fill="#F2A9A0" opacity=".55" />
          <ellipse cx="80" cy="63" rx="5.5" ry="3.5" fill="#F2A9A0" opacity=".55" />
          {content ? (
            <>
              <path className="mascotte-oeil" d="M42,51 Q47,45 52,51" stroke="#16231C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path className="mascotte-oeil mascotte-oeil-d" d="M68,51 Q73,45 78,51" stroke="#16231C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path d="M45,67 Q60,82 75,67" stroke="#16231C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse className="mascotte-oeil" cx="47" cy="52" rx="4.5" ry="5.5" fill="#16231C" />
              <ellipse className="mascotte-oeil mascotte-oeil-d" cx="73" cy="52" rx="4.5" ry="5.5" fill="#16231C" />
              <path d="M48,68 Q60,74 72,68" stroke="#16231C" strokeWidth="3" fill="none" strokeLinecap="round" />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
