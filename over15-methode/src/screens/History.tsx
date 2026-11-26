import { useMemo, useState } from 'react';
import { actions, useStore } from '../lib/store';
import { dashboard, profit } from '../lib/stats';
import { dateShort, money, odds as fmtOdds, pct, signedMoney } from '../lib/format';
import { VERDICT_LABEL } from '../lib/method';
import type { Bet, BetResult, Verdict } from '../lib/types';
import { haptic } from '../lib/native';
import { VERDICT_COLOR } from '../components/MatchCard';
import { ask, NumberField, Segmented, Sheet, TextField, toast } from '../components/ui';
import { IconPlus, IconTrash } from '../components/Icons';
import { BetSheet } from './BetSheet';

type Filter = 'all' | 'pending' | 'real' | 'test';

export function History() {
  const bets = useStore((s) => s.bets);
  const s = useStore((st) => st.settings);
  const [filter, setFilter] = useState<Filter>('all');
  const [edit, setEdit] = useState<Bet | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const list = useMemo(
    () =>
      bets
        .filter((b) => (filter === 'pending' ? b.result === 'pending' : filter === 'real' ? !b.test : filter === 'test' ? b.test : true))
        .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)),
    [bets, filter],
  );
  const real = dashboard(bets, s, false);
  const test = dashboard(bets, s, true);
  const showTest = filter === 'test' || (filter !== 'real' && real.count === 0 && test.count > 0);
  const dv = showTest ? test : real;

  const setResult = (b: Bet, r: BetResult) => {
    if (r === 'won') haptic.success();
    else if (r === 'lost') haptic.error();
    else haptic.tap();
    actions.updateBet(b.id, { result: r, settledAt: r === 'pending' ? undefined : new Date().toISOString() });
  };

  return (
    <div className="stack">
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Tous' },
          { value: 'pending', label: 'En cours' },
          { value: 'real', label: 'Réels' },
          { value: 'test', label: 'Test' },
        ]}
      />

      <div className="card tight">
        <div className="row between small" style={{ marginBottom: 8 }}>
          <b>{showTest ? 'Paris fictifs (test)' : 'Paris réels'}</b>
          <span className="muted">
            {dv.settled} terminés · {dv.pending} en cours
          </span>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="v">{pct(dv.hitRate)}</div>
            <div className="l">Réussite</div>
          </div>
          <div className="kpi">
            <div className={`v ${dv.profit > 0 ? 'pos' : dv.profit < 0 ? 'neg' : ''}`}>{signedMoney(dv.profit).replace(',00', '')}</div>
            <div className="l">Bénéfice</div>
          </div>
          <div className="kpi">
            <div className="v">{pct(dv.breakEven, 1)}</div>
            <div className="l">Mini rentable</div>
          </div>
        </div>
        <div className="stack" style={{ gap: 6, marginTop: 12 }}>
          {(['GREEN', 'ORANGE', 'RED'] as Verdict[]).map((v) => {
            const x = dv.byVerdict[v];
            return (
              <div key={v} className="row small">
                <span style={{ width: 9, height: 9, borderRadius: 9, background: VERDICT_COLOR[v], boxShadow: `0 0 8px ${VERDICT_COLOR[v]}` }} />
                <span className="grow">{VERDICT_LABEL[v]}</span>
                <span className="muted">{x.n} pari(s)</span>
                <b style={{ width: 52, textAlign: 'right' }}>{pct(x.rate)}</b>
              </div>
            );
          })}
        </div>
      </div>

      <button className="btn block" onClick={() => setAddOpen(true)}>
        <IconPlus /> Ajouter un pari sans analyse
      </button>

      {list.length === 0 && (
        <div className="empty card">
          <span className="ball">⚽</span>
          {filter === 'pending' ? 'Aucun pari en attente de résultat.' : 'Aucun pari ici pour le moment.'}
        </div>
      )}

      {list.map((b) => (
        <div key={b.id} className="card bet-card match-card press" style={{ ['--stripe' as string]: b.verdict ? VERDICT_COLOR[b.verdict] : 'var(--line-2)' }}>
          <div onClick={() => setEdit(b)} role="button">
            <div className="league">
              <span className="ellipsis grow">
                {b.league || 'Match'} · {dateShort(b.date)}
              </span>
              {b.test && <span className="chip blue">Test</span>}
              {b.live && <span className="chip orange">Live</span>}
              {b.kind === 'combine' && <span className="chip red">Combiné</span>}
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 700, fontSize: 15.5 }}>{b.match}</div>
                <div className="small muted">
                  Mise {money(b.stake)} · {b.verdict ? VERDICT_LABEL[b.verdict] : 'Sans analyse'}
                  {b.score !== null ? ` (${b.score})` : ''}
                </div>
              </div>
              <span className="odds-tag">{fmtOdds(b.odds)}</span>
            </div>
          </div>
          {b.result === 'pending' ? (
            <div className="result-btns">
              <button className="won" onClick={() => setResult(b, 'won')}>✓ Gagné</button>
              <button className="lost" onClick={() => setResult(b, 'lost')}>✗ Perdu</button>
              <button onClick={() => setResult(b, 'void')}>Remboursé</button>
            </div>
          ) : (
            <div className="row between" style={{ marginTop: 8 }}>
              <span className={`chip ${b.result === 'won' ? 'green' : b.result === 'lost' ? 'red' : ''}`}>{b.result === 'won' ? 'Gagné' : b.result === 'lost' ? 'Perdu' : 'Remboursé'}</span>
              <b className={profit(b) > 0 ? 'pos' : profit(b) < 0 ? 'neg' : 'muted'}>{signedMoney(profit(b))}</b>
            </div>
          )}
        </div>
      ))}

      {edit && <EditBet bet={edit} onClose={() => setEdit(null)} />}
      {addOpen && <BetSheet open={addOpen} onClose={() => setAddOpen(false)} preset={{}} />}
    </div>
  );
}

function EditBet({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const [odds, setOdds] = useState<number | null>(bet.odds);
  const [stake, setStake] = useState<number | null>(bet.stake);
  const [result, setResult] = useState<BetResult>(bet.result);
  const [note, setNote] = useState(bet.note ?? '');
  const save = () => {
    if (!odds || odds <= 1 || !stake || stake <= 0) {
      toast('Cote ou mise invalide', 'warn');
      return;
    }
    actions.updateBet(bet.id, { odds, stake, result, note: note.trim() || undefined, settledAt: result === 'pending' ? undefined : bet.settledAt ?? new Date().toISOString() });
    haptic.success();
    toast('Pari modifié');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Modifier le pari">
      <div className="stack" style={{ gap: 12 }}>
        <div className="muted">{bet.match}</div>
        <div className="grid2">
          <NumberField label="Cote" value={odds} onChange={setOdds} />
          <NumberField label="Mise" value={stake} onChange={setStake} suffix="€" />
        </div>
        <div className="label">Résultat</div>
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
        <TextField label="Note" value={note} onChange={setNote} placeholder="Ex. but à la 88e" />
        <button className="btn primary block" onClick={save}>
          Enregistrer
        </button>
        <button
          className="btn danger block"
          onClick={async () => {
            if (await ask({ title: 'Supprimer ce pari ?', message: bet.match, confirm: 'Supprimer', tone: 'danger' })) {
              actions.deleteBet(bet.id);
              toast('Pari supprimé');
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
