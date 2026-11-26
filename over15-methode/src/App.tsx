import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Intro } from './components/Intro';
import { AskHost, ToastHost } from './components/ui';
import { hideSplash, initBackButton, openUrl } from './lib/native';
import { actions, useStore } from './lib/store';
import { pruneCache } from './lib/api/cache';
import { nextBetIsTest, testCount } from './lib/stats';
import type { Fixture } from './lib/api';
import { Home } from './screens/Home';
import { Analyze } from './screens/Analyze';
import { Leagues } from './screens/Leagues';
import { History } from './screens/History';
import { Settings } from './screens/Settings';

const TITLES: Record<Tab, { title: string; sub: string }> = {
  home: { title: 'Over 1.5', sub: 'Méthode +1.5 buts · tableau de bord' },
  analyze: { title: 'Analyser', sub: 'Les 6 étapes de la méthode' },
  leagues: { title: 'Ligues', sub: '% de matchs +1.5 sur 90 minutes' },
  history: { title: 'Historique', sub: 'Tes paris et leurs résultats' },
  settings: { title: 'Réglages', sub: 'Bankroll, méthode, données' },
};

export function App() {
  const settings = useStore((s) => s.settings);
  const bets = useStore((s) => s.bets);
  const [introDone, setIntroDone] = useState(!settings.intro);
  const [tab, setTab] = useState<Tab>('home');
  const [pending, setPending] = useState<Fixture | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    // Le splash natif s'efface dès que l'interface (ou l'intro, de la même couleur) est prête.
    requestAnimationFrame(() => hideSplash());
    initBackButton(() => {
      if (tabRef.current !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    setTimeout(() => pruneCache(), 4000);
  }, []);

  const go = useCallback((t: Tab) => setTab(t), []);
  const analyzeFixture = useCallback((f: Fixture) => {
    setPending(f);
    setTab('analyze');
  }, []);

  const isTest = nextBetIsTest(bets, settings);
  const tc = testCount(bets);
  const head = TITLES[tab];

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo-mini">+1.5</div>
        <div className="grow">
          <h1>{head.title}</h1>
          <div className="sub">{head.sub}</div>
        </div>
        <span className={`mode-chip ${isTest ? '' : 'real'}`}>{isTest ? `Test ${tc}/${settings.testBetsTarget}` : 'Réel'}</span>
      </header>
      <main className="screen" key={tab}>
        {tab === 'home' && <Home goAnalyze={() => go('analyze')} goSettings={() => go('settings')} goHistory={() => go('history')} analyzeFixture={analyzeFixture} />}
        {tab === 'analyze' && <Analyze pendingFixture={pending} clearPending={() => setPending(null)} goHistory={() => go('history')} />}
        {tab === 'leagues' && <Leagues />}
        {tab === 'history' && <History />}
        {tab === 'settings' && <Settings />}
      </main>
      <BottomNav tab={tab} onChange={go} />
      {introDone && !settings.ageConfirmed && <AgeGate />}
      <ToastHost />
      <AskHost />
      {!introDone && <Intro onDone={() => setIntroDone(true)} />}
    </div>
  );
}

function AgeGate() {
  return (
    <div className="age-gate">
      <div className="stack" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div className="logo-mini" style={{ width: 84, height: 84, fontSize: 34, borderRadius: 24, margin: '0 auto' }}>+1.5</div>
        <h1 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 34, margin: '6px 0 0', textTransform: 'uppercase' }}>Over 1.5 – Méthode</h1>
        <p className="muted" style={{ margin: 0 }}>
          Assistant d'analyse des paris « plus de 1,5 but », selon la méthode de Steven (Team Soccer Bet). Tes 20 premiers paris sont fictifs, pour t'entraîner.
        </p>
        <div className="banner red" style={{ textAlign: 'left' }}>
          <span className="logo-mini" style={{ width: 34, height: 34, fontSize: 13, background: 'var(--red)', color: '#fff', boxShadow: 'none' }}>18+</span>
          <div className="small">
            Réservé aux personnes majeures. Les jeux d'argent comportent des risques : endettement, isolement, dépendance. Besoin d'aide : <b>09 74 75 13 13</b> (Joueurs Info Service, appel non surtaxé).
          </div>
        </div>
        <button className="btn primary block" onClick={() => actions.updateSettings({ ageConfirmed: true })}>
          J'ai 18 ans ou plus
        </button>
        <button className="btn ghost block small" onClick={() => openUrl('https://www.joueurs-info-service.fr/')}>
          Joueurs Info Service
        </button>
      </div>
    </div>
  );
}
