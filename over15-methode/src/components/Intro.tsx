import { useEffect, useRef, useState } from 'react';
import './intro.css';


function pentagon(cx: number, cy: number, r: number, rot: number): string {
  return Array.from({ length: 5 }, (_, k) => {
    const a = ((rot + 72 * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

const OUTER = [-90, -18, 54, 126, 198].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { deg, cx: 41 * Math.cos(a), cy: 41 * Math.sin(a), ix: 16 * Math.cos(a), iy: 16 * Math.sin(a), ox: 28 * Math.cos(a), oy: 28 * Math.sin(a) };
});

export function Ball({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="ballShade" cx="35%" cy="30%" r="78%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#e4ebe6" />
          <stop offset="1" stopColor="#8f9d95" />
        </radialGradient>
        <clipPath id="ballClip">
          <circle r="48" />
        </clipPath>
      </defs>
      <circle r="48" fill="url(#ballShade)" />
      <g clipPath="url(#ballClip)" fill="#121614" stroke="#121614" strokeWidth="2.2" strokeLinejoin="round">
        <polygon points={pentagon(0, 0, 16, -90)} />
        {OUTER.map((o) => (
          <g key={o.deg}>
            <line x1={o.ix} y1={o.iy} x2={o.ox} y2={o.oy} />
            <polygon points={pentagon(o.cx, o.cy, 14, o.deg + 180)} />
          </g>
        ))}
        {OUTER.map((o, i) => {
          const n = OUTER[(i + 1) % 5];
          const mx = ((o.cx + n.cx) / 2) * 1.12;
          const my = ((o.cy + n.cy) / 2) * 1.12;
          return <line key={'s' + o.deg} x1={(o.cx + n.cx) / 2 * 0.62} y1={(o.cy + n.cy) / 2 * 0.62} x2={mx} y2={my} fill="none" />;
        })}
      </g>
      <circle r="48" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" />
    </svg>
  );
}

const TOTAL_FILM_MS = 4100;

/** Vidéo d'ouverture minimaliste (≈ 4 s, touchez pour passer) : un trait, un ballon, +EV, puis 3 plans. */
export function Intro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(onDone, 320);
  };

  useEffect(() => {
    const t = setTimeout(finish, TOTAL_FILM_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`film ${leaving ? 'leaving' : ''}`} onPointerDown={finish} role="presentation">
      <div className="film-bars">
        <span>
          <i />
        </span>
        <span>
          <i />
        </span>
        <span>
          <i />
        </span>
      </div>
      <div className="film-center">
        <div className="film-line" />
        <div className="film-ball">
          <Ball size={34} />
        </div>
        <div className="film-logo">+EV</div>
        <div className="film-captions">
          <span className="c1">
            <b>1</b> Claude cherche.
          </span>
          <span className="c2">
            <b>2</b> L'app calcule.
          </span>
          <span className="c3">
            <b>3</b> Tu décides.
          </span>
        </div>
      </div>
      <div className="film-skip">Touchez pour passer</div>
    </div>
  );
}

