import { useMemo, useState } from 'react';
import { actions, useStore } from '../lib/store';
import { todayISO } from '../lib/defaults';
import { analyze } from '../lib/method';
import { buildDayPrompt, buildMatchPrompt } from '../lib/claude';
import { fixedStake, nextBetIsTest, weekStatus } from '../lib/stats';
import { money } from '../lib/format';
import type { MatchData, Verdict } from '../lib/types';
import { MatchCard } from '../components/MatchCard';
import { Banner, BigButton, Guide, Segmented, Sheet, TextField } from '../components/ui';
import { IconBook, IconPlus, IconRefresh, IconSpark } from '../components/Icons';
import { FetchFlow } from './FetchFlow';

const ORDER: Record<Verdict, number> = { GREEN: 0, ORANGE: 1, RED: 2 };

function dayTitle(date: string) {
  const d = new Date(date + 'T12:00:00');
  const t = todayISO();
  const tomorrow = todayISO(new Date(Date.now() + 86400000));
  if (date === t) return "Matchs d'aujourd'hui";
  if (date === tomorrow) return 'Matchs de demain';
  return `Matchs du ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
}

export function Matches({ openMatch, goLearn }: { openMatch: (id: string) => void; goLearn: () => void }) {
  const s = useStore((st) => st.settings);
  const matches = useStore((st) => st.matches);
  const matchesDate = useStore((st) => st.matchesDate);
  const bets = useStore((st) => st.bets);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [searching, setSearching] = useState(false);
  const [oneOpen, setOneOpen] = useState(false);
  const date = day === 'today' ? todayISO() : todayISO(new Date(Date.now() + 86400000));
  const isTest = nextBetIsTest(bets, s);
  const stake = fixedStake(bets, s, isTest);
  const week = weekStatus(bets, s);

  const list = useMemo(
    () => matches.map((m) => ({ m, a: analyze(m, s) })).sort((x, y) => ORDER[x.a.verdict] - ORDER[y.a.verdict] || y.a.okCount - x.a.okCount || x.m.time.localeCompare(y.m.time)),
    [matches, s],
  );
  const greens = list.filter((x) => x.a.verdict === 'GREEN').length;
  const showFlow = searching || !matches.length;

  return (
    <div className="stack">
      <div className="card tight row between">
        <div>
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Ta mise par pari</div>
          <div className="big-number" style={{ fontSize: 30 }}>{money(stake)}</div>
        </div>
        <span className={`chip ${isTest ? 'blue' : 'green'}`}>{isTest ? 'Pari pour de faux (entraînement)' : 'Pari pour de vrai'}</span>
      </div>

      {week.reached && (
        <Banner tone="red">
          <b>Stop pour cette semaine.</b> Tu as atteint ta limite de pertes ({money(week.limit)}). Reviens lundi.
        </Banner>
      )}

      {showFlow ? (
        <>
          <Guide
            steps={[
              <>Choisis le jour : <b>aujourd'hui</b> ou <b>demain</b>.</>,
              <>Fais les <b>5 étapes</b> ci-dessous, dans l'ordre. C'est Claude qui cherche les infos des matchs pour toi.</>,
              <>L'app te montre ensuite chaque match avec un <b>feu vert, orange ou rouge</b>.</>,
            ]}
          />
          <Segmented
            value={day}
            onChange={setDay}
            options={[
              { value: 'today', label: "Aujourd'hui" },
              { value: 'tomorrow', label: 'Demain' },
            ]}
          />
          <FetchFlow
            key={date}
            fallbackDate={date}
            buildPrompt={() => buildDayPrompt(date, s)}
            onImported={(ms, d) => {
              actions.setMatches(ms, d);
              setSearching(false);
            }}
          />
          {matches.length > 0 && (
            <button className="btn ghost block" onClick={() => setSearching(false)}>
              Annuler et revenir à mes matchs
            </button>
          )}
          <BigButton icon={<IconBook size={22} />} title="Comprendre la méthode" sub="Expliquée simplement, en 2 minutes" onClick={goLearn} tone="plain" />
        </>
      ) : (
        <>
          <div className="section-title">
            <span>{matchesDate ? dayTitle(matchesDate) : 'Matchs'}</span>
            <span className="chip green">{greens} vert(s)</span>
          </div>
          {greens > 0 ? (
            <Guide
              steps={[
                <>Touche un match <b style={{ color: 'var(--green)' }}>VERT</b>.</>,
                <>Lis son plan : l'app te dit quoi faire et quand.</>,
                <>Au coup d'envoi, touche <b>« Suivre ce match en live »</b>.</>,
              ]}
            />
          ) : (
            <Guide
              tone="orange"
              title="Pas de match vert"
              steps={[<>Aucun match ne coche les 4 critères.</>, <>Le mieux : <b>ne pas jouer aujourd'hui</b>. Ne pas parier, c'est aussi protéger ton argent.</>]}
            />
          )}
          {list.map(({ m, a }) => (
            <MatchCard key={m.id} competition={m.competition} time={m.time} home={m.home.name} away={m.away.name} verdict={a.verdict} okCount={a.okCount} reason={a.reason} onClick={() => openMatch(m.id)} />
          ))}
          <BigButton icon={<IconPlus size={22} />} title="Analyser un autre match" sub="Un match précis qui n'est pas dans la liste" onClick={() => setOneOpen(true)} tone="plain" />
          <BigButton icon={<IconRefresh size={22} />} title="Chercher d'autres matchs" sub="Refaire les 5 étapes (autre jour)" onClick={() => setSearching(true)} tone="plain" />
        </>
      )}

      <OneMatch open={oneOpen} onClose={() => setOneOpen(false)} onDone={(ms) => { actions.addMatches(ms); setOneOpen(false); if (ms[0]) openMatch(ms[0].id); }} />
      <div className="tiny faint center" style={{ marginTop: 6 }}>18+ · Les paris comportent des risques : endettement, isolement, dépendance. Besoin d'aide : 09 74 75 13 13 (Joueurs Info Service).</div>
    </div>
  );
}

function OneMatch({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (ms: MatchData[]) => void }) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const date = day === 'today' ? todayISO() : todayISO(new Date(Date.now() + 86400000));
  const ready = home.trim().length > 1 && away.trim().length > 1;
  return (
    <Sheet open={open} onClose={onClose} title="Un match précis">
      <div className="stack">
        <Guide steps={[<>Écris l'équipe qui <b>reçoit</b> (à domicile), puis l'autre.</>, <>Choisis le jour.</>, <>Fais les 5 étapes avec Claude, comme d'habitude.</>]} />
        <TextField label="Équipe à domicile" value={home} onChange={setHome} placeholder="Ex. Paris SG" />
        <TextField label="Équipe à l'extérieur" value={away} onChange={setAway} placeholder="Ex. Bayern Munich" />
        <Segmented
          value={day}
          onChange={setDay}
          options={[
            { value: 'today', label: "Aujourd'hui" },
            { value: 'tomorrow', label: 'Demain' },
          ]}
        />
        {ready ? (
          <FetchFlow key={home + away + date} fallbackDate={date} buildPrompt={() => buildMatchPrompt(home.trim(), away.trim(), date)} onImported={(ms) => onDone(ms)} />
        ) : (
          <Banner tone="blue" icon={<IconSpark />}>
            Écris d'abord les deux équipes : les étapes apparaîtront ici.
          </Banner>
        )}
      </div>
    </Sheet>
  );
}
