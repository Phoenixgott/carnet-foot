import { useState } from 'react';
import { doublesCount, evaluateSystem, FIRST_ODDS, minOddsWithKGood, minSecondOdds, refundChance, refundZones, requiredGood } from '../lib/systeme';
import { money, odds as fmtOdds, parseNum, signedMoney } from '../lib/format';
import { haptic } from '../lib/native';
import { Coach } from '../components/Coach';
import { Explain } from '../components/ui';
import { SystemVideo } from '../components/Videos';

const STAKES = [0.1, 0.2, 0.5, 1];

/** « Système de doubles » : le tableau des cotes minimum pour être remboursé, et un vérificateur. */
export function System() {
  const [n, setN] = useState(6);
  const [stake, setStake] = useState(0.2);
  const doubles = doublesCount(n);
  const same = minOddsWithKGood(n, 2);

  return (
    <div className="stack">
      <Coach>Tu joues tous les doubles entre tes matchs. Je te dis quelles cotes il faut pour être <b>remboursé</b>.</Coach>

      <div className="card stack" style={{ gap: 10 }}>
        <b>Combien de matchs ?</b>
        <div className="row wrap" style={{ gap: 8 }}>
          {[3, 4, 5, 6, 7, 8].map((k) => (
            <button key={k} className={`choice-chip ${n === k ? 'on' : ''}`} onClick={() => { haptic.tap(); setN(k); }}>
              {k}
            </button>
          ))}
        </div>
        <b>Mise par double</b>
        <div className="row wrap" style={{ gap: 8 }}>
          {STAKES.map((v) => (
            <button key={v} className={`choice-chip ${stake === v ? 'on' : ''}`} onClick={() => { haptic.tap(); setStake(v); }}>
              {money(v).replace(',00', '')}
            </button>
          ))}
        </div>
        <div className="small muted">
          {n} matchs = <b style={{ color: 'var(--text)' }}>{doubles} doubles</b> · mise totale <b style={{ color: 'var(--text)' }}>{money(doubles * stake)}</b>
        </div>
      </div>

      <BestOdds n={n} />

      <div className="card center">
        <div className="small" style={{ fontWeight: 800 }}>Avec 2 bons pronostics, chaque match gagnant doit avoir une cote d'environ</div>
        <div style={{ fontWeight: 800, fontSize: 48, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{fmtOdds(same)}</div>
        <div className="small" style={{ fontWeight: 800 }}>minimum pour que tu sois remboursé (si les deux cotes sont proches).</div>
        <div className="tiny muted" style={{ marginTop: 6 }}>Ce minimum est le même quelle que soit ta mise par double (0,10 €, 0,20 €, 0,50 € ou 1 €).</div>
      </div>

      <div className="section-title">Si les deux cotes sont différentes</div>
      <table className="sys-table">
        <thead>
          <tr>
            <th>Cote du 1er match</th>
            <th>Cote minimum du 2e</th>
          </tr>
        </thead>
        <tbody>
          {FIRST_ODDS.map((o) => (
            <tr key={o}>
              <td>{fmtOdds(o)}</td>
              <td>{fmtOdds(minSecondOdds(n, o))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">Si tu as plus de 2 bons pronostics</div>
      <div className="card stack" style={{ gap: 8 }}>
        {Array.from({ length: n - 2 }, (_, i) => i + 3).map((k) => (
          <div key={k} className="row between">
            <span>
              Avec <b>{k} bons</b>
            </span>
            <span>
              environ <b style={{ fontSize: 19 }}>{fmtOdds(minOddsWithKGood(n, k))}</b> par match
            </span>
          </div>
        ))}
      </div>

      <Explain q="Comment c'est calculé ?">
        Avec {n} matchs, tu joues {doubles} doubles. Si seulement 2 matchs sont gagnés, un seul double rapporte : mise × cote 1 × cote 2. Pour récupérer ta mise totale, il faut donc cote 1 × cote 2 ≥ {doubles}. Exemple : 3,00 × 5,00 = 15.
        <div style={{ marginTop: 10 }}>
          <SystemVideo />
        </div>
      </Explain>

      <Checker n={n} stake={stake} />

      <div className="tiny faint center">Un système, c'est plusieurs combinés : la marge du bookmaker compte plusieurs fois. Garde de petites mises.</div>
    </div>
  );
}

const pc = (x: number) => `~${Math.round(x * 100)} %`;

/** « Quelle cote prendre sur chaque match ? » : les zones qui maximisent la chance d'être remboursé. */
function BestOdds({ n }: { n: number }) {
  const z = refundZones(n);
  const [test, setTest] = useState('');
  const t = parseNum(test);
  return (
    <>
      <div className="section-title">Quelle cote prendre sur chaque match ?</div>
      <Coach mood="think">
        Il n'existe pas de cote parfaite, mais il y a {z.best.length} zone{z.best.length > 1 ? 's' : ''} qui maximisent tes chances d'être au moins remboursé. Prends la <b>même cote, ou presque</b>, sur tes {n} matchs.
      </Coach>
      <table className="sys-table">
        <thead>
          <tr>
            <th>Cote sur chaque match</th>
            <th>Il te faut</th>
            <th>Chance d'être remboursé</th>
          </tr>
        </thead>
        <tbody>
          {z.best.map((b) => (
            <tr key={b.good}>
              <td>
                {fmtOdds(b.from)} à {fmtOdds(b.to)}
              </td>
              <td style={{ color: 'var(--text)' }}>
                {b.good} bons sur {n}
              </td>
              <td style={{ color: 'var(--green-d)' }}>{pc(b.chance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(z.avoid.length > 0 || z.above > 0) && (
        <div className="card stack" style={{ gap: 8, background: 'var(--red-soft)', borderColor: '#f8c4c4', boxShadow: '0 3px 0 #f8c4c4' }}>
          <b>🚫 Les zones à éviter</b>
          {z.avoid.map((a) => (
            <div key={a.from} className="small">
              <b>
                {fmtOdds(a.from)} à {fmtOdds(a.to)}
              </b>{' '}
              : il te faut quand même {a.good} bons, mais chaque match passe moins souvent. Tu tombes à {Math.round(a.chanceTo * 100)}–{Math.round(a.chanceFrom * 100)} % de chances.
            </div>
          ))}
          {z.above > 0 && (
            <div className="small">
              <b>Plus de {fmtOdds(z.above)}</b> : il faut toujours 2 bons, de plus en plus rares ({Math.round(refundChance(n, z.above + 1) * 100)} % à {fmtOdds(z.above + 1)}).
            </div>
          )}
        </div>
      )}
      <div className="card stack" style={{ gap: 8 }}>
        <b>🧪 Teste une cote</b>
        <input className="input" inputMode="decimal" placeholder="Ex. 2,30" value={test} onChange={(e) => setTest(e.target.value.replace(/[^\d.,]/g, ''))} />
        {t && t > 1 ? (
          <div style={{ fontWeight: 800 }}>
            À {fmtOdds(t)} sur chaque match : il te faut <b>{requiredGood(n, t)} bons sur {n}</b>, soit environ{' '}
            <b style={{ color: refundChance(n, t) >= 0.4 ? 'var(--green-d)' : 'var(--red-d)' }}>{Math.round(refundChance(n, t) * 100)} %</b> de chances d'être remboursé.
          </div>
        ) : (
          <div className="tiny faint">Tape une cote : je te dis combien de bons il faut et ta chance d'être remboursé.</div>
        )}
      </div>
      <div className="tiny faint">Chances estimées avec 1 ÷ cote, marge du bookmaker (5 %) retirée. Ce sont des estimations.</div>
    </>
  );
}

function Checker({ n, stake }: { n: number; stake: number }) {
  const [odds, setOdds] = useState<(number | null)[]>(Array(8).fill(null));
  const [text, setText] = useState<string[]>(Array(8).fill(''));
  const [won, setWon] = useState<(boolean | null)[]>(Array(8).fill(null));
  const ready = odds.slice(0, n).every((o) => o && o > 1) && won.slice(0, n).every((w) => w !== null);
  const res = ready ? evaluateSystem(odds.slice(0, n) as number[], won.slice(0, n) as boolean[], stake) : null;

  return (
    <>
      <div className="section-title">Vérifier mon système</div>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="small muted">Tape la cote de chaque match, puis touche ✅ ou ❌.</div>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="sys-match">
            <b className="muted">{i + 1}</b>
            <input
              className="input"
              inputMode="decimal"
              placeholder="Cote"
              value={text[i]}
              onChange={(e) => {
                const t = e.target.value.replace(/[^\d.,]/g, '');
                setText(text.map((x, j) => (j === i ? t : x)));
                setOdds(odds.map((x, j) => (j === i ? parseNum(t) : x)));
              }}
            />
            <button
              className={`sys-toggle ${won[i] === true ? 'won' : won[i] === false ? 'lost' : ''}`}
              onClick={() => {
                haptic.tap();
                setWon(won.map((x, j) => (j === i ? (x === null ? true : x ? false : null) : x)));
              }}
            >
              {won[i] === true ? '✅ Gagné' : won[i] === false ? '❌ Perdu' : '?'}
            </button>
          </div>
        ))}
        {res ? (
          <div className="center" style={{ marginTop: 6 }}>
            <span className={`stamp ${res.refunded ? 'OK' : 'NON'}`}>{res.refunded ? (res.profit > 0 ? '✅ GAGNANT' : '✅ REMBOURSÉ') : '❌ PAS REMBOURSÉ'}</span>
            <div style={{ marginTop: 10, fontWeight: 800 }}>
              {res.winningDoubles} double(s) gagnant(s) sur {res.doubles} · tu récupères {money(res.payout)} pour {money(res.totalStake)}
            </div>
            <div style={{ fontWeight: 900, fontSize: 28, color: res.profit >= 0 ? 'var(--green-d)' : 'var(--red-d)' }}>{signedMoney(res.profit)}</div>
          </div>
        ) : (
          <div className="tiny faint center">Le résultat s'affiche quand tout est rempli.</div>
        )}
        <button
          className="btn ghost small"
          onClick={() => {
            setOdds(Array(8).fill(null));
            setText(Array(8).fill(''));
            setWon(Array(8).fill(null));
          }}
        >
          Tout effacer
        </button>
      </div>
    </>
  );
}
