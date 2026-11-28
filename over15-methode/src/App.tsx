import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Intro } from './components/Intro';
import { AskHost, ToastHost } from './components/ui';
import { hideSplash, initBackButton, openUrl } from './lib/native';
import { actions, getState, useStore } from './lib/store';
import { nextBetIsTest } from './lib/stats';
import { Home } from './screens/Home';
import { Find } from './screens/Find';
import { Check } from './screens/Check';
import { System } from './screens/System';
import { Bets } from './screens/Bets';
import { HowTo } from './screens/HowTo';
import { Settings } from './screens/Settings';

const TITLES: Record<Tab, string> = {
  home: '',
  find: 'Trouver',
  check: 'Vérifier',
  system: 'Système',
  bets: 'Mes paris',
  howto: 'Comment ça marche',
  settings: 'Réglages',
};

export function App() {
  const settings = useStore((s) => s.settings);
  const bets = useStore((s) => s.bets);
  const [introDone, setIntroDone] = useState(!settings.intro);
  const [tab, setTab] = useState<Tab>('home');
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
  }, []);

  const go = useCallback((t: Tab) => {
    setTab(t);
    document.querySelector('.screen')?.scrollTo({ top: 0 });
  }, []);

  const isTest = nextBetIsTest(bets, settings);
  const pending = bets.filter((b) => b.result === 'pending' && b.test === isTest).length;

  return (
    <div className="app">
      <header className="topbar">
        {tab === 'home' ? (
          <div className="logo-mini">+EV</div>
        ) : (
          <button className="icon-btn" onClick={() => go('home')} aria-label="Retour à l'accueil">
            <span style={{ fontSize: 18, fontWeight: 600 }}>←</span>
          </button>
        )}
        <div className="grow">
          <h1>{TITLES[tab]}</h1>
        </div>
        {tab !== 'settings' && (
          <button className="icon-btn" onClick={() => go('settings')} aria-label="Réglages">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
        )}
      </header>
      <main className="screen" key={tab}>
        {tab === 'home' && <Home go={go} />}
        {tab === 'find' && <Find goBets={() => go('bets')} />}
        {tab === 'check' && <Check goBets={() => go('bets')} />}
        {tab === 'system' && <System />}
        {tab === 'bets' && <Bets />}
        {tab === 'howto' && <HowTo />}
        {tab === 'settings' && <Settings goLearn={() => go('howto')} />}
      </main>
      <BottomNav tab={tab} onChange={go} pending={pending} />
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
      <div className="stack" style={{ maxWidth: 420, width: '100%', textAlign: 'center', alignItems: 'center' }}>
        <div className="logo-mini" style={{ width: 72, height: 72, fontSize: 24, borderRadius: 20 }}>+EV</div>
        <h1 style={{ fontWeight: 700, fontSize: 30, margin: 0, letterSpacing: '-0.03em' }}>Outsiders</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17 }}>
          Je te dis si une grosse cote est une <b>bonne affaire</b> ou un <b>piège</b>. Tes {getState().settings.testBetsTarget} premiers paris sont pour de faux, pour t'entraîner.
        </p>
        <div className="banner red" style={{ textAlign: 'left', width: '100%' }}>
          <span style={{ fontSize: 24 }}>🔞</span>
          <div className="small">
            Réservé aux personnes majeures. Jouer comporte des risques : endettement, isolement, dépendance. Besoin d'aide : <b>09 74 75 13 13</b> (Joueurs Info Service, appel non surtaxé).
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
