import type { ReactNode } from 'react';

export type Mood = 'happy' | 'wow' | 'think' | 'sad';

/** Le coach : un petit ballon avec des yeux, qui cligne et rebondit. */
export function CoachBall({ size = 64, mood = 'happy' }: { size?: number; mood?: Mood }) {
  const mouth =
    mood === 'happy' ? (
      <path d="M-13 12 Q0 24 13 12" fill="none" stroke="#1e2b22" strokeWidth="4" strokeLinecap="round" />
    ) : mood === 'wow' ? (
      <ellipse cx="0" cy="15" rx="6" ry="7" fill="#1e2b22" />
    ) : mood === 'sad' ? (
      <path d="M-12 19 Q0 9 12 19" fill="none" stroke="#1e2b22" strokeWidth="4" strokeLinecap="round" />
    ) : (
      <path d="M-10 15 L10 13" fill="none" stroke="#1e2b22" strokeWidth="4" strokeLinecap="round" />
    );
  return (
    <svg className="coach-ball" width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="coachShade" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef2ee" />
          <stop offset="1" stopColor="#b9c4bd" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="47" rx="30" ry="4" fill="rgba(0,0,0,.08)" />
      <circle r="44" fill="url(#coachShade)" stroke="#1e2b22" strokeWidth="3" />
      <path d="M-44 -6 L-30 -12 L-26 -30 L-38 -34" fill="#1e2b22" opacity=".9" />
      <path d="M44 -6 L30 -12 L26 -30 L38 -34" fill="#1e2b22" opacity=".9" />
      <path d="M-12 -44 L0 -36 L12 -44" fill="#1e2b22" opacity=".9" />
      <path d="M-30 30 L-18 40 L-26 44 L-36 34Z M30 30 L18 40 L26 44 L36 34Z" fill="#1e2b22" opacity=".85" />
      <g className="coach-eye">
        <ellipse cx="-14" cy="-6" rx="9" ry="11" fill="#fff" stroke="#1e2b22" strokeWidth="2.5" />
        <circle cx={mood === 'think' ? -11 : -13} cy={mood === 'think' ? -10 : -4} r="5" fill="#1e2b22" />
      </g>
      <g className="coach-eye">
        <ellipse cx="14" cy="-6" rx="9" ry="11" fill="#fff" stroke="#1e2b22" strokeWidth="2.5" />
        <circle cx={mood === 'think' ? 17 : 15} cy={mood === 'think' ? -10 : -4} r="5" fill="#1e2b22" />
      </g>
      <circle cx="-26" cy="10" r="5" fill="#fca5a5" opacity=".6" />
      <circle cx="26" cy="10" r="5" fill="#fca5a5" opacity=".6" />
      {mouth}
    </svg>
  );
}

/** Le conseil : une ligne sobre avec un trait de couleur (design minimaliste). */
export function Coach({ children, mood = 'happy' }: { children: ReactNode; mood?: Mood; size?: number }) {
  return (
    <div className={`hint ${mood}`} key={String(children)}>
      <div>{children}</div>
    </div>
  );
}
