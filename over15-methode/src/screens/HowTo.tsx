import { useStore } from '../lib/store';
import { odds as fmtOdds } from '../lib/format';
import { openUrl } from '../lib/native';
import { Coach } from '../components/Coach';
import { ClaudeVideo, SystemVideo, ValueVideo } from '../components/Videos';

function Card({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row">
        <span style={{ fontSize: 30 }}>{emoji}</span>
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      <div style={{ fontSize: 15.5, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

/** « Comment ça marche ? » : 3 mini-vidéos et 5 idées simples. */
export function HowTo() {
  const s = useStore((st) => st.settings);
  return (
    <div className="stack">
      <Coach>Regarde les mini-vidéos, c'est tout simple !</Coach>

      <div className="section-title">🎬 1. Trouver les cotes avec Claude</div>
      <ClaudeVideo />

      <div className="section-title">🎬 2. Bonne affaire ou piège ?</div>
      <ValueVideo />
      <Card emoji="🧮" title="L'astuce">
        Une cote cache une chance : <b>1 ÷ cote</b>. À 8,40, le bookmaker donne <b>12 chances sur 100</b>. Si la <b>vraie</b> chance est plus grande (la cote de <b>Pinnacle</b>, le bookmaker le plus juste, le dit), la cote est trop généreuse : ✅ <b>bonne affaire</b>. Sinon : ❌ <b>piège</b>.
      </Card>

      <div className="section-title">🎬 3. Le système de doubles</div>
      <SystemVideo />
      <Card emoji="🎯" title="Remboursé ?">
        Avec 6 matchs, tu joues 15 doubles. Si 2 matchs passent, il faut que <b>cote 1 × cote 2 ≥ 15</b>. L'onglet <b>Système</b> te donne le tableau.
      </Card>

      <Card emoji="🧘" title="Les 3 règles d'or">
        ✅ Toujours la <b>même petite mise</b> ({String(s.stakePct).replace('.', ',')} % de ton argent).
        <br />✅ Seulement quand c'est une <b>bonne affaire</b> (value d'au moins +{Math.round(s.valueMin * 100)} %, cote d'outsider dès {fmtOdds(s.minOdds)}).
        <br />✅ <b>Patience</b> : un outsider perd souvent. 10 défaites de suite, ça arrive.
      </Card>

      <Card emoji="📊" title="Ton bilan">
        Note tous tes paris. Après 100 paris, <b>Mes paris</b> te montre ce qui marche ✅ et ce qui ne marche pas ❌.
      </Card>

      <Card emoji="🔞" title="Important">
        Aucune méthode ne gagne à tous les coups. Réservé aux plus de 18 ans. Besoin d'aide : <b>09 74 75 13 13</b> (Joueurs Info Service).
        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn small" onClick={() => openUrl('https://www.joueurs-info-service.fr/')}>
            Joueurs Info Service
          </button>
          <button className="btn small" onClick={() => openUrl('https://www.oddsportal.com/')}>
            OddsPortal (cotes Pinnacle)
          </button>
        </div>
      </Card>
    </div>
  );
}
