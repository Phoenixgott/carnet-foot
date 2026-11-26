import { useState } from 'react';
import { actions, useStore } from '../lib/store';
import { todayISO, uid } from '../lib/defaults';
import { dashboard, fixedStake, nextBetIsTest, profit, testCount, weekStatus } from '../lib/stats';
import { dateShort, money, odds as fmtOdds, pct, signedMoney } from '../lib/format';
import { VERDICT_COLOR } from '../lib/method';
import type { Bet, BetResult } from '../lib/types';
import { haptic } from '../lib/native';
import { BankrollChart } from '../components/Charts';
import { ask, Banner, Explain, Guide, NumberField, Segmented, Sheet, TextField, toast } from '../components/ui';
import { IconPlus, IconTrash } from '../components/Icons';

export function Bets() {
  const bets = useStore((st) => st.bets);
  const s = useStore((st) => st.settings);
  const tc = testCount(bets);
  const realCount = bets.length - tc;
  const [view, setView] = useState<'real' | 'test'>(realCount > 0 ? 'real' : 'test');
  const [edit, setEdit] = useState<Bet | null>(null);
  const [add, setAdd] = useState(false);
  const isTest = view === 'test';
  const d = dashboard(bets, s, isTest);
  const week = weekStatus(bets, s);
  const list = bets.filter((b) => b.test === isTest).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const decided = d.won + d.lost;
  const trainingDone = s.testMode && tc >= s.testBetsTarget;

  let verdict: { tone: 'green' | 'red' | 'blue'; text: React.ReactNode };
  if (decided < 10 || d.hitRate === null || d.breakEven === null) {
    verdict = { tone: 'blue', text: <>Encore <b>{Math.max(0, 10 - decided)} pari(s)</b> à terminer avant de savoir si la méthode marche pour toi.</> };
  } else if (d.hitRate > d.breakEven) {
    verdict = { tone: 'green', text: <>👍 <b>La méthode marche pour toi.</b> Tu gagnes {Math.round(d.hitRate * 100)} paris sur 100, il en fallait au moins {Math.ceil(d.breakEven * 100)}.</> };
  } else {
    verdict = { tone: 'red', text: <>👎 <b>Pas encore rentable.</b> Tu gagnes {Math.round(d.hitRate * 100)} paris sur 100, il en faut au moins {Math.ceil(d.breakEven * 100)}. Fais une pause et relis la méthode.</> };
  }

  const setResult = (b: Bet, r: BetResult) => {
    if (r === 'won') haptic.success();
    else if (r === 'lost') haptic.error();
    actions.updateBet(b.id, { result: r, settledAt: new Date().toISOString() });
  };

  return (
    <div className="stack">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'real', label: `Pour de vrai${realCount ? ` · ${realCount}` : ''}` },
          { value: 'test', label: `Entraînement · ${tc}/${s.testBetsTarget}` },
        ]}
      />

      {trainingDone && (
        <Banner tone="green">
          <b>Entraînement terminé ({s.testBetsTarget} paris pour de faux).</b>
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <button
              className="btn small primary"
              onClick={async () => {
                if (await ask({ title: 'Passer aux paris pour de vrai ?', message: 'Mise fixe, paris simples, limite par semaine : les règles restent les mêmes.', confirm: 'Oui, passer pour de vrai' })) {
                  actions.updateSettings({ testMode: false });
                  setView('real');
                }
              }}
            >
              Passer pour de vrai
            </button>
            <button className="btn small" onClick={() => actions.updateSettings({ testBetsTarget: s.testBetsTarget + 10 })}>
              +10 paris d'entraînement
            </button>
          </div>
        </Banner>
      )}

      <div className="card hero">
        <div className="label">{isTest ? 'ENTRAÎNEMENT : TON RÉSULTAT' : 'TON RÉSULTAT'}</div>
        <div className={`big-number ${d.profit > 0 ? 'pos' : d.profit < 0 ? 'neg' : ''}`} style={{ marginTop: 4 }}>
          {d.profit >= 0 ? 'Gagné ' : 'Perdu '}
          {money(Math.abs(d.profit))}
        </div>
        <div className="small muted" style={{ marginBottom: 8 }}>
          {d.won} gagné(s) sur {decided} · ton argent : <b style={{ color: 'var(--text)' }}>{money(d.bankroll)}</b>
        </div>
        <BankrollChart points={d.curve} start={s.bankrollInitial} />
      </div>

      <Banner tone={verdict.tone}>{verdict.text}</Banner>
      <Explain q="Comment on sait si c'est rentable ?">
        Avec une cote de {fmtOdds(d.avgOdds ?? 1.7)}, il faut gagner au moins <b>{Math.ceil((1 / (d.avgOdds ?? 1.7)) * 100)} paris sur 100</b> pour ne pas perdre d'argent (1 ÷ la cote). Au-dessus, tu gagnes. En dessous, tu perds.
        {d.hitRate !== null && <> Toi : {pct(d.hitRate)} de réussite, ROI {d.roi === null ? '—' : `${(d.roi * 100).toFixed(1).replace('.', ',')} %`}.</>}
      </Explain>

      {!isTest && s.weeklyLossLimitPct > 0 && (
        <div className="card tight stack" style={{ gap: 8 }}>
          <div className="row between small">
            <span className="muted">Pertes cette semaine</span>
            <b className={week.reached ? 'neg' : ''}>
              {money(week.loss)} / {money(week.limit)}
            </b>
          </div>
          <div className={`progress ${week.ratio > 0.7 ? 'red' : ''}`}>
            <div style={{ width: `${week.ratio * 100}%` }} />
          </div>
        </div>
      )}

      <div className="section-title">
        <span>Mes paris</span>
        <button className="chip" onClick={() => setAdd(true)}>
          <IconPlus size={14} /> Ajouter
        </button>
      </div>
      {list.some((b) => b.result === 'pending') && <Guide steps={[<>Quand un match est fini, touche <b>Gagné</b> ou <b>Perdu</b> sur son pari.</>]} />}
      {list.length === 0 && (
        <div className="empty card">
          <span className="ball">⚽</span>
          Pas encore de pari ici. Va dans <b>Matchs</b>, choisis un match vert, puis suis-le en <b>Live</b>.
        </div>
      )}
      {list.map((b) => {
        const p = profit(b);
        return (
          <div key={b.id} className="card bet-card match-card" style={{ ['--stripe' as string]: b.verdict ? VERDICT_COLOR[b.verdict] : 'var(--line-2)' }}>
            <div onClick={() => setEdit(b)} role="button">
              <div className="league">
                <span className="ellipsis grow">
                  {b.league || 'Match'} · {dateShort(b.date)}
                </span>
                {b.live && <span className="chip orange">Live{b.minute ? ` ${b.minute}'` : ''}</span>}
                {b.hedge && <span className="chip green">Sécurisé</span>}
                {b.kind === 'combine' && <span className="chip red">Combiné</span>}
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 700, fontSize: 15.5 }}>{b.match}</div>
                  <div className="small muted">Mise {money(b.stake)}</div>
                </div>
                <span className="odds-tag">{fmtOdds(b.odds)}</span>
              </div>
            </div>
            {b.result === 'pending' ? (
              <div className="result-btns" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button className="won" onClick={() => setResult(b, 'won')}>
                  ✓ Gagné
                </button>
                <button className="lost" onClick={() => setResult(b, 'lost')}>
                  ✗ Perdu
                </button>
              </div>
            ) : (
              <div className="row between" style={{ marginTop: 8 }}>
                <span className={`chip ${p > 0 ? 'green' : p < 0 ? 'red' : ''}`}>{p > 0 ? 'Gagné' : p < 0 ? 'Perdu' : 'Remboursé'}</span>
                <b className={p > 0 ? 'pos' : p < 0 ? 'neg' : 'muted'}>{signedMoney(p)}</b>
              </div>
            )}
          </div>
        );
      })}
      {edit && <EditBet bet={edit} onClose={() => setEdit(null)} />}
      {add && <AddBet onClose={() => setAdd(false)} />}
    </div>
  );
}

