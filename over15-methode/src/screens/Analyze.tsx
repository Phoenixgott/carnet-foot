import { useEffect, useMemo, useState } from 'react';
import { actions, getState, useStore } from '../lib/store';
import { newAnalysis, OTHER_LEAGUE, todayISO } from '../lib/defaults';
import {
  evaluate,
  evaluateStep,
  expectedGoals,
  findLeague,
  h2hStats,
  leagueLabel,
  missingHint,
  parseScore,
  stepComplete,
  STEPS,
  teamAverages,
  VERDICT_LABEL,
  VERDICT_TEXT,
  type Status,
} from '../lib/method';
import type { AnalysisInput, League, TeamInput } from '../lib/types';
import { haptic, openUrl, pushBack } from '../lib/native';
import { num, odds as fmtOdds, pct } from '../lib/format';
import { getProvider, prefillFromFixture, type Fixture } from '../lib/api';
import { ask, Banner, CountUp, FormEditor, NumberField, Sheet, StatusIcon, Stepper, TextField, toast } from '../components/ui';
import { IconChevronLeft, IconChevronRight, IconCloud, IconExternal, IconRefresh } from '../components/Icons';
import { ScoreRing } from '../components/Charts';
import { VERDICT_COLOR } from '../components/MatchCard';
import { BetSheet } from './BetSheet';
import { FixturesList } from './Fixtures';

const TM: Record<string, string> = {
  ligue1: 'https://www.transfermarkt.fr/ligue-1/verletztespieler/wettbewerb/FR1',
  bundesliga: 'https://www.transfermarkt.fr/bundesliga/verletztespieler/wettbewerb/L1',
  'premier-league': 'https://www.transfermarkt.fr/premier-league/verletztespieler/wettbewerb/GB1',
  'serie-a': 'https://www.transfermarkt.fr/serie-a/verletztespieler/wettbewerb/IT1',
  liga: 'https://www.transfermarkt.fr/laliga/verletztespieler/wettbewerb/ES1',
};
const FS: Record<string, string> = {
  ligue1: 'https://www.flashscore.fr/football/france/ligue-1/',
  bundesliga: 'https://www.flashscore.fr/football/allemagne/bundesliga/',
  'premier-league': 'https://www.flashscore.fr/football/angleterre/premier-league/',
  'serie-a': 'https://www.flashscore.fr/football/italie/serie-a/',
  liga: 'https://www.flashscore.fr/football/espagne/laliga/',
};

const STATUS_WORD: Record<Status, string> = { ok: 'Validé', warn: 'Fragile', fail: 'Non respecté', block: 'BLOQUANT', todo: 'À compléter' };

