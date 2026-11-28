import { useState } from 'react';
import { actions, getState, useStore } from '../lib/store';
import { buildResultsPrompt, parseResults } from '../lib/claude';
import { byBand, byLeague, byValue, dashboard, profit, testCount, weekStatus, type GroupStat } from '../lib/stats';
import { dateShort, money, odds as fmtOdds, signedMoney } from '../lib/format';
import type { Bet, BetResult } from '../lib/types';
import { haptic } from '../lib/native';
import { BankrollChart } from '../components/Charts';
import { Donut, SaveBet } from '../components/Value';
import { ask, Banner, BigButton, Explain, NumberField, Segmented, Sheet, TextField, toast } from '../components/ui';
import { IconPlus, IconTrash } from '../components/Icons';
import { Coach } from '../components/Coach';
import { FetchFlow } from './FetchFlow';

const pc = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);

export function Bets() {
  const bets = useStore((st) => st.bets);
  const s = useStore((st) => st.settings);
  const tc = testCount(bets);
  const realCount = bets.length - tc;
  const [view, setView] = useState<'real' | 'test'>(realCount > 0 ? 'real' : 'test');
  const [edit, setEdit] = useState<Bet | null>(null);
  const [add, setAdd] = useState(false);
  const [results, setResults] = useState(false);
  const isTest = view === 'test';
  const mine = bets.filter((b) => b.test === isTest);
  const d = dashboard(bets, s, isTest);
  const week = weekStatus(bets, s);
  const pending = mine.filter((b) => b.result === 'pending');
  const decided = d.won + d.lost;
  const trainingDone = s.testMode && tc >= s.testBetsTarget;
  const list = [...mine].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const rentable = d.hitRate !== null && d.breakEven !== null ? d.hitRate > d.breakEven : null;

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
                if (await ask({ title: 'Passer aux paris pour de vrai ?', message: 'Mise fixe, paris simples, limite par semaine : les règles restent les mêmes.', confirm: 'Oui, pour de vrai' })) {
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

      {pending.length > 0 && (
        <>
          <Coach mood="think">Tu as {pending.length} pari{pending.length > 1 ? 's' : ''} en attente. Je demande les scores à Claude ?</Coach>
          <BigButton icon="🔎" title="Trouver mes résultats" sub="Claude trouve les scores, l'app fait le reste" onClick={() => setResults(true)} tone="primary" />
        </>
      )}

      <div className="card hero center">
        <div className="label">{isTest ? 'ENTRAÎNEMENT' : 'MON BILAN'}</div>
        <div style={{ margin: '10px 0' }}>
          <Donut won={d.won} lost={d.lost} />
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
          <span className="chip green">✅ {d.won} gagné(s)</span>
          <span className="chip red">❌ {d.lost} perdu(s)</span>
        </div>
        <div className={`big-number ${d.profit > 0 ? 'pos' : d.profit < 0 ? 'neg' : ''}`} style={{ fontSize: 34, marginTop: 12 }}>
          {d.profit >= 0 ? 'Gagné ' : 'Perdu '}
          {money(Math.abs(d.profit))}
        </div>
        <div className="small muted">ton argent : {money(d.bankroll)}</div>
      </div>

      {decided > 0 && d.breakEven !== null && (
        <div className="card tight stack" style={{ gap: 10 }}>
          <b style={{ fontSize: 18 }}>Est-ce que ça marche ?</b>
          <CompareBar label="Ta réussite" value={d.hitRate ?? 0} color={rentable ? 'var(--green)' : 'var(--red)'} />
          <CompareBar label="Il faut au moins" value={d.breakEven} color="var(--muted)" />
          <div className="small">
            {rentable ? '✅ OK : tu gagnes plus souvent qu\'il ne faut, tu es rentable.' : '❌ Pas OK : tu ne gagnes pas encore assez souvent pour tes cotes.'}
            {decided < 30 && <span className="muted"> (seulement {decided} pari(s) : il en faut au moins 100 pour être sûr)</span>}
          </div>
          <Explain q="Pourquoi « il faut au moins » ?">
            Avec une cote moyenne de {fmtOdds(d.avgOdds)}, tu gagnes beaucoup quand ça passe. Il suffit donc de gagner {pc(d.breakEven)} de tes paris pour ne pas perdre d'argent (1 ÷ la cote). Avec les outsiders, c'est normal de perdre souvent : ce qui compte, c'est ce chiffre.
          </Explain>
        </div>
      )}

      {decided > 0 && (
        <>
          <Groups title="Par cote" rows={byBand(mine)} />
          <Groups title="Selon la value calculée" rows={byValue(mine)} />
          <Groups title="Par championnat" rows={byLeague(mine).slice(0, 8)} />
          <div className="card hero">
            <div className="label">MON ARGENT</div>
            <BankrollChart points={d.curve} start={s.bankrollInitial} />
          </div>
        </>
      )}

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
      {list.length === 0 && (
        <div className="empty card">
          <span className="ball">⚽</span>
          Pas encore de pari. Va dans <b>Trouver</b> ou <b>Vérifier</b>, puis touche « J'ai parié ».
        </div>
      )}
      {list.map((b) => {
        const p = profit(b);
        const color = b.result === 'pending' ? 'var(--line-2)' : p > 0 ? 'var(--green)' : p < 0 ? 'var(--red)' : 'var(--muted)';
        return (
          <div key={b.id} className="card bet-card match-card" style={{ ['--stripe' as string]: color }}>
            <div onClick={() => setEdit(b)} role="button">
              <div className="league">
                <span className="ellipsis grow">
                  {b.league || 'Match'} · {dateShort(b.date)}
                </span>
                {typeof b.value === 'number' && <span className={`chip ${b.value >= s.valueMin ? 'green' : b.value >= 0 ? 'orange' : 'red'}`}>value {b.value >= 0 ? '+' : '−'}{Math.abs(Math.round(b.value * 100))} %</span>}
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 700, fontSize: 15.5 }}>{b.pick || b.match}</div>
                  <div className="small muted ellipsis">
                    {b.pick ? `${b.match} · ` : ''}mise {money(b.stake)}
                    {b.finalScore ? ` · score ${b.finalScore}` : ''}
                  </div>
                </div>
                <span className="odds-tag">{fmtOdds(b.odds)}</span>
              </div>
            </div>
            {b.result === 'pending' ? (
              <div className="result-btns" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button className="won" onClick={() => setResult(b, 'won')}>
                  ✅ Gagné
                </button>
                <button className="lost" onClick={() => setResult(b, 'lost')}>
                  ❌ Perdu
                </button>
              </div>
            ) : (
              <div className="row between" style={{ marginTop: 8 }}>
                <span className={`chip ${p > 0 ? 'green' : p < 0 ? 'red' : ''}`}>{p > 0 ? '✅ OK' : p < 0 ? '❌ Pas OK' : 'Remboursé'}</span>
                <b className={p > 0 ? 'pos' : p < 0 ? 'neg' : 'muted'}>{signedMoney(p)}</b>
              </div>
            )}
          </div>
        );
      })}
      {edit && <EditBet bet={edit} onClose={() => setEdit(null)} />}
      {add && <SaveBet preset={{ match: '', pick: '', odds: null, result: null }} onClose={() => setAdd(false)} />}
      {results && <Results pending={pending} onClose={() => setResults(false)} />}
    </div>
  );
}

function CompareBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="vg-row">
      <span className="vg-label">{label}</span>
      <div className="vg-track">
        <div className="vg-bar" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
      </div>
      <b className="vg-val" style={{ color }}>{pc(value)}</b>
    </div>
  );
}

function Groups({ title, rows }: { title: string; rows: GroupStat[] }) {
  if (!rows.length) return null;
  return (
    <div className="card tight stack" style={{ gap: 8 }}>
      <b>{title}</b>
      {rows.map((g) => {
        const okk = g.profit > 0;
        return (
          <div key={g.label} className="group-row">
            <span className="ellipsis">{g.label}</span>
            <span className="muted tiny">{g.n} pari(s)</span>
            <span className="tiny">
              {pc(g.rate)} <span className="faint">/ {pc(g.breakEven)}</span>
            </span>
            <b className={okk ? 'pos' : g.profit < 0 ? 'neg' : 'muted'}>{okk ? '✅' : g.profit < 0 ? '❌' : '➖'} {signedMoney(g.profit).replace(',00', '')}</b>
          </div>
        );
      })}
      <div className="tiny faint">Réussite / réussite minimum pour être rentable. ✅ = tu gagnes de l'argent sur ce groupe.</div>
    </div>
  );
}

function Results({ pending, onClose }: { pending: Bet[]; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title="Trouver mes résultats" top>
      <div className="stack">
        <Coach mood="think">Touche les 3 boutons : Claude cherche le score de tes {pending.length} match(s), et je mets « gagné » ou « perdu » tout seul.</Coach>
        <FetchFlow
          buildPrompt={() => buildResultsPrompt(pending)}
          video={false}
          onText={(text) => {
            const res = parseResults(text);
            const ids = new Set(getState().bets.map((b) => b.id));
            let n = 0;
            for (const r of res) {
              if (!ids.has(r.id)) continue;
              if (r.won === null) {
                if (r.score) actions.updateBet(r.id, { finalScore: r.score });
                continue;
              }
              actions.updateBet(r.id, { result: r.won ? 'won' : 'lost', finalScore: r.score || undefined, settledAt: new Date().toISOString() });
              n++;
            }
            onClose();
            return n ? `${n} résultat(s) mis à jour ✓` : 'Pas encore de résultat : matchs pas finis';
          }}
        />
      </div>
    </Sheet>
  );
}

function EditBet({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const [result, setResult] = useState<BetResult>(bet.result);
  const [odds, setOdds] = useState<number | null>(bet.odds);
  const [stake, setStake] = useState<number | null>(bet.stake);
  const [pick, setPick] = useState(bet.pick ?? '');
  return (
    <Sheet open onClose={onClose} title="Modifier le pari">
      <div className="stack">
        <div className="muted">{bet.match}</div>
        <TextField label="Mon pari" value={pick} onChange={setPick} />
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
            actions.updateBet(bet.id, { odds, stake, pick, result, settledAt: result === 'pending' ? undefined : bet.settledAt ?? new Date().toISOString(), pnl: undefined });
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
