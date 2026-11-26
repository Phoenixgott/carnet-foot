import { useStore } from '../lib/store';
import { chanceOver15, hedgePlan } from '../lib/method';
import { money, odds as fmtOdds } from '../lib/format';
import { openUrl } from '../lib/native';
import { Explain } from '../components/ui';
import { IconExternal } from '../components/Icons';

const GOALS = [
  { label: '0-15e', v: 11.5 },
  { label: '16-30e', v: 14.1 },
  { label: '31-45e', v: 15.9 },
  { label: '46-60e', v: 15.7 },
  { label: '61-75e', v: 18.2 },
  { label: '76-90e', v: 24.6 },
];

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
  const c0 = Math.round(chanceOver15(2.8, 0) * 100);
  const c20 = Math.round(chanceOver15(2.8, 20) * 100);
  const ex = hedgePlan(4, 1.8, 4);
  const need = (o: number) => Math.ceil((1 / o) * 100);
  return (
    <div className="stack">
      <Section n={1} title="C'est quoi « Over 1.5 » ?">
        <p>
          Tu paries qu'il y aura <b>au moins 2 buts</b> dans le match. Peu importe qui gagne.
        </p>
        <p>
          Tu perds seulement si le match finit <b>0-0, 1-0 ou 0-1</b>.
        </p>
      </Section>

      <Section n={2} title="Pourquoi pas avant le match ?">
        <p>
          Avant le match, la cote est souvent de <b>1,20 à 1,30</b>. C'est trop peu : à 1,25, il faut gagner <b>{need(1.25)} paris sur 100</b> juste pour ne pas perdre d'argent.
        </p>
        <p>À {fmtOdds(s.minLiveOdds)}, il suffit d'en gagner {need(s.minLiveOdds)} sur 100. C'est plus atteignable… à condition de bien choisir le match avec les 4 critères.</p>
      </Section>

      <Section n={3} title="L'astuce : attendre le live">
        <p>
          Il y a <b>peu de buts au début</b> d'un match, et beaucoup à la fin. Voici où tombent les buts (Premier League, saison 2024) :
        </p>
        {GOALS.map((g) => (
          <div key={g.label} className="bar-row">
            <span className="muted">{g.label}</span>
            <div className="bar" style={{ width: `${(g.v / 25) * 100}%` }} />
            <b>{g.v.toString().replace('.', ',')} %</b>
          </div>
        ))}
        <p>
          Donc si c'est encore <b>0-0 à la {s.entryFrom}e–{s.entryTo}e minute</b>, presque tous les buts sont encore à venir… mais la cote, elle, a déjà monté. Pour un match où on attend environ 3 buts, les chances de voir 2 buts passent seulement de {c0} % au coup d'envoi à {c20} % à la 20e minute.
        </p>
      </Section>

      <Section n={4} title="Les 4 critères pour choisir le match">
        <p>
          <b>1. Les deux équipes marquent ET encaissent</b> : au moins {s.teamMin.toString().replace('.', ',')} but marqué et encaissé par match. Une équipe qui ne prend jamais de but, c'est mauvais pour nous.
        </p>
        <p>
          <b>2. Les meilleurs buteurs jouent</b> : un attaquant blessé ou suspendu, c'est un signal d'alarme.
        </p>
        <p>
          <b>3. Beaucoup de matchs avec 2 buts ou plus</b> : au moins {s.over15Min} % des matchs de chaque équipe.
        </p>
        <p>
          <b>4. Pas de pression excessive</b> : pas de finale, de derby, de match pour le maintien ou la montée, ni de match sans enjeu.
        </p>
        <p>L'app vérifie tout ça pour toi et met un feu : 🟢 on peut jouer, 🟠 prudence, 🔴 on ne joue pas.</p>
      </Section>

      <Section n={5} title="Quand entrer dans le match">
        <p>
          Les 3 questions, vers la {s.entryFrom}e–{s.entryTo}e minute :
        </p>
        <p>
          ① C'est <b>0-0</b> ? ② Le match est <b>animé</b> (des tirs, des occasions) ? ③ La cote « Plus de 1,5 but » est au moins à <b>{fmtOdds(s.minLiveOdds)}</b> ?
        </p>
        <p>
          Trois fois oui ? Tu mises ta <b>mise fixe</b>. Sinon, tu attends un peu (la cote monte toute seule tant qu'il n'y a pas de but). Après la {s.lastEntry}e minute, on n'entre plus.
        </p>
      </Section>

      <Section n={6} title="Sécuriser au premier but">
        <p>Dès le premier but, il ne manque plus qu'un but pour gagner. On en profite pour assurer un gain :</p>
        <p>
          <b>Exemple</b> : tu as misé {money(4)} à 1,80. But ! La cote « Moins de 1,5 but » est à 4,00. L'app te dit de miser <b>{money(ex.stake)}</b> dessus. Résultat : tu gagnes <b>{money(ex.gain)}</b> quoi qu'il arrive.
        </p>
        <Explain q="Et le cash-out ?">L'appli de paris te propose de te racheter ton pari tout de suite. Tape le montant dans l'app : elle te dit si ça vaut le coup.</Explain>
      </Section>

      <Section n={7} title="Les règles d'or">
        <p>✅ Toujours la même mise ({s.stakePct.toString().replace('.', ',')} % de ton argent).</p>
        <p>✅ Paris <b>simples</b> uniquement : jamais de combiné.</p>
        <p>✅ Une limite de pertes par semaine : quand elle est atteinte, on arrête jusqu'au lundi.</p>
        <p>✅ {s.testBetsTarget} paris pour de faux avant de jouer pour de vrai.</p>
        <p>❌ Ne jamais essayer de « se refaire » après une perte.</p>
        <p>❌ Le live, c'est rapide : si tu t'énerves facilement, ce n'est pas pour toi.</p>
      </Section>

      <Section n={8} title="À savoir, honnêtement">
        <p>
          Aucune méthode ne gagne à tous les coups. Les chances affichées sont des <b>estimations</b> calculées à partir des chiffres trouvés par Claude, qui peut se tromper : vérifie si un chiffre te paraît bizarre.
        </p>
        <p>Réservé aux plus de 18 ans. Besoin d'aide : 09 74 75 13 13 (Joueurs Info Service, appel non surtaxé).</p>
        <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn small" onClick={() => openUrl('https://www.soccerstats.com/stats.asp?page=10')}>
            Source : buts par quart d'heure <IconExternal />
          </button>
          <button className="btn small" onClick={() => openUrl('https://www.joueurs-info-service.fr/')}>
            Joueurs Info Service <IconExternal />
          </button>
        </div>
      </Section>
    </div>
  );
}
