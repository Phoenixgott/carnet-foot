import { useEffect, useRef, useState } from 'react';
import './intro.css';

const TOTAL_MS = 2750;

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

export function Intro({ onDone }: { onDone: () => void }) {
  const [goals, setGoals] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(onDone, 320);
  };

  useEffect(() => {
    const t = [
      setTimeout(() => setGoals(1), 1450),
      setTimeout(() => setGoals(2), 1850),
      setTimeout(finish, TOTAL_MS),
    ];
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`intro ${leaving ? 'leaving' : ''}`} onPointerDown={finish} role="presentation">
      <div className="intro-pitch">
        <div className="intro-circle" />
        <div className="intro-line" />
      </div>
      <div className="intro-ball-x">
        <div className="intro-ball-y">
          <div className="intro-trail" />
          <div className="intro-ball-r">
            <Ball size={68} />
          </div>
        </div>
      </div>
      <div className="intro-burst" />
      <div className="intro-logo">
        <div className="intro-plus">+1.5</div>
        <div className="intro-methode">MÉTHODE</div>
        <div className="intro-counter">
          <span className="intro-c-label">BUTS</span>
          <span key={goals} className={`intro-c-num ${goals >= 2 ? 'win' : ''}`}>
            {goals}
          </span>
          <span className={`intro-over ${goals >= 2 ? 'on' : ''}`}>OVER ✓</span>
        </div>
      </div>
      <div className="intro-skip">Touchez pour passer</div>
    </div>
  );
}
