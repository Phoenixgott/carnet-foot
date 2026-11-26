// Mode automatique : préremplissage des 6 étapes depuis une API football.
import { createApiFootball } from './apiFootball';
import { createFootballData } from './footballData';
import { OTHER_LEAGUE } from '../defaults';
import type { AnalysisInput, Form, League, Settings } from '../types';
import type { Fixture, Provider, SeasonData, SeasonMatch, TeamSeasonStats } from './types';

export * from './types';

export function getProvider(s: Settings): Provider | null {
  const key = s.apiKey.trim();
  if (!key || s.provider === 'none') return null;
  return s.provider === 'apifootball' ? createApiFootball(key) : createFootballData(key);
}

export function leagueForRef(provider: Provider['id'], ref: string, leagues: League[]): League | undefined {
  return leagues.find((l) => (provider === 'apifootball' ? String(l.apiFootballId ?? '') === ref : (l.footballDataCode ?? '') === ref));
}

export function leagueRefOf(provider: Provider['id'], l: League): string | null {
  if (provider === 'apifootball') return l.apiFootballId ? String(l.apiFootballId) : null;
  return l.footballDataCode ?? null;
}

const over = (m: SeasonMatch) => m.hg + m.ag >= 2;

export function leagueOverPct(data: SeasonData): { pct: number; n: number } | null {
  if (!data.matches.length) return null;
  const n = data.matches.length;
  return { pct: Math.round((data.matches.filter(over).length / n) * 100), n };
}

export function teamStats(data: SeasonData, teamId: string): TeamSeasonStats {
  const ms = data.matches.filter((m) => m.h === teamId || m.a === teamId).sort((a, b) => (a.d < b.d ? 1 : -1));
  const st: TeamSeasonStats = { played: 0, scored: 0, conceded: 0, homePlayed: 0, homeOver: 0, awayPlayed: 0, awayOver: 0, form: [] };
  for (const m of ms) {
    const home = m.h === teamId;
    const gf = home ? m.hg : m.ag;
    const ga = home ? m.ag : m.hg;
    st.played++;
    st.scored += gf;
    st.conceded += ga;
    if (home) {
      st.homePlayed++;
      if (over(m)) st.homeOver++;
    } else {
      st.awayPlayed++;
      if (over(m)) st.awayOver++;
    }
    if (st.form.length < 5) st.form.push((gf > ga ? 'V' : gf === ga ? 'N' : 'D') as Form);
  }
  return st;
}

export interface PrefillResult {
  patch: Partial<AnalysisInput>;
  notes: string[];
  errors: string[];
}

