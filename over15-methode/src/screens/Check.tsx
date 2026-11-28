import { useState } from 'react';
import { useStore } from '../lib/store';
import { computeValue, pinnacleProb, signedPct, type ValueResult } from '../lib/value';
import { fixedStake, nextBetIsTest } from '../lib/stats';
import { fmtInput, money, odds as fmtOdds, parseNum } from '../lib/format';
import { haptic, openUrl } from '../lib/native';
import { Coach } from '../components/Coach';
import { BigButton } from '../components/ui';
import { SaveBet, ValueGauge } from '../components/Value';

const EMOJI = { OK: '✅', BOF: '➖', NON: '❌' } as const;
const WORD = { OK: 'BONNE AFFAIRE', BOF: 'BOF', NON: 'PIÈGE' } as const;

function BigNumber({ value, onChange, placeholder, suffix }: { value: number | null; onChange: (v: number | null) => void; placeholder: string; suffix?: string }) {
  const [text, setText] = useState(fmtInput(value));
  return (
    <div className="input-suffix">
      <input
        className="input huge"
        inputMode="decimal"
        autoFocus
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, '');
          setText(t);
          onChange(parseNum(t));
        }}
      />
      {suffix && <span style={{ fontSize: 26 }}>{suffix}</span>}
    </div>
  );
}

/** « Vérifier » : 2 questions, une réponse. */
export function Check({ goBets }: { goBets: () => void }) {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const [step, setStep] = useState(0);
  const [odds, setOdds] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const [est, setEst] = useState<number | null>(null);
  const [mode, setMode] = useState<'pinnacle' | 'perso'>('pinnacle');
  const [save, setSave] = useState(false);
  const stake = fixedStake(bets, s, nextBetIsTest(bets, s));

  let r: ValueResult | null = null;
  if (odds && odds > 1) {
    if (mode === 'pinnacle' && pin && pin > 1) {
      const t = pinnacleProb({ out: pin, draw: null, fav: null }, s.pinnacleMargin);
      if (t) r = computeValue(odds, t.p, t.source, s, '');
    } else if (mode === 'perso' && est && est > 0 && est < 100) r = computeValue(odds, est / 100, 'perso', s, '');
  }

  const restart = () => {
    setStep(0);
    setOdds(null);
    setPin(null);
    setEst(null);
    setMode('pinnacle');
  };

  return (
    <div className="stack">
      <div className="dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="stack step-anim">
          <Coach>Quelle est la <b>cote</b> dans ton appli de paris ?</Coach>
          <BigNumber value={odds} onChange={setOdds} placeholder="8,40" />
          <BigButton icon="➡️" title="Continuer" onClick={() => { haptic.tap(); setStep(1); }} tone="primary" disabled={!odds || odds <= 1} />
        </div>
      )}

      {step === 1 && mode === 'pinnacle' && (
        <div className="stack step-anim">
          <Coach mood="think">
            Et chez <b>Pinnacle</b>, quelle est la cote de la même équipe ? (c'est le bookmaker le plus juste)
          </Coach>
          <BigNumber value={pin} onChange={setPin} placeholder="7,00" />
          <BigButton icon="➡️" title="Voir le résultat" onClick={() => { haptic.medium(); setStep(2); }} tone="primary" disabled={!pin || pin <= 1} />
          <button className="btn block" onClick={() => openUrl('https://www.oddsportal.com/')}>
            🔎 Trouver la cote Pinnacle
          </button>
          <button className="btn ghost block" onClick={() => setMode('perso')}>
            Je ne la trouve pas
          </button>
        </div>
      )}

      {step === 1 && mode === 'perso' && (
        <div className="stack step-anim">
          <Coach mood="think">D'accord ! Selon toi, combien de chances sur 100 a cette équipe de gagner ?</Coach>
          <BigNumber value={est} onChange={setEst} placeholder="15" suffix="%" />
          <BigButton icon="➡️" title="Voir le résultat" onClick={() => { haptic.medium(); setStep(2); }} tone="primary" disabled={!est || est <= 0 || est >= 100} />
          <button className="btn ghost block" onClick={() => setMode('pinnacle')}>
            Finalement, j'ai la cote Pinnacle
          </button>
        </div>
      )}

      {step === 2 && r && (
        <div className="stack step-anim">
          <div className="center">
            <span className={`stamp ${r.verdict}`}>
              {EMOJI[r.verdict]} {WORD[r.verdict]}
            </span>
          </div>
          <div className="card">
            <ValueGauge r={r} compact />
            <div className="center small" style={{ marginTop: 10 }}>
              Value : <b>{signedPct(r.value)}</b>
            </div>
          </div>
          {r.verdict === 'OK' ? (
            <>
              <Coach mood="wow">
                La cote est trop généreuse : c'est une bonne affaire ! Mise <b>{money(stake)}</b>, en pari simple.
              </Coach>
              <BigButton icon="💶" title="J'ai parié" sub={`${money(stake)} à ${fmtOdds(odds)}`} onClick={() => setSave(true)} tone="primary" />
            </>
          ) : (
            <Coach mood="sad">
              {r.verdict === 'BOF' ? 'Presque, mais pas assez.' : 'C\'est un piège.'} On ne parie pas. Ça devient bon à partir d'une cote de <b>{fmtOdds(r.minOdds)}</b>.
            </Coach>
          )}
          <BigButton icon="🔁" title="Vérifier une autre cote" onClick={restart} tone="plain" />
        </div>
      )}
      {save && r && <SaveBet preset={{ match: '', pick: '', odds, result: r }} onClose={() => setSave(false)} onSaved={goBets} />}
    </div>
  );
}
