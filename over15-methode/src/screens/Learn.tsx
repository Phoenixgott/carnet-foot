import { useStore } from '../lib/store';
import { computeValue } from '../lib/value';
import { odds as fmtOdds } from '../lib/format';
import { openUrl } from '../lib/native';
import { ValueGauge } from '../components/Value';
import { IconExternal } from '../components/Icons';

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card learn">
      <h3>
        <span className="chip green" style={{ marginRight: 8, fontSize: 13 }}>{n}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function Learn() {
  const s = useStore((st) => st.settings);
  const pTrue = 1 / 7 / (1 + s.pinnacleMargin);
  const ex = computeValue(8.4, pTrue, 'pinnacle1', s, 'Al Feiha');
  const exBad = computeValue(8.4, 0.08, 'perso', s, 'Al Feiha');
  const loseStreak = Math.round(Math.pow(5 / 6, 10) * 100);
  return (
    <div className="stack">
      <Section n={1} title="C'est quoi un outsider ?">
        <p>
          C'est l'équipe qui n'est <b>pas favorite</b>. Sa cote est grosse (au moins {fmtOdds(s.minOdds)}) : elle gagne rarement, mais quand elle gagne, ça rapporte beaucoup.
        </p>
      </Section>

      <Section n={2} title="Grosse cote ≠ bonne affaire">
        <p>
          Une cote, c'est une chance cachée. Pour la voir : <b>1 ÷ cote</b>.
        </p>
        <p>
          Al Feiha à <b>8,40</b> : 1 ÷ 8,40 = <b>11,9 %</b>. Le bookmaker pense qu'Al Feiha a environ 12 chances sur 100 de gagner.
        </p>
        <p>
          Si la <b>vraie</b> chance est plus grande que ça, la cote est trop généreuse : c'est une <b>bonne affaire ✅</b>. Si elle est plus petite, c'est un <b>piège ❌</b>.
        </p>
      </Section>

      <Section n={3} title="Où trouver la vraie chance ?">
        <p>
          L'astuce des pros : <b>Pinnacle</b>, le bookmaker qui a les cotes les plus justes du monde. L'app retire sa petite marge et obtient la vraie chance.
        </p>
        <p>
          Exemple : Winamax propose 8,40, Pinnacle 7,00 → vraie chance ≈ {(pTrue * 100).toFixed(1).replace('.', ',')} %.
        </p>
        <ValueGauge r={ex} />
        <p className="small muted">
          Sans Pinnacle, l'app prend l'estimation de Claude (moins fiable) ou la tienne. Avec une vraie chance de 8 %, la même cote 8,40 serait un piège :
        </p>
        <ValueGauge r={exBad} compact />
      </Section>

      <Section n={4} title="Quand on parie">
        <p>
          Seulement quand la <b>value</b> est d'au moins <b>+{Math.round(s.valueMin * 100)} %</b> (✅ OK).
        </p>
        <p>
          La value, c'est ce que tu gagnes « en moyenne » pour 1 € misé : vraie chance × cote − 1. Exemple : {(pTrue * 100).toFixed(1).replace('.', ',')} % × 8,40 − 1 = <b>+{Math.round(ex.value * 100)} %</b>.
        </p>
        <p>Toujours en pari <b>simple</b>, toujours la <b>même mise</b>.</p>
      </Section>

      <Section n={5} title="Les signaux qui aident">
        <p>🎯 <b>Les xG</b> (buts attendus) : un outsider qui se crée beaucoup d'occasions mais perd de peu est souvent sous-coté.</p>
        <p>📊 <b>La forme</b> sur 5 à 10 matchs, à domicile et à l'extérieur séparément.</p>
        <p>📈 <b>Le classement Elo</b> : une note de force pour chaque équipe.</p>
        <p>🚑 <b>Les absents chez le favori</b>, surtout le gardien ou le buteur.</p>
        <p>😴 <b>La fatigue</b> : un favori qui a joué la Coupe d'Europe en semaine fait souvent tourner.</p>
        <p>🔥 <b>La motivation</b> : maintien, derby, fin de saison sans enjeu.</p>
        <p>📉 <b>La cote qui baisse</b> avant le match : des parieurs bien informés misent dessus.</p>
        <p className="small muted">Claude cherche tout ça pour toi et l'affiche sur chaque outsider.</p>
      </Section>

      <Section n={6} title="Il faut être patient">
        <p>
          Avec une cote de 6, tu gagnes environ <b>1 fois sur 6</b>. Perdre <b>10 fois de suite</b>, ça arrive dans {loseStreak} % des cas, même avec de bons paris.
        </p>
        <p>
          C'est pour ça qu'on mise peu ({String(s.stakePct).replace('.', ',')} % de ton argent par pari) et toujours pareil. Jamais de « je me refais ».
        </p>
      </Section>

      <Section n={7} title="Ton bilan perso">
        <p>
          Note <b>tous</b> tes paris. Au bout de <b>100 à 200 paris</b>, l'onglet <b>Mes paris</b> te montre noir sur blanc quels outsiders te réussissent : par tranche de cote (3 à 5, 5 à 8, plus de 8) et par championnat.
        </p>
        <p>✅ = tu gagnes de l'argent sur ce groupe. ❌ = arrête ce type de pari.</p>
      </Section>

      <Section n={8} title="À savoir, honnêtement">
        <p>
          Aucune méthode ne gagne à tous les coups. Les championnats exotiques (Azerbaïdjan, Géorgie…) ont peu de données : les cotes y sont parfois mal ajustées, mais c'est plus dur à analyser. Pinnacle sert ici de <b>référence</b> : il n'est pas autorisé en France, on n'y parie pas.
        </p>
        <p>Réservé aux plus de 18 ans. Besoin d'aide : 09 74 75 13 13 (Joueurs Info Service, appel non surtaxé).</p>
        <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn small" onClick={() => openUrl('https://www.oddsportal.com/')}>
            OddsPortal (cotes Pinnacle) <IconExternal />
          </button>
          <button className="btn small" onClick={() => openUrl('http://clubelo.com/')}>
            ClubElo <IconExternal />
          </button>
          <button className="btn small" onClick={() => openUrl('https://www.football-data.co.uk/')}>
            football-data.co.uk <IconExternal />
          </button>
          <button className="btn small" onClick={() => openUrl('https://www.joueurs-info-service.fr/')}>
            Joueurs Info Service <IconExternal />
          </button>
        </div>
      </Section>
    </div>
  );
}
