import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Intro } from './components/Intro';
import { AskHost, ToastHost } from './components/ui';
import { hideSplash, initBackButton, openUrl } from './lib/native';
import { actions, getState, useStore } from './lib/store';
import { nextBetIsTest, testCount } from './lib/stats';
import { Matches } from './screens/Matches';
import { MatchDetail } from './screens/MatchDetail';
import { Live } from './screens/Live';
import { Bets } from './screens/Bets';
import { Learn } from './screens/Learn';
import { Settings } from './screens/Settings';

const TITLES: Record<Tab, { title: string; sub: string }> = {
  matches: { title: 'Over 1.5', sub: 'Les matchs à jouer, expliqués simplement' },
  live: { title: 'Live', sub: 'Je te guide pendant le match' },
  bets: { title: 'Mes paris', sub: 'Ce que tu as gagné ou perdu' },
  learn: { title: 'Comprendre', sub: 'La méthode en 2 minutes' },
  settings: { title: 'Réglages', sub: 'Ton argent, les règles, la sauvegarde' },
};

export function App() {
  const settings = useStore((s) => s.settings);
  const bets = useStore((s) => s.bets);
  const live = useStore((s) => s.live);
  const [introDone, setIntroDone] = useState(!settings.intro);
  const [tab, setTab] = useState<Tab>(live && live.stage !== 'fini' ? 'live' : 'matches');
  const [detail, setDetail] = useState<string | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    // Le splash natif s'efface dès que l'interface (ou l'intro, de la même couleur) est prête.
    requestAnimationFrame(() => hideSplash());
    initBackButton(() => {
      if (tabRef.current !== 'matches') {
        setTab('matches');
        return true;
      }
      return false;
    });
  }, []);

  const go = useCallback((t: Tab) => {
    setTab(t);
    document.querySelector('.screen')?.scrollTo({ top: 0 });
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
        <span className={`mode-chip ${isTest ? '' : 'real'}`}>{isTest ? `Entraînement ${tc}/${settings.testBetsTarget}` : 'Pour de vrai'}</span>
      </header>
      <main className="screen" key={tab}>
        {tab === 'matches' && <Matches openMatch={setDetail} goLearn={() => go('learn')} />}
        {tab === 'live' && <Live goMatches={() => go('matches')} goBets={() => go('bets')} />}
        {tab === 'bets' && <Bets />}
        {tab === 'learn' && <Learn />}
        {tab === 'settings' && <Settings goLearn={() => go('learn')} />}
      </main>
      <BottomNav tab={tab} onChange={go} liveActive={!!live && live.stage !== 'fini'} />
      <MatchDetail id={detail} onClose={() => setDetail(null)} goLive={() => go('live')} />
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
          L'app te dit quels matchs jouer et te guide pendant le match, étape par étape. Tes {settingsTarget()} premiers paris sont pour de faux, pour t'entraîner.
        </p>
        <div className="banner red" style={{ textAlign: 'left' }}>
          <span className="logo-mini" style={{ width: 34, height: 34, fontSize: 13, background: 'var(--red)', color: '#fff', boxShadow: 'none' }}>18+</span>
          <div className="small">
            Réservé aux personnes majeures. Les paris comportent des risques : endettement, isolement, dépendance. Besoin d'aide : <b>09 74 75 13 13</b> (Joueurs Info Service, appel non surtaxé).
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

function settingsTarget() {
  return getState().settings.testBetsTarget;
}
