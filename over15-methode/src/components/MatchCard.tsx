import type { Form, Verdict } from '../lib/types';
import { odds as fmtOdds, timeShort } from '../lib/format';
import { Crest, FormPills } from './ui';

export const VERDICT_COLOR: Record<Verdict, string> = {
  GREEN: 'var(--green)',
  ORANGE: 'var(--orange)',
  RED: 'var(--red)',
};

export interface MatchCardProps {
  league: string;
  flag?: string;
  outOfMethod?: boolean;
  kickoff?: string;
  home: { name: string; logo?: string; form?: Form[] };
  away: { name: string; logo?: string; form?: Form[] };
  odds?: number | null;
  pct?: number | null;
  pctLabel?: string;
  verdict?: Verdict | null;
  right?: React.ReactNode;
  onClick?: () => void;
}

/** Carte de match façon « miniature de stats foot » : ligue, équipes, forme V/N/D, cote, %. */
export function MatchCard(p: MatchCardProps) {
  return (
    <div
      className={`card match-card ${p.onClick ? 'press' : ''}`}
      style={{ ['--stripe' as string]: p.verdict ? VERDICT_COLOR[p.verdict] : p.outOfMethod ? 'var(--faint)' : 'var(--pitch)' }}
      onClick={p.onClick}
      role={p.onClick ? 'button' : undefined}
    >
      <div className="league">
        {p.flag && <span style={{ fontSize: 14 }}>{p.flag}</span>}
        <span className="ellipsis grow">{p.league}</span>
        {p.outOfMethod && <span className="chip">Hors méthode</span>}
        {p.kickoff && <span>{timeShort(p.kickoff)}</span>}
      </div>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="grow">
          <div className="team-line">
            <Crest name={p.home.name} logo={p.home.logo} />
            <span className="name">{p.home.name}</span>
            {p.home.form && p.home.form.length > 0 && <FormPills form={p.home.form} size={17} />}
          </div>
          <div className="team-line">
            <Crest name={p.away.name} logo={p.away.logo} />
            <span className="name">{p.away.name}</span>
            {p.away.form && p.away.form.length > 0 && <FormPills form={p.away.form} size={17} />}
          </div>
        </div>
        {(p.pct !== undefined || p.odds !== undefined || p.right) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, paddingLeft: 6 }}>
            {p.right}
            {p.pct !== undefined && p.pct !== null && (
              <div className="pct-badge">
                <div className="v" style={{ color: p.pct >= 80 ? 'var(--green)' : p.pct >= 70 ? 'var(--orange)' : 'var(--red)' }}>{Math.round(p.pct)}%</div>
                <div className="l">{p.pctLabel ?? '+1.5'}</div>
              </div>
            )}
            {p.odds !== undefined && p.odds !== null && <span className="odds-tag">{fmtOdds(p.odds)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