function EditBet({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const [result, setResult] = useState<BetResult>(bet.result);
  const [odds, setOdds] = useState<number | null>(bet.odds);
  const [stake, setStake] = useState<number | null>(bet.stake);
  return (
    <Sheet open onClose={onClose} title="Modifier le pari">
      <div className="stack">
        <div className="muted">{bet.match}</div>
        {bet.hedge && <Banner tone="green">Pari sécurisé : résultat {signedMoney(profit(bet))}.</Banner>}
        <div className="grid2">
          <NumberField label="Cote" value={odds} onChange={setOdds} />
          <NumberField label="Mise" value={stake} onChange={setStake} suffix="€" />
        </div>
        <Segmented
          value={result}
          onChange={setResult}
          options={[
            { value: 'pending', label: 'En cours' },
            { value: 'won', label: 'Gagné' },
            { value: 'lost', label: 'Perdu' },
            { value: 'void', label: 'Remb.' },
          ]}
        />
        <button
          className="btn primary block"
          onClick={() => {
            if (!odds || odds <= 1 || !stake || stake <= 0) return toast('Cote ou mise invalide', 'warn');
            actions.updateBet(bet.id, { odds, stake, result, settledAt: result === 'pending' ? undefined : bet.settledAt ?? new Date().toISOString(), ...(bet.hedge ? {} : { pnl: undefined }) });
            toast('Modifié ✓');
            onClose();
          }}
        >
          Enregistrer
        </button>
        <button
          className="btn danger block"
          onClick={async () => {
            if (await ask({ title: 'Supprimer ce pari ?', message: bet.match, confirm: 'Supprimer', tone: 'danger' })) {
              actions.deleteBet(bet.id);
              onClose();
            }
          }}
        >
          <IconTrash /> Supprimer
        </button>
      </div>
    </Sheet>
  );
}

function AddBet({ onClose }: { onClose: () => void }) {
  const bets = useStore((st) => st.bets);
  const s = useStore((st) => st.settings);
  const test = nextBetIsTest(bets, s);
  const [match, setMatch] = useState('');
  const [odds, setOdds] = useState<number | null>(null);
  const [stake, setStake] = useState<number | null>(fixedStake(bets, s, test));
  const [kind, setKind] = useState<'simple' | 'combine'>('simple');
  const save = async () => {
    if (!match.trim() || !odds || odds <= 1 || !stake) return toast('Écris le match, la cote et la mise', 'warn');
    if (kind === 'combine') {
      const go = await ask({ title: 'Combiné : hors méthode', message: 'La méthode, c\'est des paris SIMPLES uniquement. Avec un combiné, un seul match raté et tout est perdu.', confirm: 'Enregistrer quand même', cancel: 'Revenir en simple', tone: 'danger' });
      if (!go) return setKind('simple');
    }
    const [home, away] = match.split(/\s+[-–]\s+/);
    actions.addBet({ id: uid(), createdAt: new Date().toISOString(), date: todayISO(), match: match.trim(), home: home ?? match, away: away ?? '', league: '', odds, stake, kind, live: false, test, verdict: null, score: null, result: 'pending' });
    haptic.success();
    toast('Pari ajouté ✓');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Ajouter un pari">
      <div className="stack">
        <TextField label="Match" value={match} onChange={setMatch} placeholder="Ex. Lens – Lille" />
        <div className="grid2">
          <NumberField label="Cote" value={odds} onChange={setOdds} />
          <NumberField label="Mise" value={stake} onChange={setStake} suffix="€" />
        </div>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'combine', label: 'Combiné' },
          ]}
        />
        {kind === 'combine' && <Banner tone="red">Paris en <b>SIMPLE uniquement</b> : un combiné n'est pas dans la méthode.</Banner>}
        {test && <Banner tone="blue">Ce pari sera noté <b>pour de faux</b> (entraînement).</Banner>}
        <button className="btn primary block" onClick={save}>
          Ajouter
        </button>
      </div>
    </Sheet>
  );
}
