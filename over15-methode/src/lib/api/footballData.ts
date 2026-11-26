// football-data.org — offre gratuite : 12 compétitions (dont les 5 grands championnats), 10 requêtes / minute.
import { ApiError, type Fixture, type H2HMatch, type Provider, type Scorer, type SeasonMatch } from './types';
import { cached, countRequest, HOUR, MIN } from './cache';

const BASE = 'https://api.football-data.org/v4';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

function localDate(iso: string): string {
  const d = new Date(iso);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function nextDay(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const fixtureOf = (m: Json): Fixture => ({
  id: String(m.id),
  kickoff: m.utcDate,
  status: m.status ?? '',
  leagueRef: m.competition?.code ?? String(m.competition?.id ?? ''),
  leagueName: m.competition?.name ?? '',
  country: m.area?.name ?? '',
  season: m.season?.startDate ? Number(String(m.season.startDate).slice(0, 4)) : null,
  home: { id: String(m.homeTeam?.id), name: m.homeTeam?.shortName || m.homeTeam?.name || '?', logo: m.homeTeam?.crest },
  away: { id: String(m.awayTeam?.id), name: m.awayTeam?.shortName || m.awayTeam?.name || '?', logo: m.awayTeam?.crest },
});

const goalsOf = (m: Json): [number, number] | null => {
  const s = m.score?.regularTime ?? m.score?.fullTime;
  return typeof s?.home === 'number' && typeof s?.away === 'number' ? [s.home, s.away] : null;
};

export function createFootballData(key: string): Provider {
  async function call(path: string, params: Record<string, string | number> = {}): Promise<Json> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}${qs ? '?' + qs : ''}`, { headers: { 'X-Auth-Token': key } });
    } catch {
      throw new ApiError('Pas de connexion internet (ou API injoignable). La saisie manuelle reste disponible.');
    }
    countRequest(Number(res.headers.get('x-requests-available-minute') ?? NaN));
    let json: Json = null;
    try {
      json = await res.json();
    } catch {
      /* corps vide */
    }
    if (!res.ok) {
      const msg = json?.message ?? `HTTP ${res.status}`;
      if (res.status === 400 && /token/i.test(msg)) throw new ApiError(`Clé football-data.org refusée : vérifie-la dans les réglages (${msg}).`);
      if (res.status === 403) throw new ApiError(`football-data.org : cette compétition n'est pas incluse dans l'offre gratuite (${msg}).`);
      if (res.status === 429) throw new ApiError('football-data.org : trop de requêtes, patiente une minute.');
      throw new ApiError(`football-data.org : ${msg}`);
    }
    return json;
  }

  return {
    id: 'footballdata',
    label: 'football-data.org',
    async check() {
      const j = await call('/competitions');
      const n = (j.competitions as Json[] | undefined)?.length ?? 0;
      return `Clé valide · ${n} compétitions accessibles.`;
    },
    fixturesOfDay(date) {
      return cached(`fd:day:${date}`, 30 * MIN, async () => {
        const j = await call('/matches', { dateFrom: date, dateTo: nextDay(date) });
        return (j.matches as Json[]).map(fixtureOf).filter((f) => localDate(f.kickoff) === date);
      });
    },
    season(leagueRef, season) {
      return cached(`fd:season:${leagueRef}:${season ?? 'cur'}`, 12 * HOUR, async () => {
        const params: Record<string, string | number> = { status: 'FINISHED' };
        if (season) params.season = season;
        const j = await call(`/competitions/${leagueRef}/matches`, params);
        const teams: Record<string, string> = {};
        const matches: SeasonMatch[] = [];
        for (const m of j.matches as Json[]) {
          const g = goalsOf(m);
          if (!g) continue;
          teams[String(m.homeTeam.id)] = m.homeTeam.shortName || m.homeTeam.name;
          teams[String(m.awayTeam.id)] = m.awayTeam.shortName || m.awayTeam.name;
          matches.push({ h: String(m.homeTeam.id), a: String(m.awayTeam.id), hg: g[0], ag: g[1], d: m.utcDate });
        }
        return { leagueRef, season, matches, teams };
      });
    },
    async injuries() {
      return null;
    },
    topScorers(leagueRef) {
      return cached(`fd:scorers:${leagueRef}`, 24 * HOUR, async () => {
        const j = await call(`/competitions/${leagueRef}/scorers`, { limit: 40 });
        return (j.scorers as Json[]).map((s): Scorer => ({ teamId: String(s.team?.id), player: s.player?.name ?? '?', playerId: s.player?.id ? String(s.player.id) : undefined, goals: s.goals ?? 0 }));
      });
    },
    h2h(f) {
      return cached(`fd:h2h:${f.id}`, 24 * HOUR, async () => {
        const j = await call(`/matches/${f.id}/head2head`, { limit: 10 });
        return (j.matches as Json[])
          .filter((m) => m.status === 'FINISHED')
          .map((m): H2HMatch | null => {
            const g = goalsOf(m);
            return g ? { d: m.utcDate, hg: g[0], ag: g[1] } : null;
          })
          .filter((x): x is H2HMatch => x !== null)
          .sort((a, b) => (a.d < b.d ? 1 : -1))
          .slice(0, 5);
      });
    },
    async odds() {
      return null;
    },
  };
}
