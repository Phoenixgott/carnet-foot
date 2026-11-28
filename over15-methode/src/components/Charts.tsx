import { useId } from 'react';
import { money } from '../lib/format';

/** Courbe de bankroll (SVG, animée au tracé). */
export function BankrollChart({ points, start, height = 150 }: { points: { x: number; y: number }[]; start: number; height?: number }) {
  const id = useId().replace(/:/g, '');
  const W = 320;
  const H = height;
  const pad = { l: 4, r: 4, t: 12, b: 18 };
  if (points.length < 2) {
    return (
      <div className="muted small center" style={{ padding: '26px 0' }}>
        La courbe apparaîtra dès ton premier pari terminé.
      </div>
    );
  }
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys, start);
  let max = Math.max(...ys, start);
  if (max - min < 1) {
    max += 1;
    min -= 1;
  }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;
  const n = points.length - 1;
  const X = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(n).toFixed(1)},${H - pad.b} L${X(0).toFixed(1)},${H - pad.b} Z`;
  const last = points[points.length - 1];
  const up = last.y >= start;
  const color = up ? 'var(--green-d)' : 'var(--red-d)';
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bankroll : ${money(last.y)}`}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={up ? '#2fe68b' : '#ff4f61'} stopOpacity="0.32" />
          <stop offset="1" stopColor={up ? '#2fe68b' : '#ff4f61'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad.l} x2={W - pad.r} y1={Y(start)} y2={Y(start)} stroke="rgba(0,0,0,.18)" strokeDasharray="4 5" />
      <text x={W - pad.r} y={Y(start) - 5} textAnchor="end" fontSize="10" fill="var(--faint)">
        départ {money(start)}
      </text>
      <path d={area} fill={`url(#g${id})`} style={{ animation: 'fadeIn .9s ease' }} />
      <path className="line" d={d} pathLength={1} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(n)} cy={Y(last.y)} r="4.5" fill={color} stroke="#ffffff" strokeWidth="2" style={{ animation: 'fadeIn 1.4s ease' }} />
      <text x={pad.l} y={H - 4} fontSize="10" fill="var(--faint)">
        1er pari
      </text>
      <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="10" fill="var(--faint)">
        {n} paris
      </text>
    </svg>
  );
}

/** Anneau de score sur 100. */
export function ScoreRing({ score, color, size = 190 }: { score: number; color: string; size?: number }) {
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="14" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        style={{ filter: `drop-shadow(0 0 8px ${color})`, animation: 'ringFill 1s cubic-bezier(.2,.8,.2,1) forwards', ['--ring-to' as string]: `${c * (1 - score / 100)}` }}
      />
      <style>{`@keyframes ringFill { to { stroke-dashoffset: var(--ring-to); } }`}</style>
    </svg>
  );
}
