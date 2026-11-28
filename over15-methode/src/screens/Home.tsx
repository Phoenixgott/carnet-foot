import { useStore } from '../lib/store';
import { fixedStake, nextBetIsTest, testCount, weekStatus } from '../lib/stats';
import { money } from '../lib/format';
import { haptic } from '../lib/native';
import { Banner } from '../components/ui';
import { IconBook, IconList, IconTarget } from '../components/Icons';
import type { Tab } from '../components/BottomNav';

/** Accueil minimaliste : une grande action, puis une liste sobre. */
export function Home({ go }: { go: (t: Tab) => void }) {
  const bets = useStore((st) => st.bets);
  const s = useStore((st) => st.settings);
  const test = nextBetIsTest(bets, s);
  const stake = fixedStake(bets, s, test);
  const pending = bets.filter((b) => b.result === 'pending').length;
  const week = weekStatus(bets, s);
  const h = new Date().getHours();
  const hello = h < 6 ? 'Bonne nuit.' : h < 12 ? 'Bonjour.' : h < 18 ? 'Bon après-midi.' : 'Bonsoir.';
  const nav = (t: Tab) => () => {
    haptic.tap();
    go(t);
  };

  const row = (t: Tab, icon: React.ReactNode, label: string, badge?: number) => (
    <button className="menu-row" onClick={nav(t)}>
      <span className="ico">{icon}</span>
      <span>{label}</span>
      {badge ? <span className="badge">{badge}</span> : null}
      <span className="arrow">›</span>
    </button>
  );

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="home-hero">
        <div className="hello">{hello}</div>
        <div className="tag">Les grosses cotes qui valent vraiment le coup.</div>
      </div>

      {week.reached && <Banner tone="red">Limite de pertes de la semaine atteinte. On reprend lundi.</Banner>}

      <button className="home-cta" onClick={nav('find')}>
        <span>
          Trouver les bonnes affaires
          <small>
            Cotes {s.huntMinOdds.toFixed(2).replace('.', ',')}+ · Europe · {s.huntCount} max
          </small>
        </span>
        <span style={{ fontSize: 22 }}>→</span>
      </button>

      <div className="menu">
        {row('check', <IconTarget size={20} />, 'Vérifier une cote')}
        {row('system', <span style={{ fontWeight: 700, fontSize: 15 }}>2/6</span>, 'Système de doubles')}
        {row('bets', <IconList size={20} />, 'Mes paris', pending)}
        {row('howto', <IconBook size={20} />, 'Comment ça marche')}
      </div>

      <div className="foot-note">
        Mise {money(stake)} · {test ? `entraînement ${testCount(bets)}/${s.testBetsTarget}` : 'pour de vrai'}
        <br />
        18+ · Joueurs Info Service 09 74 75 13 13
      </div>
    </div>
  );
}
