import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { getProvider, leagueForRef, type Fixture } from '../lib/api';
import { todayISO } from '../lib/defaults';
import { MatchCard } from '../components/MatchCard';
import { Banner, Segmented } from '../components/ui';
import { IconRefresh } from '../components/Icons';
import { haptic } from '../lib/native';

const FINISHED = new Set(['FT', 'AET', 'PEN', 'FINISHED', 'AWARDED', 'CANC', 'PST', 'ABD', 'POSTPONED', 'CANCELLED', 'SUSPENDED']);

/** Matchs du jour (mode automatique), classés : ligues de la méthode d'abord. */
export function FixturesList({ onPick, compact, limit }: { onPick: (f: Fixture) => void; compact?: boolean; limit?: number }) {
  const settings = useStore((s) => s.settings);
  const leagues = useStore((s) => s.leagues);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [list, setList] = useState<Fixture[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const provider = getProvider(settings);

  const date = (() => {
    const d = new Date();
    if (day === 'tomorrow') d.setDate(d.getDate() + 1);
    return todayISO(d);
  })();

  const load = useCallback(async () => {
    const p = getProvider(settings);
    if (!p) return;
    setLoading(true);
    setErr(null);
    try {
      setList(await p.fixturesOfDay(date));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setList(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.provider, settings.apiKey, date]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!provider) return null;

  const upcoming = (list ?? []).filter((f) => !FINISHED.has(f.status));
  const inMethod = upcoming
    .map((f) => ({ f, l: leagueForRef(provider.id, f.leagueRef, leagues) }))
    .filter((x) => x.l)
    .sort((a, b) => Number(b.l!.inMethod) - Number(a.l!.inMethod) || b.l!.pct - a.l!.pct || a.f.kickoff.localeCompare(b.f.kickoff));
  const others = upcoming.filter((f) => !leagueForRef(provider.id, f.leagueRef, leagues)).sort((a, b) => a.leagueName.localeCompare(b.leagueName) || a.kickoff.localeCompare(b.kickoff));
  const shown = limit ? inMethod.slice(0, limit) : inMethod;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row">
        <div className="grow">
          <Segmented value={day} onChange={setDay} options={[{ value: 'today', label: "Aujourd'hui" }, { value: 'tomorrow', label: 'Demain' }]} />
        </div>
        <button className="icon-btn" onClick={() => { haptic.tap(); void load(); }} aria-label="Actualiser">
          <IconRefresh className={loading ? 'spin' : ''} />
        </button>
      </div>
      {err && <Banner tone="red">{err}</Banner>}
      {loading && !list && (
        <>
          <div className="skeleton" />
          <div className="skeleton" />
        </>
      )}
      {list && !inMethod.length && !err && <div className="muted small center" style={{ padding: 12 }}>Aucun match des championnats suivis {day === 'today' ? "aujourd'hui" : 'demain'}.</div>}
      {shown.map(({ f, l }) => (
        <MatchCard
          key={f.id}
          league={l!.name}
          flag={l!.flag}
          outOfMethod={!l!.inMethod}
          kickoff={f.kickoff}
          home={{ name: f.home.name, logo: f.home.logo }}
          away={{ name: f.away.name, logo: f.away.logo }}
          pct={l!.pct}
          pctLabel="ligue"
          onClick={() => { haptic.medium(); onPick(f); }}
        />
      ))}
      {limit && inMethod.length > limit && <div className="tiny faint center">+ {inMethod.length - limit} autres matchs dans Analyser</div>}
      {!compact || others.length === 0 ? null : (
        <>
          <button className="btn small block ghost" onClick={() => setShowOthers((v) => !v)}>
            {showOthers ? 'Masquer' : 'Afficher'} les autres compétitions ({others.length}) · hors méthode
          </button>
          {showOthers &&
            others.slice(0, 80).map((f) => (
              <MatchCard
                key={f.id}
                league={`${f.leagueName}${f.country ? ' · ' + f.country : ''}`}
                outOfMethod
                kickoff={f.kickoff}
                home={{ name: f.home.name, logo: f.home.logo }}
                away={{ name: f.away.name, logo: f.away.logo }}
                onClick={() => { haptic.medium(); onPick(f); }}
              />
            ))}
        </>
      )}
    </div>
  );
}
