import { useState } from 'react';
import { actions, useStore } from '../lib/store';
import { dashboard, fixedStake, profit, testCount, weekStatus } from '../lib/stats';
import { money, odds as fmtOdds, pct, signedMoney, signedPct, dateShort } from '../lib/format';
import { getProvider, type Fixture } from '../lib/api';
import { BankrollChart } from '../components/Charts';
import { MatchCard } from '../components/MatchCard';
import { Banner, CountUp, Segmented } from '../components/ui';
import { IconChevronRight, IconCloud, IconFlask, IconShield, IconWallet } from '../components/Icons';
import { FixturesList } from './Fixtures';
import { haptic } from '../lib/native';

export function Home({ goAnalyze, goSettings, goHistory, analyzeFixture }: { goAnalyze: () => void; goSettings: () => void; goHistory: () => void; analyzeFixture: (f: Fixture) => void }) {
  const bets = useStore((s) => s.bets);
  const s = useStore((st) => st.settings);
  const tc = testCount(bets);
  const realCount = bets.length - tc;
  const [view, setView] = useState<'real' | 'test'>(realCount > 0 || !s.testMode ? 'real' : 'test');
  const isTest = view === 'test';
  const d = dashboard(bets, s, isTest);
  const week = weekStatus(bets, s);
  const stake = fixedStake(bets, s, isTest);
  const delta = d.bankroll - s.bankrollInitial;
  const trainingDone = s.testMode && tc >= s.testBetsTarget;
  const testDash = trainingDone ? dashboard(bets, s, true) : null;
  const provider = getProvider(s);
  const recent = bets.slice(0, 3);

  let methodVerdict: { tone: 'green' | 'red' | 'blue'; text: React.ReactNode };
  if (d.hitRate === null || d.breakEven === null || d.won + d.lost < 10) {
    methodVerdict = { tone: 'blue', text: <>Encore {Math.max(0, 10 - (d.won + d.lost))} pari(s) terminé(s) avant un premier bilan fiable.</> };
  } else if (d.hitRate > d.breakEven) {
    methodVerdict = { tone: 'green', text: <>La méthode est <b>rentable</b> : {pct(d.hitRate)} de réussite pour {pct(d.breakEven)} nécessaires (+{((d.hitRate - d.breakEven) * 100).toFixed(1).replace('.', ',')} pts).</> };
  } else {
    methodVerdict = { tone: 'red', text: <>Pas encore rentable : {pct(d.hitRate)} de réussite, il faut au moins {pct(d.breakEven)} à la cote moyenne de {fmtOdds(d.avgOdds)}.</> };
  }

  return (
    <div className="stack">
      {week.reached && (
        <Banner tone="red">
          <b>Limite de pertes de la semaine atteinte</b> ({money(week.loss)} / {money(week.limit)}). Pause jusqu'à lundi : seuls les paris fictifs restent possibles.
        </Banner>
      )}
      {trainingDone && testDash && (
        <Banner tone="green" icon={<IconFlask />}>
          <b>Entraînement terminé : {s.testBetsTarget} paris fictifs.</b> Réussite {pct(testDash.hitRate)} · bénéfice fictif {signedMoney(testDash.profit)}.
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <button className="btn small primary" onClick={() => { haptic.success(); actions.updateSettings({ testMode: false }); setView('real'); }}>
              Passer en réel
            </button>
            <button className="btn small" onClick={() => actions.updateSettings({ testBetsTarget: s.testBetsTarget + 10 })}>
              +10 paris test
            </button>
          </div>
        </Banner>
      )}

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'real', label: `Réel${realCount ? ` · ${realCount}` : ''}` },
          { value: 'test', label: `Test · ${tc}/${s.testBetsTarget}` },
        ]}
      />

      <div className="card hero">
        <div className="row between">
          <span className="label row" style={{ gap: 6 }}>
            <IconWallet size={15} /> {isTest ? 'BANKROLL FICTIVE' : 'BANKROLL'}
          </span>
          <span className={`chip ${delta >= 0 ? 'green' : 'red'}`}>{signedPct(s.bankrollInitial ? delta / s.bankrollInitial : null)}</span>
        </div>
        <div className="big-number" style={{ marginTop: 6 }}>
          <CountUp value={d.bankroll} format={(v) => money(v)} />
        </div>
        <div className={`small ${delta >= 0 ? 'pos' : 'neg'}`} style={{ marginBottom: 8 }}>
          {signedMoney(delta)} depuis le départ ({money(s.bankrollInitial)})
        </div>
        <BankrollChart points={d.curve} start={s.bankrollInitial} />
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="v">{pct(d.hitRate)}</div>
          <div className="l">Réussite</div>
        </div>
        <div className="kpi">
          <div className={`v ${d.profit > 0 ? 'pos' : d.profit < 0 ? 'neg' : ''}`}>{signedMoney(d.profit).replace(',00', '')}</div>
          <div className="l">Bénéfice</div>
        </div>
        <div className="kpi">
          <div className={`v ${d.roi !== null && d.roi > 0 ? 'pos' : d.roi !== null && d.roi < 0 ? 'neg' : ''}`}>{signedPct(d.roi)}</div>
          <div className="l">ROI</div>
        </div>
        <div className="kpi">
          <div className="v">{fmtOdds(d.avgOdds)}</div>
          <div className="l">Cote moyenne</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: d.hitRate !== null && d.breakEven !== null ? (d.hitRate >= d.breakEven ? 'var(--green)' : 'var(--orange)') : undefined }}>{pct(d.breakEven, 1)}</div>
          <div className="l">Mini rentable</div>
        </div>
        <div className="kpi">
          <div className="v">{d.won}-{d.lost}</div>
          <div className="l">Bilan G-P</div>
        </div>
      </div>

      <Banner tone={methodVerdict.tone}>
        <div className="tiny" style={{ fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>La méthode marche-t-elle ?</div>
        {methodVerdict.text}
        <div className="tiny faint" style={{ marginTop: 4 }}>Taux minimum pour être rentable = 1 ÷ cote moyenne.</div>
      </Banner>

      <div className="card tight stack" style={{ gap: 10 }}>
        <div className="row between">
          <span className="row" style={{ gap: 8 }}>
            <IconShield size={18} style={{ color: 'var(--neon)' }} />
            <b>Mise fixe conseillée</b>
          </span>
          <span className="odds-tag">{money(stake)}</span>
        </div>
        <div className="small muted">{s.stakePct} % de ta bankroll {isTest ? 'fictive' : ''} · paris simples uniquement.</div>
        {s.weeklyLossLimitPct > 0 && (
          <>
            <div className="row between small">
              <span className="muted">Pertes de la semaine (réel)</span>
              <b className={week.reached ? 'neg' : ''}>
                {money(week.loss)} / {money(week.limit)}
              </b>
            </div>
            <div className={`progress ${week.ratio > 0.7 ? 'red' : ''}`}>
              <div style={{ width: `${week.ratio * 100}%` }} />
            </div>
          </>
        )}
      </div>

      <button className="btn primary block" onClick={() => { haptic.medium(); goAnalyze(); }}>
        Nouvelle analyse <IconChevronRight />
      </button>

      <div className="section-title">
        <span>Matchs du jour</span>
        {provider && <span className="chip blue">{provider.label}</span>}
      </div>
      {provider ? (
        <FixturesList onPick={analyzeFixture} limit={6} />
      ) : (
        <button className="card tight row press" style={{ textAlign: 'left' }} onClick={goSettings}>
          <IconCloud size={26} style={{ color: 'var(--blue)', flex: 'none' }} />
          <div className="grow">
            <b>Activer le mode automatique</b>
            <div className="small muted">Colle une clé API gratuite (API-Football ou football-data.org) pour récupérer les matchs du jour et préremplir les analyses.</div>
          </div>
          <IconChevronRight />
        </button>
      )}

      <div className="section-title">
        <span>Derniers paris</span>
        {bets.length > 0 && (
          <button className="chip" onClick={goHistory}>
            Tout voir
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="empty card">
          <span className="ball">⚽</span>
          Aucun pari pour l'instant. Lance une analyse : tes 20 premiers paris seront fictifs, pour t'entraîner.
        </div>
      ) : (
        recent.map((b) => (
          <MatchCard
            key={b.id}
            league={`${b.league || 'Match'} · ${dateShort(b.date)}${b.test ? ' · TEST' : ''}`}
            home={{ name: b.home }}
            away={{ name: b.away }}
            verdict={b.verdict}
            odds={b.odds}
            right={
              b.result === 'pending' ? (
                <span className="chip">En cours</span>
              ) : (
                <span className={`chip ${b.result === 'won' ? 'green' : b.result === 'lost' ? 'red' : ''}`}>{b.result === 'void' ? 'Remboursé' : signedMoney(profit(b))}</span>
              )
            }
            onClick={goHistory}
          />
        ))
      )}
      <div className="tiny faint center" style={{ marginTop: 6 }}>18+ · Les jeux d'argent comportent des risques : endettement, isolement, dépendance. Appelle le 09 74 75 13 13 (Joueurs Info Service).</div>
    </div>
  );
}