export function Analyze({ pendingFixture, clearPending, goHistory }: { pendingFixture: Fixture | null; clearPending: () => void; goHistory: () => void }) {
  const draft = useStore((s) => s.draft);
  const leagues = useStore((s) => s.leagues);
  const settings = useStore((s) => s.settings);
  const input = draft ?? null;
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [loading, setLoading] = useState<string | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [betOpen, setBetOpen] = useState(false);

  const update = (patch: Partial<AnalysisInput>) => {
    const cur = useStoreSnapshot();
    actions.setDraft({ ...(cur ?? newAnalysis()), ...patch });
  };

  // Préremplissage automatique depuis un match du jour.
  useEffect(() => {
    if (!pendingFixture) return;
    const f = pendingFixture;
    clearPending();
    void loadFixture(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFixture]);

  async function loadFixture(f: Fixture) {
    const p = getProvider(settings);
    if (!p) return;
    setPickOpen(false);
    setLoading(`${f.home.name} – ${f.away.name}`);
    setApiErrors([]);
    try {
      const r = await prefillFromFixture(p, f, leagues);
      const base = newAnalysis();
      actions.setDraft({ ...base, ...r.patch, notes: r.notes, step: 0 });
      setApiErrors(r.errors);
      setDir('fwd');
      if (r.errors.length) {
        haptic.warning();
        toast('Données partielles : complète à la main', 'warn');
      } else {
        haptic.success();
        toast('Étapes préremplies : vérifie et valide');
      }
    } catch (e) {
      haptic.error();
      setApiErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setLoading(null);
    }
  }

  const step = input?.step ?? 0;
  const goStep = (n: number) => {
    setDir(n < step ? 'back' : 'fwd');
    update({ step: n });
    document.querySelector('.screen')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Bouton retour Android : étape précédente.
  useEffect(() => {
    if (!input || step === 0) return;
    return pushBack(() => {
      goStep(step - 1);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, !!input]);

  const evaluation = useMemo(() => (input ? evaluate(input, leagues, settings) : null), [input, leagues, settings]);

  if (loading) {
    return (
      <div className="stack" style={{ paddingTop: 40, alignItems: 'center' }}>
        <IconRefresh size={34} className="spin" style={{ color: 'var(--neon)' }} />
        <div className="center">
          <div style={{ fontWeight: 700 }}>Récupération des données…</div>
          <div className="muted small">{loading}</div>
        </div>
        <div className="skeleton" style={{ width: '100%' }} />
        <div className="skeleton" style={{ width: '100%', height: 60 }} />
      </div>
    );
  }

  if (!input) {
    const provider = getProvider(settings);
    return (
      <div className="stack">
        <div className="card hero">
          <h3>Nouvelle analyse +1.5</h3>
          <p className="muted small" style={{ margin: '4px 0 14px' }}>
            6 étapes obligatoires, dans l'ordre de la méthode : championnat, équipes, domicile/extérieur, blessés, confrontations, cote. À la fin : un score sur 100 et un verdict.
          </p>
          <button className="btn primary block" onClick={() => { haptic.medium(); actions.setDraft(newAnalysis()); }}>
            Saisie manuelle <IconChevronRight />
          </button>
          {provider && (
            <button className="btn block" style={{ marginTop: 10 }} onClick={() => setPickOpen(true)}>
              <IconCloud /> Choisir un match du jour
            </button>
          )}
        </div>
        {!provider && (
          <Banner tone="blue">
            Mode automatique : colle une clé d'API football gratuite dans <b>Réglages</b> pour préremplir les étapes. Sans clé, tout fonctionne hors ligne.
          </Banner>
        )}
        {apiErrors.length > 0 && <Banner tone="red">{apiErrors.join(' ')}</Banner>}
        <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Matchs du jour">
          <FixturesList onPick={loadFixture} compact />
        </Sheet>
      </div>
    );
  }

  const key = STEPS[Math.min(step, 5)].key;
  const complete = step < 6 && stepComplete(key, input);
  const cur = step < 6 ? evaluateStep(key, input, leagues, settings) : null;

  const validate = () => {
    if (!complete) {
      haptic.warning();
      toast(missingHint(key), 'warn');
      return;
    }
    if (cur?.status === 'ok') haptic.success();
    else if (cur?.status === 'warn') haptic.warning();
    else haptic.error();
    if (step === 5) {
      const allDone = STEPS.every((s) => stepComplete(s.key, input));
      if (!allDone) {
        const first = STEPS.findIndex((s) => !stepComplete(s.key, input));
        toast(`Étape ${first + 1} incomplète`, 'warn');
        goStep(first);
        return;
      }
    }
    goStep(step + 1);
  };

  return (
    <div className="stack">
      <div className="stepper-dots">
        {STEPS.map((s, i) => {
          const st = i < step || step === 6 ? evaluateStep(s.key, input, leagues, settings).status : 'todo';
          return (
            <button key={s.key} className={`sdot ${i === step ? 'current' : st}`} onClick={() => (i <= step || STEPS.slice(0, i).every((x) => stepComplete(x.key, input))) && goStep(i)}>
              <span className="bar" />
              <span className="ellipsis" style={{ maxWidth: '100%' }}>{s.short}</span>
            </button>
          );
        })}
      </div>

      {(input.home.name || input.away.name) && step < 6 && (
        <div className="row small muted" style={{ marginTop: -4 }}>
          <span className="ellipsis grow">
            {input.home.name || '?'} – {input.away.name || '?'} · {leagueLabel(input, leagues)}
          </span>
          <button className="chip" onClick={async () => { if (await ask({ title: 'Abandonner l\'analyse ?', message: 'Les données saisies pour ce match seront effacées.', confirm: 'Abandonner', tone: 'danger' })) { actions.setDraft(null); setApiErrors([]); } }}>
            Annuler
          </button>
        </div>
      )}

      {apiErrors.length > 0 && step < 6 && (
        <Banner tone="orange">
          <b>Données incomplètes :</b>
          <ul className="list-plain small">
            {apiErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Banner>
      )}

      {step < 6 ? (
        <div key={step} className={`step-body stack ${dir === 'back' ? 'back' : ''}`}>
          <div className="step-head">
            <div className="step-num">{step + 1}</div>
            <div className="grow">
              <div className="muted tiny" style={{ letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Étape {step + 1} sur 6</div>
              <h2>{STEPS[step].title}</h2>
            </div>
          </div>
          {step === 0 && <StepLeague input={input} leagues={leagues} update={update} threshold={settings.leagueThreshold} onPick={() => setPickOpen(true)} hasApi={!!getProvider(settings)} />}
          {step === 1 && <StepTeams input={input} update={update} minS={settings.teamMinScored} minC={settings.teamMinConceded} />}
          {step === 2 && <StepHomeAway input={input} update={update} min={settings.homeAwayMin} />}
          {step === 3 && <StepInjuries input={input} update={update} />}
          {step === 4 && <StepH2H input={input} update={update} />}
          {step === 5 && <StepOdds input={input} update={update} min={settings.oddsMin} max={settings.oddsMax} />}

          {cur && cur.status !== 'todo' && (
            <div key={cur.status + cur.detail} className={`mini-verdict ${cur.status}`}>
              <StatusIcon status={cur.status} />
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{STATUS_WORD[cur.status]}</div>
                <div className="small muted">{cur.detail}</div>
                {cur.alerts.map((a) => (
                  <div key={a} className="small" style={{ color: cur.status === 'ok' ? 'var(--muted)' : cur.status === 'warn' ? 'var(--orange)' : 'var(--red)', marginTop: 3 }}>
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="wizard-actions">
            <button className="btn" style={{ width: 54, padding: 0 }} disabled={step === 0} onClick={() => goStep(step - 1)} aria-label="Étape précédente">
              <IconChevronLeft />
            </button>
            <button className={`btn ${complete ? 'primary' : ''}`} onClick={validate}>
              {step === 5 ? 'Voir le verdict' : 'Valider l\'étape'} <IconChevronRight />
            </button>
          </div>
        </div>
      ) : (
        evaluation && (
          <Result
            input={input}
            leagues={leagues}
            evaluation={evaluation}
            onEdit={() => goStep(0)}
            onNew={() => { actions.setDraft(null); setApiErrors([]); }}
            onSave={() => setBetOpen(true)}
          />
        )
      )}

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Matchs du jour">
        <FixturesList onPick={loadFixture} compact />
      </Sheet>
      {evaluation && betOpen && (
        <BetSheet
          open={betOpen}
          onClose={() => setBetOpen(false)}
          preset={{
            date: input.date || todayISO(),
            home: input.home.name,
            away: input.away.name,
            league: leagueLabel(input, leagues),
            odds: input.odds,
            verdict: evaluation.verdict,
            score: evaluation.score,
          }}
          onSaved={() => {
            setBetOpen(false);
            actions.setDraft(null);
            goHistory();
          }}
        />
      )}
    </div>
  );
}

// Lecture directe de l'état (évite les fermetures périmées dans les gestionnaires).
function useStoreSnapshot() {
  return getState().draft;
}

type StepProps = { input: AnalysisInput; update: (p: Partial<AnalysisInput>) => void };

function leagueStatus(l: League, t: number) {
  if (!l.inMethod) return <span className="chip">Hors méthode</span>;
  if (l.pct >= t) return <span className="chip green">✓ Seuil</span>;
  return <span className="chip orange">Sous {t} %</span>;
}

function StepLeague({ input, update, leagues, threshold, onPick, hasApi }: StepProps & { leagues: League[]; threshold: number; onPick: () => void; hasApi: boolean }) {
  const sel = input.leagueId;
  const choose = (l: League | null) => {
    haptic.tap();
    if (l) update({ leagueId: l.id, leaguePct: l.pct, otherLeagueName: '' });
    else update({ leagueId: OTHER_LEAGUE, leaguePct: input.leagueId === OTHER_LEAGUE ? input.leaguePct : null });
  };
  const sorted = [...leagues].sort((a, b) => Number(b.inMethod) - Number(a.inMethod) || b.pct - a.pct);
  const league = findLeague(input, leagues);
  return (
    <>
      <p className="muted small" style={{ margin: 0 }}>
        % de matchs avec au moins 2 buts sur 90 minutes. Ton seuil : <b style={{ color: 'var(--text)' }}>{threshold} %</b> (réglable dans l'onglet Ligues).
      </p>
      {hasApi && !input.fixture && (
        <button className="btn block small" onClick={onPick}>
          <IconCloud /> Préremplir depuis un match du jour
        </button>
      )}
      <div className="choice-grid">
        {sorted.map((l) => (
          <button key={l.id} className={`choice ${sel === l.id ? 'on' : ''}`} onClick={() => choose(l)}>
            <div className="row between">
              <span className="flag">{l.flag}</span>
              {leagueStatus(l, threshold)}
            </div>
            <div className="n ellipsis">{l.name}</div>
            <div className="p" style={{ color: !l.inMethod ? 'var(--faint)' : l.pct >= threshold ? 'var(--green)' : 'var(--orange)' }}>{l.pct} %</div>
          </button>
        ))}
        <button className={`choice ${sel === OTHER_LEAGUE ? 'on' : ''}`} onClick={() => choose(null)}>
          <div className="row between">
            <span className="flag">🌍</span>
            <span className="chip">Hors méthode</span>
          </div>
          <div className="n">Autre championnat</div>
          <div className="small muted" style={{ marginTop: 4 }}>Ligue exotique</div>
        </button>
      </div>
      {sel === OTHER_LEAGUE && (
        <div className="card tight stack">
          <Banner tone="orange">Les ligues exotiques sont <b>hors méthode</b> : Steven se limite aux grands championnats, mieux suivis et plus prévisibles.</Banner>
          <TextField label="Nom du championnat" value={input.otherLeagueName} onChange={(v) => update({ otherLeagueName: v })} placeholder="Ex. Eredivisie" />
          <NumberField label="% de matchs +1.5 (90 min)" value={input.leaguePct} onChange={(v) => update({ leaguePct: v })} suffix="%" min={0} max={100} />
        </div>
      )}
      {league && (
        <div className="card tight stack">
          <NumberField label={`% +1.5 retenu pour ${league.name} (cette analyse)`} value={input.leaguePct} onChange={(v) => update({ leaguePct: v })} suffix="%" min={0} max={100} />
          <div className="tiny faint">Valeur de référence : {league.pct} %. Pour la changer durablement, va dans Ligues.</div>
        </div>
      )}
      {input.notes.length > 0 && (
        <Banner tone="blue" icon={<IconCloud />}>
          <ul className="list-plain small">
            {input.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </Banner>
      )}
    </>
  );
}

function TeamBlock({ label, team, onChange, minS, minC }: { label: string; team: TeamInput; onChange: (t: TeamInput) => void; minS: number; minC: number }) {
  const avg = teamAverages(team);
  const okS = avg ? avg.scored >= minS : null;
  const okC = avg ? avg.conceded >= minC : null;
  return (
    <div className="card tight stack" style={{ gap: 10 }}>
      <div className="row between">
        <span className="chip blue">{label}</span>
        {avg && (
          <span className="row" style={{ gap: 6 }}>
            <span className={`chip ${okS ? 'green' : 'red'}`}>{okS ? '✓' : '✗'} marque</span>
            <span className={`chip ${okC ? 'green' : 'red'}`}>{okC ? '✓' : '✗'} encaisse</span>
          </span>
        )}
      </div>
      <TextField value={team.name} onChange={(v) => onChange({ ...team, name: v })} placeholder="Nom de l'équipe" />
      <div className="grid3">
        <NumberField label="Matchs" value={team.played} onChange={(v) => onChange({ ...team, played: v })} min={1} />
        <NumberField label="Buts marqués" value={team.scored} onChange={(v) => onChange({ ...team, scored: v })} min={0} />
        <NumberField label="Buts encaissés" value={team.conceded} onChange={(v) => onChange({ ...team, conceded: v })} min={0} />
      </div>
      {avg && (
        <div className="small muted">
          Par match : <b style={{ color: okS ? 'var(--green)' : 'var(--red)' }}>{num(avg.scored, 2)}</b> marqués · <b style={{ color: okC ? 'var(--green)' : 'var(--red)' }}>{num(avg.conceded, 2)}</b> encaissés
        </div>
      )}
      <div className="row between">
        <span className="label">Forme récente (optionnel)</span>
        <FormEditor form={team.form} onChange={(form) => onChange({ ...team, form })} />
      </div>
    </div>
  );
}

function StepTeams({ input, update, minS, minC }: StepProps & { minS: number; minC: number }) {
  const lambda = expectedGoals(input);
  return (
    <>
      <p className="muted small" style={{ margin: 0 }}>
        Il faut <b style={{ color: 'var(--text)' }}>deux équipes qui marquent ET encaissent</b> : au moins {num(minS, 1)} but marqué et {num(minC, 1)} encaissé par match (réglable).
      </p>
      <TeamBlock label="Domicile" team={input.home} onChange={(home) => update({ home })} minS={minS} minC={minC} />
      <TeamBlock label="Extérieur" team={input.away} onChange={(away) => update({ away })} minS={minS} minC={minC} />
      {lambda !== null && (
        <div className="card tight row between">
          <span className="muted small">Buts attendus sur le match</span>
          <span className="big-number" style={{ fontSize: 30, color: lambda >= 2.6 ? 'var(--green)' : lambda >= 2.2 ? 'var(--orange)' : 'var(--red)' }}>{num(lambda, 2)}</span>
        </div>
      )}
    </>
  );
}

function StepHomeAway({ input, update, min }: StepProps & { min: number }) {
  return (
    <>
      <p className="muted small" style={{ margin: 0 }}>
        Sur la saison : % de matchs à +1.5 de l'équipe qui reçoit <b style={{ color: 'var(--text)' }}>à domicile</b>, et de l'adversaire <b style={{ color: 'var(--text)' }}>à l'extérieur</b>. Objectif : {min} % ou plus.
      </p>
      <div className="card tight stack">
        <NumberField label={`${input.home.name || 'Équipe à domicile'} — à domicile`} value={input.homePct} onChange={(v) => update({ homePct: v })} suffix="%" min={0} max={100} />
        <PctBar v={input.homePct} min={min} />
        <NumberField label={`${input.away.name || 'Équipe à l\'extérieur'} — à l'extérieur`} value={input.awayPct} onChange={(v) => update({ awayPct: v })} suffix="%" min={0} max={100} />
        <PctBar v={input.awayPct} min={min} />
      </div>
      <div className="tiny faint">Astuce : 8 matchs à +1.5 sur 9 joués à domicile = 89 %.</div>
    </>
  );
}

function PctBar({ v, min }: { v: number | null; min: number }) {
  if (v === null) return null;
  return (
    <div style={{ position: 'relative', marginTop: -4 }}>
      <div className={`progress ${v < min ? 'red' : ''}`}>
        <div style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
      </div>
      <div style={{ position: 'absolute', left: `${min}%`, top: -3, bottom: -3, width: 2, background: 'var(--text)', opacity: 0.5 }} />
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="yesno">
      <button className={`yes ${value === true ? 'on' : ''}`} onClick={() => { haptic.tap(); onChange(true); }}>
        ✓ Disponible(s)
      </button>
      <button className={`no ${value === false ? 'on' : ''}`} onClick={() => { haptic.error(); onChange(false); }}>
        ✗ Absent
      </button>
    </div>
  );
}

function StepInjuries({ input, update }: StepProps) {
  const leagues = useStore((s) => s.leagues);
  const league = findLeague(input, leagues);
  const tm = league ? TM[league.id] : undefined;
  const fs = league ? FS[league.id] : undefined;
  const side = (s: 'home' | 'away') => input.injuries.filter((i) => i.side === s);
  const block = (s: 'home' | 'away') => {
    const team = s === 'home' ? input.home : input.away;
    const scorer = s === 'home' ? input.homeScorer : input.awayScorer;
    const ok = s === 'home' ? input.homeScorerOk : input.awayScorerOk;
    const list = side(s);
    return (
      <div className="card tight stack" style={{ gap: 10 }}>
        <div className="row between">
          <b className="ellipsis">{team.name || (s === 'home' ? 'Domicile' : 'Extérieur')}</b>
          <span className="chip blue">{s === 'home' ? 'Domicile' : 'Extérieur'}</span>
        </div>
        <TextField label="Meilleur(s) buteur(s)" value={scorer} onChange={(v) => update(s === 'home' ? { homeScorer: v } : { awayScorer: v })} placeholder="Nom du buteur (optionnel)" />
        <div className="label">Meilleur(s) buteur(s) disponible(s) ?</div>
        <YesNo value={ok} onChange={(v) => update(s === 'home' ? { homeScorerOk: v } : { awayScorerOk: v })} />
        {list.length > 0 && (
          <div className="small">
            <div className="label" style={{ marginBottom: 4 }}>Absents signalés par l'API</div>
            <ul className="list-plain">
              {list.slice(0, 8).map((i) => (
                <li key={i.player + i.reason}>
                  <b>{i.player}</b> <span className="muted">{i.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="link-btns">
          <button className="btn small" onClick={() => openUrl(tm ?? `https://www.transfermarkt.fr/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(team.name || '')}`)}>
            Transfermarkt <IconExternal />
          </button>
          <button className="btn small" onClick={() => openUrl(fs ?? 'https://www.flashscore.fr/')}>
            Flashscore <IconExternal />
          </button>
        </div>
      </div>
    );
  };
  return (
    <>
      <Banner tone="orange">Si un buteur clé est absent, le critère est <b>bloquant</b> : le verdict sera forcément rouge.</Banner>
      {block('home')}
      {block('away')}
      <div className="card tight stack" style={{ gap: 8 }}>
        <div className="label">Autres absences importantes (défense, gardien, meneur…)</div>
        <Stepper value={input.otherAbsences} onChange={(v) => update({ otherAbsences: v })} min={0} max={6} />
      </div>
    </>
  );
}

function StepH2H({ input, update }: StepProps) {
  const st = h2hStats(input);
  const rows = input.h2h.map((s) => {
    const p = parseScore(s);
    return { h: p ? String(p[0]) : s.split('-')[0] ?? '', a: p ? String(p[1]) : s.split('-')[1] ?? '' };
  });
  const setRow = (i: number, h: string, a: string) => {
    const next = [...input.h2h];
    next[i] = h === '' && a === '' ? '' : `${h}-${a}`;
    update({ h2h: next, h2hNone: false });
  };
  return (
    <>
      <p className="muted small" style={{ margin: 0 }}>Les 5 dernières confrontations directes (score domicile – extérieur), de la plus récente à la plus ancienne.</p>
      <div className="card tight stack" style={{ gap: 8, opacity: input.h2hNone ? 0.4 : 1 }}>
        {rows.map((r, i) => {
          const p = parseScore(input.h2h[i]);
          const over = p ? p[0] + p[1] >= 2 : null;
          return (
            <div key={i} className="row">
              <span className="faint small" style={{ width: 18 }}>{i + 1}</span>
              <input className="input" style={{ width: 60, textAlign: 'center', fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700 }} inputMode="numeric" maxLength={2} value={r.h} onChange={(e) => setRow(i, e.target.value.replace(/\D/g, ''), r.a)} aria-label={`Match ${i + 1} buts domicile`} />
              <span className="muted">–</span>
              <input className="input" style={{ width: 60, textAlign: 'center', fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700 }} inputMode="numeric" maxLength={2} value={r.a} onChange={(e) => setRow(i, r.h, e.target.value.replace(/\D/g, ''))} aria-label={`Match ${i + 1} buts extérieur`} />
              <span className="grow" />
              {over !== null && <span className={`chip ${over ? 'green' : 'red'}`}>{over ? '+1.5 ✓' : '−1.5'}</span>}
            </div>
          );
        })}
      </div>
      <label className="row small" style={{ gap: 10 }}>
        <input type="checkbox" checked={input.h2hNone} onChange={(e) => update({ h2hNone: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--neon)' }} />
        Pas de confrontation récente
      </label>
      {st.n > 0 && (
        <div className="kpis two">
          <div className="kpi">
            <div className="v">{st.over}/{st.n}</div>
            <div className="l">Matchs +1.5</div>
          </div>
          <div className="kpi">
            <div className="v">{num(st.avg ?? 0, 1)}</div>
            <div className="l">Buts / match</div>
          </div>
        </div>
      )}
    </>
  );
}

function StepOdds({ input, update, min, max }: StepProps & { min: number; max: number }) {
  const o = input.odds;
  const presets = [1.25, 1.3, 1.33, 1.35, 1.4, 1.45];
  const lo = 1.15;
  const hi = 1.65;
  const pos = (x: number) => `${Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))}%`;
  return (
    <>
      <p className="muted small" style={{ margin: 0 }}>Cote du pari « Plus de 1,5 but ». Fourchette habituelle : <b style={{ color: 'var(--text)' }}>{fmtOdds(min)} – {fmtOdds(max)}</b>.</p>
      <div className="card tight stack">
        <NumberField label="Cote +1.5" value={o} onChange={(v) => update({ odds: v })} placeholder="1,35" min={1.01} max={20} />
        <div className="row wrap" style={{ gap: 6 }}>
          {presets.map((p) => (
            <button key={p} className={`chip ${o === p ? 'green' : ''}`} style={{ fontSize: 13, padding: '7px 11px' }} onClick={() => { haptic.tap(); update({ odds: p }); }}>
              {fmtOdds(p)}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', height: 34, marginTop: 6 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 8, borderRadius: 99, background: 'var(--surface-3)' }} />
          <div style={{ position: 'absolute', left: pos(min), width: `calc(${pos(max)} - ${pos(min)})`, top: 13, height: 8, borderRadius: 99, background: 'linear-gradient(90deg,var(--pitch),var(--neon))' }} />
          {o !== null && o > 1 && (
            <div style={{ position: 'absolute', left: pos(o), top: 6, width: 22, height: 22, marginLeft: -11, borderRadius: '50%', background: o >= min && o <= max ? 'var(--neon)' : 'var(--orange)', boxShadow: '0 0 12px currentColor', border: '3px solid #050b08', transition: 'left .3s' }} />
          )}
          <span className="tiny faint" style={{ position: 'absolute', left: 0, bottom: -6 }}>{fmtOdds(lo)}</span>
          <span className="tiny faint" style={{ position: 'absolute', right: 0, bottom: -6 }}>{fmtOdds(hi)}</span>
        </div>
      </div>
      {o !== null && o > 1 && (
        <div className="kpis two">
          <div className="kpi">
            <div className="v">{num(10 * (o - 1), 2)} €</div>
            <div className="l">Gain net pour 10 €</div>
          </div>
          <div className="kpi">
            <div className="v">{pct(1 / o)}</div>
            <div className="l">Réussite mini rentable</div>
          </div>
        </div>
      )}
    </>
  );
}

function Result({ input, leagues, evaluation, onEdit, onNew, onSave }: { input: AnalysisInput; leagues: League[]; evaluation: ReturnType<typeof evaluate>; onEdit: () => void; onNew: () => void; onSave: () => void }) {
  const v = evaluation.verdict;
  const color = VERDICT_COLOR[v];
  useEffect(() => {
    const t = setTimeout(() => {
      if (v === 'GREEN') haptic.success();
      else if (v === 'ORANGE') haptic.warning();
      else haptic.error();
    }, 550);
    return () => clearTimeout(t);
  }, [v]);
  return (
    <div className="stack step-body">
      <div className={`card verdict-card glow-${v === 'GREEN' ? 'green' : v === 'ORANGE' ? 'orange' : 'red'}`}>
        <div className="small muted" style={{ marginBottom: 10 }}>
          {input.home.name} – {input.away.name} · {leagueLabel(input, leagues)}
        </div>
        <div className="ring-wrap">
          <ScoreRing score={evaluation.score} color={color} />
          <div className="ring-val">
            <div className="n" style={{ color }}>
              <CountUp value={evaluation.score} />
            </div>
            <div className="s">SUR 100</div>
          </div>
        </div>
        <div className="lights" aria-hidden="true">
          <span className={`light ${v === 'RED' ? 'on RED' : ''}`} />
          <span className={`light ${v === 'ORANGE' ? 'on ORANGE' : ''}`} />
          <span className={`light ${v === 'GREEN' ? 'on GREEN' : ''}`} />
        </div>
        <div className={`verdict-label ${v}`}>{VERDICT_LABEL[v]}</div>
        <p className="small muted" style={{ margin: '10px 8px 0' }}>{VERDICT_TEXT[v]}</p>
      </div>

      {evaluation.blockers.length > 0 && (
        <Banner tone="red">
          <b>Critère bloquant non respecté :</b>
          <ul className="list-plain small">
            {evaluation.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </Banner>
      )}

      <div className="card">
        <h3>Détail des 6 critères</h3>
        {evaluation.criteria.map((c, i) => (
          <div key={c.key} className="crit-row">
            <StatusIcon status={c.status} />
            <div className="grow">
              <div className="row between">
                <b>{i + 1}. {c.title}</b>
                <span className="small" style={{ fontWeight: 700 }}>
                  {Math.round(c.points)}<span className="faint">/{Math.round(c.max)}</span>
                </span>
              </div>
              <div className="tiny muted">{c.detail}</div>
              <div className="crit-bar">
                <div style={{ width: `${c.score * 100}%`, background: c.status === 'ok' ? 'var(--green)' : c.status === 'warn' ? 'var(--orange)' : 'var(--red)', animationDelay: `${0.1 * i}s` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="v">{pct(evaluation.estProb)}</div>
          <div className="l">Proba. estimée</div>
        </div>
        <div className="kpi">
          <div className="v">{fmtOdds(evaluation.fairOdds)}</div>
          <div className="l">Cote juste</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: evaluation.value === null ? undefined : evaluation.value >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {evaluation.value === null ? '—' : `${evaluation.value >= 0 ? '+' : '−'}${Math.abs(evaluation.value * 100).toFixed(0)} %`}
          </div>
          <div className="l">Value</div>
        </div>
      </div>
      <div className="tiny faint" style={{ marginTop: -6 }}>Estimation indicative à partir de tes données : aucune méthode ne gagne à tous les coups.</div>

      <button className="btn primary block" onClick={() => { haptic.medium(); onSave(); }}>
        Enregistrer le pari
      </button>
      <div className="grid2">
        <button className="btn" onClick={onEdit}>Modifier</button>
        <button className="btn" onClick={onNew}>Nouvelle analyse</button>
      </div>
    </div>
  );
}
