// API-Football (api-sports.io) — offre gratuite : 100 requêtes / jour, tous les endpoints.
import { ApiError, type Fixture, type H2HMatch, type Injury, type Provider, type Scorer, type SeasonData, type SeasonMatch } from './types';
import { cached, countRequest, HOUR, MIN } from './cache';

const BASE = 'https://v3.football.api-sports.io';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

function errorText(errors: unknown): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) return errors.length ? errors.map(String).join(' ') : null;
  if (typeof errors === 'object') {
    const vals = Object.values(errors as Record<string, unknown>).map(String);
    return vals.length ? vals.join(' ') : null;
  }
  return String(errors);
}

function translate(msg: string): string {
  if (/plan/i.test(msg) && /season/i.test(msg)) return `Ton offre gratuite API-Football ne couvre pas cette saison (${msg}). Essaie football-data.org dans les réglages, ou continue en saisie manuelle.`;
  if (/token|key|application key/i.test(msg)) return `Clé API-Football refusée : vérifie-la dans les réglages (${msg}).`;
  if (/request|limit/i.test(msg)) return `Quota du jour atteint sur API-Football (${msg}). Les données en cache restent disponibles.`;
  return `API-Football : ${msg}`;
}

const fixtureOf = (x: Json): Fixture => ({
  id: String(x.fixture.id),
  kickoff: x.fixture.date,
  status: x.fixture.status?.short ?? '',
  leagueRef: String(x.league.id),
  leagueName: x.league.name,
  country: x.league.country ?? '',
  season: typeof x.league.season === 'number' ? x.league.season : null,
  home: { id: String(x.teams.home.id), name: x.teams.home.name, logo: x.teams.home.logo },
  away: { id: String(x.teams.away.id), name: x.teams.away.name, logo: x.teams.away.logo },
});

const goalsOf = (x: Json): [number, number] | null => {
  const ft = x.score?.fulltime;
  const h = ft?.home ?? x.goals?.home;
  const a = ft?.away ?? x.goals?.away;
  return typeof h === 'number' && typeof a === 'number' ? [h, a] : null;
};

export function createApiFootball(key: string): Provider {
  async function call(path: string, params: Record<string, string | number> = {}): Promise<Json> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}${qs ? '?' + qs : ''}`, { headers: { 'x-apisports-key': key } });
    } catch {
      throw new ApiError('Pas de connexion internet (ou API injoignable). La saisie manuelle reste disponible.');
    }
    const remaining = Number(res.headers.get('x-ratelimit-requests-remaining') ?? NaN);
    const limit = Number(res.headers.get('x-ratelimit-requests-limit') ?? NaN);
    if (path !== '/status') countRequest(remaining, limit);
    let json: Json;
    try {
      json = await res.json();
    } catch {
      throw new ApiError(`API-Football : réponse illisible (HTTP ${res.status}).`);
    }
    const err = errorText(json?.errors);
    if (err) throw new ApiError(translate(err));
    if (!res.ok) throw new ApiError(`API-Football : erreur HTTP ${res.status}.`);
    return json;
  }

  return {
    id: 'apifootball',
    label: 'API-Football',
    async check() {
      const j = await call('/status');
      const r = j.response ?? {};
      const plan = r.subscription?.plan ?? 'inconnue';
      const cur = r.requests?.current ?? '?';
      const lim = r.requests?.limit_day ?? '?';
      if (typeof r.requests?.limit_day === 'number') countRequest(r.requests.limit_day - r.requests.current, r.requests.limit_day);
      return `Clé valide · offre ${plan} · ${cur}/${lim} requêtes utilisées aujourd'hui.`;
    },
    fixturesOfDay(date) {
      return cached(`af:day:${date}`, 30 * MIN, async () => {
        const j = await call('/fixtures', { date, timezone: 'Europe/Paris' });
        return (j.response as Json[]).map(fixtureOf);
      });
    },
    season(leagueRef, season) {
      const year = season ?? currentSeasonYear();
      return cached(`af:season:${leagueRef}:${year}`, 12 * HOUR, async () => {
        const j = await call('/fixtures', { league: leagueRef, season: year, status: 'FT-AET-PEN' });
        const teams: Record<string, string> = {};
        const matches: SeasonMatch[] = [];
        for (const x of j.response as Json[]) {
          const g = goalsOf(x);
          if (!g) continue;
          teams[String(x.teams.home.id)] = x.teams.home.name;
          teams[String(x.teams.away.id)] = x.teams.away.name;
          matches.push({ h: String(x.teams.home.id), a: String(x.teams.away.id), hg: g[0], ag: g[1], d: x.fixture.date });
        }
        return { leagueRef, season: year, matches, teams } satisfies SeasonData;
      });
    },
    injuries(f) {
      return cached(`af:inj:${f.id}`, 3 * HOUR, async () => {
        const j = await call('/injuries', { fixture: f.id });
        return (j.response as Json[]).map(
          (x): Injury => ({ teamId: String(x.team?.id), player: x.player?.name ?? '?', playerId: x.player?.id ? String(x.player.id) : undefined, reason: [x.player?.type, x.player?.reason].filter(Boolean).join(' · ') }),
        );
      });
    },
    topScorers(leagueRef, season) {
      const year = season ?? currentSeasonYear();
      return cached(`af:scorers:${leagueRef}:${year}`, 24 * HOUR, async () => {
        const j = await call('/players/topscorers', { league: leagueRef, season: year });
        return (j.response as Json[]).map(
          (x): Scorer => ({ teamId: String(x.statistics?.[0]?.team?.id), player: x.player?.name ?? '?', playerId: x.player?.id ? String(x.player.id) : undefined, goals: x.statistics?.[0]?.goals?.total ?? 0 }),
        );
      });
    },
    h2h(f) {
      return cached(`af:h2h:${f.home.id}-${f.away.id}`, 24 * HOUR, async () => {
        const j = await call('/fixtures/headtohead', { h2h: `${f.home.id}-${f.away.id}`, last: 5 });
        return (j.response as Json[])
          .map((x): H2HMatch | null => {
            const g = goalsOf(x);
            return g ? { d: x.fixture.date, hg: g[0], ag: g[1] } : null;
          })
          .filter((x): x is H2HMatch => x !== null)
          .sort((a, b) => (a.d < b.d ? 1 : -1))
          .slice(0, 5);
      });
    },
    odds(f) {
      return cached(`af:odds:${f.id}`, 1 * HOUR, async () => {
        const j = await call('/odds', { fixture: f.id, bet: 5 });
        const values: number[] = [];
        for (const r of j.response as Json[]) {
          for (const bk of r.bookmakers ?? []) {
            for (const bet of bk.bets ?? []) {
              for (const v of bet.values ?? []) {
                if (String(v.value).toLowerCase() === 'over 1.5') {
                  const o = Number(v.odd);
                  if (Number.isFinite(o) && o > 1) values.push(o);
                }
              }
            }
          }
        }
        if (!values.length) return null;
        values.sort((a, b) => a - b);
        return Math.round(values[Math.floor(values.length / 2)] * 100) / 100;
      });
    },
  };
}

/** Année de début de la saison européenne en cours (août → mai). */
export function currentSeasonYear(d = new Date()): number {
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}
