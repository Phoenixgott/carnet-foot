import { useStore } from '../lib/store';
import { fixedStake, nextBetIsTest, testCount, weekStatus } from '../lib/stats';
import { money } from '../lib/format';
import { haptic } from '../lib/native';
import { Coach } from '../components/Coach';
import { Banner } from '../components/ui';
import type { Tab } from '../components/BottomNav';

/** Accueil : le coach + 4 grosses tuiles. Rien d'autre. */
export function Home({ go }: { go: (t: Tab) => void }) {
  const bets = useStore((st) => st.bets);
  const s = useStore((st) => st.settings);
  const test = nextBetIsTest(bets, s);
  const stake = fixedStake(bets, s, test);
  const pending = bets.filter((b) => b.result === 'pending').length;
  const week = weekStatus(bets, s);
  const h = new Date().getHours();
  const hello = h < 12 ? 'Bonjour' : h < 18 ? 'Salut' : 'Bonsoir';

  const tile = (t: Tab, color: string, emoji: string, title: string, sub: string) => (
    <button
      className={`tile ${color}`}
      onClick={() => {
        haptic.tap();
        go(t);
      }}
    >
      <span className="tile-emoji">{emoji}</span>
      <span>
        <span className="tile-title" style={{ display: 'block' }}>
          {title}
        </span>
        <span className="tile-sub" style={{ display: 'block' }}>
          {sub}
        </span>
      </span>
    </button>
  );

  return (
    <div className="stack">
      <Coach>{hello} ! Qu'est-ce qu'on fait aujourd'hui ? 👇</Coach>

      {week.reached && (
        <Banner tone="red">
          <b>Stop pour cette semaine.</b> Tu as atteint ta limite de pertes. On reprend lundi.
        </Banner>
      )}

      <div className="tiles">
        {tile('find', 'blue', '🔎', 'Trouver', 'Les bonnes cotes du jour')}
        {tile('check', 'green', '✅', 'Vérifier', 'Bonne affaire ou piège ?')}
        {tile('system', 'purple', '🎯', 'Système', 'Quand suis-je remboursé ?')}
        {tile('bets', 'orange', '📊', 'Mes paris', pending ? `${pending} résultat(s) à voir` : 'Gagné ou perdu ?')}
        <button
          className="tile wide"
          onClick={() => {
            haptic.tap();
            go('howto');
          }}
        >
          <span className="tile-emoji">🎬</span>
          <span>
            <span className="tile-title" style={{ display: 'block' }}>
              Comment ça marche ?
            </span>
            <span className="tile-sub muted" style={{ display: 'block', opacity: 1 }}>
              Les mini-vidéos en 1 minute
            </span>
          </span>
        </button>
      </div>

      <div className="card tight row between">
        <div>
          <div className="tiny muted" style={{ fontWeight: 800 }}>Ta mise par pari</div>
          <div style={{ fontWeight: 900, fontSize: 26 }}>{money(stake)}</div>
        </div>
        <span className={`chip ${test ? 'blue' : 'green'}`}>{test ? `🎮 Entraînement ${testCount(bets)}/${s.testBetsTarget}` : '💶 Pour de vrai'}</span>
      </div>
      <div className="tiny faint center">18+ · Jouer comporte des risques. Besoin d'aide : 09 74 75 13 13 (Joueurs Info Service).</div>
    </div>
  );
}
