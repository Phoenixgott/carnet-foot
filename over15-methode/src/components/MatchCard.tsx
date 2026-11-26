import type { Verdict } from '../lib/types';
import { odds as fmtOdds } from '../lib/format';
import { VERDICT_COLOR } from '../lib/method';
import { Crest } from './ui';

export interface MatchCardProps {
  competition: string;
  time?: string;
  home: string;
  away: string;
  verdict?: Verdict | null;
  okCount?: number;
  reason?: string;
  odds?: number | null;
  right?: React.ReactNode;
  onClick?: () => void;
}

const WORD: Record<Verdict, string> = { GREEN: 'On peut jouer', ORANGE: 'Prudence', RED: 'On ne joue pas' };

/** Carte de match façon « miniature de stats foot » : compétition, équipes, feu, critères. */
export function MatchCard(p: MatchCardProps) {
  return (
    <div
      className={`card match-card ${p.onClick ? 'press' : ''}`}
      style={{ ['--stripe' as string]: p.verdict ? VERDICT_COLOR[p.verdict] : 'var(--pitch)' }}
      onClick={p.onClick}
      role={p.onClick ? 'button' : undefined}
    >
      <div className="league">
        <span className="ellipsis grow">{p.competition}</span>
        {p.time && <span>{p.time}</span>}
      </div>
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="team-line">
            <Crest name={p.home} />
            <span className="name">{p.home}</span>
          </div>
          <div className="team-line">
            <Crest name={p.away} />
            <span className="name">{p.away}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingLeft: 6 }}>
          {p.right}
          {p.verdict && (
            <span className="row" style={{ gap: 6 }}>
              <span className={`dot ${p.verdict}`} />
              <b style={{ color: VERDICT_COLOR[p.verdict], fontSize: 13 }}>{WORD[p.verdict]}</b>
            </span>
          )}
          {p.okCount !== undefined && <span className="tiny muted">{p.okCount}/4 critères ✓</span>}
          {p.odds !== undefined && p.odds !== null && <span className="odds-tag">{fmtOdds(p.odds)}</span>}
        </div>
      </div>
      {p.reason && <div className="small muted" style={{ marginTop: 8 }}>{p.reason}</div>}
    </div>
  );
}
