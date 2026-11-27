import { useState } from 'react';
import { useStore } from '../lib/store';
import { computeValue, pinnacleProb, type ValueResult } from '../lib/value';
import { fixedStake, nextBetIsTest } from '../lib/stats';
import { money, odds as fmtOdds } from '../lib/format';
import { openUrl } from '../lib/native';
import { BigButton, Explain, Guide, NumberField, Segmented } from '../components/ui';
import { SaveBet, ValueGauge } from '../components/Value';
import { IconExternal } from '../components/Icons';

/** La calculatrice de value : ta cote + la cote Pinnacle (ou ton estimation) → ✅ ou ❌. */
export function Calc({ goBets }: { goBets: () => void }) {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const [mode, setMode] = useState<'pinnacle' | 'perso'>('pinnacle');
  const [odds, setOdds] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const [draw, setDraw] = useState<number | null>(null);
  const [fav, setFav] = useState<number | null>(null);
  const [est, setEst] = useState<number | null>(null);
  const [save, setSave] = useState(false);
  const stake = fixedStake(bets, s, nextBetIsTest(bets, s));

  let r: ValueResult | null = null;
  if (odds && odds > 1) {
    if (mode === 'pinnacle' && pin && pin > 1) {
      const t = pinnacleProb({ out: pin, draw, fav }, s.pinnacleMargin);
      if (t) r = computeValue(odds, t.p, t.source, s, '');
    } else if (mode === 'perso' && est && est > 0 && est < 100) {
      r = computeValue(odds, est / 100, 'perso', s, '');
    }
  }

  return (
    <div className="stack">
      <Guide
        steps={[
          <>Tape la cote de l'outsider dans <b>ton appli</b> (Winamax, Unibet…).</>,
          mode === 'pinnacle' ? <>Tape la cote <b>Pinnacle</b> de la même équipe (OddsPortal l'affiche).</> : <>Tape <b>ta propre estimation</b> de ses chances, en %.</>,
          <>L'app te dit tout de suite : <b>✅ bonne affaire</b> ou <b>❌ piège</b>.</>,
        ]}
      />
      <NumberField label="Cote dans ton appli" value={odds} onChange={setOdds} placeholder="Ex. 8,40" />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'pinnacle', label: 'Avec Pinnacle' },
          { value: 'perso', label: 'Mon estimation' },
        ]}
      />
      {mode === 'pinnacle' ? (
        <>
          <NumberField label="Cote Pinnacle de la même équipe" value={pin} onChange={setPin} placeholder="Ex. 7,00" />
          <Explain q="Plus précis : taper les 3 cotes Pinnacle">
            Avec les 3 cotes (outsider, nul, favori), l'app retire exactement la marge de Pinnacle.
            <div className="grid2" style={{ marginTop: 8 }}>
              <NumberField label="Cote du nul" value={draw} onChange={setDraw} />
              <NumberField label="Cote du favori" value={fav} onChange={setFav} />
            </div>
          </Explain>
          <button className="btn small block" onClick={() => openUrl('https://www.oddsportal.com/')}>
            Ouvrir OddsPortal (cotes Pinnacle) <IconExternal />
          </button>
        </>
      ) : (
        <NumberField label="Ses vraies chances de gagner, selon toi" value={est} onChange={setEst} suffix="%" placeholder="Ex. 17" min={0} max={100} />
      )}

      {r ? (
        <>
          <div className="card">
            <ValueGauge r={r} />
            <p className="small" style={{ margin: '12px 0 0' }}>{r.sentence}</p>
            {!r.isOutsider && <p className="tiny faint" style={{ margin: '6px 0 0' }}>Cote sous {fmtOdds(s.minOdds)} : ce n'est pas vraiment un outsider, mais le calcul reste juste.</p>}
          </div>
          {r.verdict === 'OK' ? (
            <>
              <Guide steps={[<>Mise <b>{money(stake)}</b> (ta mise fixe), en pari <b>simple</b>.</>, <>Puis touche <b>« J'ai parié »</b> pour le noter.</>]} />
              <BigButton title="J'ai parié" sub={`${money(stake)} à ${fmtOdds(odds)}`} onClick={() => setSave(true)} />
            </>
          ) : (
            <Guide tone={r.verdict === 'BOF' ? 'orange' : 'red'} title="Ce que tu fais" steps={[<>On <b>ne parie pas</b>.</>, <>Ça devient une bonne affaire à partir d'une cote de <b>{fmtOdds(r.minOdds)}</b>.</>]} />
          )}
        </>
      ) : (
        <div className="empty card">
          <span className="ball">🧮</span>
          Tape les cotes : le résultat s'affiche ici.
        </div>
      )}
      {save && r && <SaveBet preset={{ match: '', pick: '', odds, result: r }} onClose={() => setSave(false)} onSaved={goBets} />}
    </div>
  );
}