const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/** Récupère toutes les données d'un match et prépare les 6 étapes. */
export async function prefillFromFixture(p: Provider, f: Fixture, leagues: League[]): Promise<PrefillResult> {
  const notes: string[] = [];
  const errors: string[] = [];
  const league = leagueForRef(p.id, f.leagueRef, leagues);
  const [seasonR, scorersR, injR, h2hR, oddsR] = await Promise.allSettled([
    p.season(f.leagueRef, f.season),
    p.topScorers(f.leagueRef, f.season),
    p.injuries(f),
    p.h2h(f),
    p.odds(f),
  ]);
  const err = (label: string, r: PromiseSettledResult<unknown>) => {
    if (r.status === 'rejected') errors.push(`${label} : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  };
  err('Statistiques de la saison', seasonR);
  err('Buteurs', scorersR);
  err('Blessés', injR);
  err('Confrontations', h2hR);
  err('Cote', oddsR);

  const patch: Partial<AnalysisInput> = {
    date: f.kickoff.slice(0, 10),
    fixture: { provider: p.id, id: f.id, leagueRef: f.leagueRef, season: f.season },
    leagueId: league ? league.id : OTHER_LEAGUE,
    otherLeagueName: league ? '' : `${f.leagueName}${f.country ? ' (' + f.country + ')' : ''}`,
    leaguePct: league ? league.pct : null,
    home: { id: f.home.id, name: f.home.name, logo: f.home.logo, played: null, scored: null, conceded: null, form: [] },
    away: { id: f.away.id, name: f.away.name, logo: f.away.logo, played: null, scored: null, conceded: null, form: [] },
  };

  if (seasonR.status === 'fulfilled') {
    const data = seasonR.value;
    const lp = leagueOverPct(data);
    if (lp) {
      notes.push(`Championnat cette saison : ${lp.pct} % de matchs +1.5 (${lp.n} matchs).`);
      if (!league) patch.leaguePct = lp.pct;
    }
    const hs = teamStats(data, f.home.id);
    const as = teamStats(data, f.away.id);
    if (hs.played) patch.home = { ...patch.home!, played: hs.played, scored: hs.scored, conceded: hs.conceded, form: hs.form };
    if (as.played) patch.away = { ...patch.away!, played: as.played, scored: as.scored, conceded: as.conceded, form: as.form };
    const hp = ratio(hs.homeOver, hs.homePlayed);
    const ap = ratio(as.awayOver, as.awayPlayed);
    if (hp !== null) {
      patch.homePct = hp;
      notes.push(`${f.home.name} à domicile : ${hs.homeOver}/${hs.homePlayed} matchs +1.5.`);
    }
    if (ap !== null) {
      patch.awayPct = ap;
      notes.push(`${f.away.name} à l'extérieur : ${as.awayOver}/${as.awayPlayed} matchs +1.5.`);
    }
    if (!hs.played && !as.played) notes.push('Pas encore de match terminé cette saison pour ces équipes.');
  }

  const injuries = injR.status === 'fulfilled' ? injR.value : null;
  if (injuries) {
    patch.injuries = injuries
      .filter((i) => i.teamId === f.home.id || i.teamId === f.away.id)
      .map((i) => ({ side: i.teamId === f.home.id ? 'home' : 'away', player: i.player, reason: i.reason }));
  } else if (injR.status === 'fulfilled') {
    notes.push('Blessés non fournis par cette API : vérifie sur Transfermarkt ou Flashscore.');
  }

  if (scorersR.status === 'fulfilled' && scorersR.value) {
    const scorers = scorersR.value;
    const best = (teamId: string) => scorers.filter((s) => s.teamId === teamId).sort((a, b) => b.goals - a.goals)[0];
    const hb = best(f.home.id);
    const ab = best(f.away.id);
    const isOut = (name: string, id?: string, side?: 'home' | 'away') =>
      (injuries ?? []).some((i) => (id && i.playerId === id) || (i.player === name && (side === 'home' ? i.teamId === f.home.id : i.teamId === f.away.id)));
    if (hb) {
      patch.homeScorer = `${hb.player} (${hb.goals} buts)`;
      if (injuries) patch.homeScorerOk = !isOut(hb.player, hb.playerId, 'home');
    }
    if (ab) {
      patch.awayScorer = `${ab.player} (${ab.goals} buts)`;
      if (injuries) patch.awayScorerOk = !isOut(ab.player, ab.playerId, 'away');
    }
  }

  if (h2hR.status === 'fulfilled') {
    const list = h2hR.value;
    if (list.length) {
      const h2h = list.map((m) => `${m.hg}-${m.ag}`);
      while (h2h.length < 5) h2h.push('');
      patch.h2h = h2h;
      patch.h2hNone = false;
    } else {
      patch.h2h = ['', '', '', '', ''];
      patch.h2hNone = true;
      notes.push('Aucune confrontation directe récente trouvée.');
    }
  }

  if (oddsR.status === 'fulfilled' && oddsR.value) {
    patch.odds = oddsR.value;
    notes.push(`Cote +1.5 médiane des bookmakers : ${oddsR.value.toFixed(2).replace('.', ',')}.`);
  }

  return { patch, notes, errors };
}

/** Calcule le % +1.5 de la saison en cours pour une ligue. */
export async function refreshLeaguePct(p: Provider, l: League): Promise<{ pct: number; n: number } | null> {
  const ref = leagueRefOf(p.id, l);
  if (!ref) return null;
  const data = await p.season(ref, null);
  return leagueOverPct(data);
}
