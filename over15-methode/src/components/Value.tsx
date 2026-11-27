import { useState } from 'react';
import { actions, useStore } from '../lib/store';
import { todayISO, uid } from '../lib/defaults';
import { fixedStake, nextBetIsTest, testCount, weekStatus } from '../lib/stats';
import { money, odds as fmtOdds } from '../lib/format';
import { SOURCE_LABEL, signedPct, VERDICT_COLOR, VERDICT_WORD, type ValueResult } from '../lib/value';
import { haptic } from '../lib/native';
import { ask, Banner, Guide, NumberField, Segmented, Sheet, TextField, toast } from './ui';

const p1 = (x: number) => `${(x * 100).toFixed(1).replace('.', ',').replace(',0', '')} %`;

/** Le graphique « chance du bookmaker » contre « vraie chance », avec le verdict. */
export function ValueGauge({ r, compact }: { r: ValueResult; compact?: boolean }) {
  const max = Math.max(r.bookProb, r.trueProb, 0.05) * 1.15;
  const color = VERDICT_COLOR[r.verdict];
  return (
    <div className="value-gauge">
      <div className="vg-row">
        <span className="vg-label">Chance selon ta cote</span>
        <div className="vg-track">
          <div className="vg-bar book" style={{ width: `${(r.bookProb / max) * 100}%` }} />
        </div>
        <b className="vg-val">{p1(r.bookProb)}</b>
      </div>
      <div className="vg-row">
        <span className="vg-label">Vraie chance</span>
        <div className="vg-track">
          <div className="vg-bar" style={{ width: `${(r.trueProb / max) * 100}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
        </div>
        <b className="vg-val" style={{ color }}>{p1(r.trueProb)}</b>
      </div>
      {!compact && (
        <div className="center" style={{ marginTop: 12 }}>
          <div className="vg-verdict" style={{ color, textShadow: `0 0 22px ${color}` }}>
            {r.verdict === 'OK' ? '✅' : r.verdict === 'BOF' ? '➖' : '❌'} {VERDICT_WORD[r.verdict]}
          </div>
          <div className="small" style={{ marginTop: 4 }}>
            Value : <b style={{ color }}>{signedPct(r.value)}</b> · vraie chance : {SOURCE_LABEL[r.source]}
          </div>
        </div>
      )}
    </div>
  );
}

/** Petit graphique en anneau : gagnés (vert) / perdus (rouge), % au centre. */
export function Donut({ won, lost, size = 150 }: { won: number; lost: number; size?: number }) {
  const n = won + lost;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const part = n ? won / n : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={n ? 'var(--red)' : 'rgba(255,255,255,.08)'} strokeOpacity={n ? 0.85 : 1} strokeWidth="16" />
        {n > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--green)" strokeWidth="16" strokeDasharray={`${c * part} ${c}`} style={{ filter: 'drop-shadow(0 0 6px var(--green))' }} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center' }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 38, lineHeight: 1 }}>{n ? `${Math.round(part * 100)} %` : '—'}</div>
        <div className="tiny muted">de réussite</div>
      </div>
    </div>
  );
}

export interface SavePreset {
  match: string;
  league?: string;
  pick: string;
  odds: number | null;
  result: ValueResult | null;
  date?: string;
}

/** « J'ai parié » : enregistre le pari, avec les garde-fous (simple uniquement, mise fixe, limite par semaine, entraînement). */
export function SaveBet({ preset, onClose, onSaved }: { preset: SavePreset; onClose: () => void; onSaved?: () => void }) {
  const bets = useStore((st) => st.bets);
  const s = useStore((st) => st.settings);
  const test = nextBetIsTest(bets, s);
  const fixed = fixedStake(bets, s, test);
  const [match, setMatch] = useState(preset.match);
  const [pick, setPick] = useState(preset.pick);
  const [odds, setOdds] = useState<number | null>(preset.odds);
  const [stake, setStake] = useState<number | null>(fixed);
  const [kind, setKind] = useState<'simple' | 'combine'>('simple');
  const week = weekStatus(bets, s);
  const blocked = !test && week.reached;
  const tc = testCount(bets);

  const save = async () => {
    if (!match.trim() || !odds || odds <= 1 || !stake || stake <= 0) return toast('Écris le match, la cote et la mise', 'warn');
    if (blocked) return toast('Limite de pertes de la semaine atteinte', 'err');
    if (kind === 'combine') {
      const go = await ask({ title: 'Combiné : déconseillé', message: 'Un outsider gagne rarement : en combiné, tu perds presque toujours. Reste en pari SIMPLE.', confirm: 'Enregistrer quand même', cancel: 'Revenir en simple', tone: 'danger' });
      if (!go) return setKind('simple');
    }
    if (preset.result && preset.result.verdict === 'NON') {
      const go = await ask({ title: 'La cote est un piège', message: 'L\'app a calculé qu\'il n\'y a pas de value sur ce pari. Tu veux vraiment le jouer ?', confirm: 'Oui, je le joue', cancel: 'Non, je passe', tone: 'danger' });
      if (!go) return;
    }
    if (!test && stake > fixed * 1.05 + 0.01) {
      const go = await ask({ title: 'Mise plus grosse que ta mise fixe', message: `Ta mise fixe est de ${money(fixed)}. Avec les outsiders, on perd souvent plusieurs fois de suite : garde toujours la même mise.`, confirm: 'Garder ma mise', cancel: `Revenir à ${money(fixed)}` });
      if (!go) return setStake(fixed);
    }
    const [home, away] = match.split(/\s+[-–]\s+/);
    actions.addBet({
      id: uid(),
      createdAt: new Date().toISOString(),
      date: preset.date ?? todayISO(),
      match: match.trim(),
      home: home ?? match,
      away: away ?? '',
      league: preset.league ?? '',
      pick: pick.trim(),
      odds,
      stake,
      kind,
      live: false,
      test,
      verdict: preset.result?.verdict ?? null,
      score: null,
      result: 'pending',
      pTrue: preset.result?.trueProb ?? null,
      value: preset.result ? preset.result.trueProb * odds - 1 : null,
      source: preset.result?.source ?? null,
    });
    haptic.success();
    toast(test ? `Pari pour de faux noté (${tc + 1}/${s.testBetsTarget})` : 'Pari enregistré ✓');
    onSaved?.();
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="J'ai parié" top>
      <div className="stack">
        <Guide
          steps={[
            <>Vérifie le match, le pari et la cote <b>que tu as vraiment prise</b>.</>,
            <>Touche <b>Enregistrer</b>. Quand le match est fini, l'app pourra demander le résultat à Claude.</>,
          ]}
        />
        <TextField label="Match" value={match} onChange={setMatch} placeholder="Ex. Al Feiha – Al Hilal" />
        <TextField label="Mon pari" value={pick} onChange={setPick} placeholder="Ex. Victoire de Al Feiha" />
        <div className="grid2">
          <NumberField label="Cote prise" value={odds} onChange={setOdds} />
          <NumberField label={`Mise (fixe : ${money(fixed)})`} value={stake} onChange={setStake} suffix="€" />
        </div>
        {odds && stake ? <div className="small muted">Si ça passe : <b style={{ color: 'var(--green)' }}>+{money(stake * (odds - 1))}</b> · cote {fmtOdds(odds)}</div> : null}
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'combine', label: 'Combiné' },
          ]}
        />
        {kind === 'combine' && <Banner tone="red">Paris <b>SIMPLES</b> uniquement : avec des outsiders, un combiné perd presque toujours.</Banner>}
        {test && <Banner tone="blue">Entraînement : ce pari est noté <b>pour de faux</b> ({tc + 1}/{s.testBetsTarget}). Ne mise pas d'argent pour de vrai.</Banner>}
        {blocked && <Banner tone="red">Limite de pertes de la semaine atteinte ({money(week.loss)} / {money(week.limit)}). Pas de pari pour de vrai avant lundi.</Banner>}
        <button className="btn primary block" disabled={blocked} onClick={save}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}
