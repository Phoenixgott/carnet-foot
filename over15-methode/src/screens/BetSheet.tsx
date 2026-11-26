import { useState } from 'react';
import { actions, useStore } from '../lib/store';
import { todayISO, uid } from '../lib/defaults';
import { fixedStake, nextBetIsTest, testCount, weekStatus } from '../lib/stats';
import { money, odds as fmtOdds } from '../lib/format';
import { VERDICT_LABEL } from '../lib/method';
import type { Bet, Verdict } from '../lib/types';
import { haptic } from '../lib/native';
import { ask, Banner, NumberField, Segmented, Sheet, TextField, toast, ToggleRow } from '../components/ui';
import { IconBolt, IconFlask } from '../components/Icons';

export interface BetPreset {
  date?: string;
  home?: string;
  away?: string;
  league?: string;
  odds?: number | null;
  verdict?: Verdict | null;
  score?: number | null;
}

/** Enregistrement d'un pari, avec les garde-fous de la méthode. */
export function BetSheet({ open, onClose, preset, onSaved }: { open: boolean; onClose: () => void; preset: BetPreset; onSaved?: () => void }) {
  const bets = useStore((s) => s.bets);
  const s = useStore((st) => st.settings);
  const defaultTest = nextBetIsTest(bets, s);
  const [test, setTest] = useState(defaultTest);
  const [home, setHome] = useState(preset.home ?? '');
  const [away, setAway] = useState(preset.away ?? '');
  const [league, setLeague] = useState(preset.league ?? '');
  const [date, setDate] = useState(preset.date ?? todayISO());
  const [odds, setOdds] = useState<number | null>(preset.odds ?? null);
  const fixed = fixedStake(bets, s, test);
  const [stake, setStake] = useState<number | null>(fixed);
  const [kind, setKind] = useState<'simple' | 'combine'>('simple');
  const [live, setLive] = useState(false);
  const week = weekStatus(bets, s);
  const tc = testCount(bets);
  const trainingOver = s.testMode && tc >= s.testBetsTarget;
  const blockedByLimit = !test && week.reached;
  const overStake = stake !== null && stake > fixed * 1.05 + 0.01;
  const valid = home.trim() && away.trim() && odds !== null && odds > 1 && stake !== null && stake > 0;

  const switchTest = (v: boolean) => {
    setTest(v);
    setStake(fixedStake(bets, s, v));
  };

  const save = async () => {
    if (!valid) {
      haptic.warning();
      toast('Complète le match, la cote et la mise', 'warn');
      return;
    }
    if (blockedByLimit) {
      haptic.error();
      toast('Limite de pertes de la semaine atteinte', 'err');
      return;
    }
    if (kind === 'combine') {
      haptic.warning();
      const go = await ask({
        title: 'Combiné : hors méthode',
        message: 'La méthode, c\'est des paris SIMPLES uniquement. Un combiné multiplie les risques : il suffit d\'un match raté pour tout perdre. Tu veux vraiment l\'enregistrer ?',
        confirm: 'Enregistrer quand même',
        cancel: 'Revenir en simple',
        tone: 'danger',
      });
      if (!go) {
        setKind('simple');
        return;
      }
    }
    if (live) {
      const go = await ask({
        title: 'Pari en live',
        message: 'Déconseillé si tu t\'emportes facilement. Le live pousse à miser sous le coup de l\'émotion. Garde ta mise fixe.',
        confirm: 'Je garde la tête froide',
        cancel: 'Annuler',
      });
      if (!go) return;
    }
    if (preset.verdict === 'RED') {
      const go = await ask({
        title: 'Verdict : NE PAS PARIER',
        message: 'L\'application déconseille ce pari. Tu peux l\'enregistrer pour le suivi, mais la méthode dit de passer.',
        confirm: 'Enregistrer malgré tout',
        cancel: 'Je passe',
        tone: 'danger',
      });
      if (!go) return;
    }
    if (!test && overStake) {
      const go = await ask({ title: 'Mise au-dessus de ta mise fixe', message: `Ta mise fixe est de ${money(fixed)} (${s.stakePct} % de ta bankroll). Augmenter la mise après une série, c'est le piège classique.`, confirm: 'Garder ma mise', cancel: `Revenir à ${money(fixed)}` });
      if (!go) {
        setStake(fixed);
        return;
      }
    }
    const bet: Bet = {
      id: uid(),
      createdAt: new Date().toISOString(),
      date,
      match: `${home.trim()} – ${away.trim()}`,
      home: home.trim(),
      away: away.trim(),
      league: league.trim(),
      odds: odds!,
      stake: stake!,
      kind,
      live,
      test,
      verdict: preset.verdict ?? null,
      score: preset.score ?? null,
      result: 'pending',
    };
    actions.addBet(bet);
    haptic.success();
    toast(test ? `Pari fictif enregistré (${Math.min(tc + 1, s.testBetsTarget)}/${s.testBetsTarget})` : 'Pari enregistré');
    onSaved?.();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Enregistrer le pari">
      <div className="stack" style={{ gap: 12 }}>
        {preset.verdict && (
          <div className="row small">
            <span className={`chip ${preset.verdict === 'GREEN' ? 'green' : preset.verdict === 'ORANGE' ? 'orange' : 'red'}`}>{VERDICT_LABEL[preset.verdict]}</span>
            {preset.score !== null && preset.score !== undefined && <span className="muted">Score {preset.score}/100</span>}
          </div>
        )}
        <div className="grid2">
          <TextField label="Domicile" value={home} onChange={setHome} />
          <TextField label="Extérieur" value={away} onChange={setAway} />
        </div>
        <div className="grid2">
          <TextField label="Championnat" value={league} onChange={setLeague} />
          <div className="field">
            <label>Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid2">
          <NumberField label="Cote +1.5" value={odds} onChange={setOdds} min={1.01} />
          <NumberField label={`Mise (fixe : ${money(fixed)})`} value={stake} onChange={setStake} suffix="€" min={0} />
        </div>
        {odds !== null && stake !== null && odds > 1 && <div className="small muted">Gain potentiel : <b style={{ color: 'var(--green)' }}>+{money(stake * (odds - 1))}</b> · cote {fmtOdds(odds)}</div>}

        <div className="label">Type de pari</div>
        <Segmented
          value={kind}
          onChange={(v) => {
            setKind(v);
            if (v === 'combine') haptic.warning();
          }}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'combine', label: 'Combiné' },
          ]}
        />
        {kind === 'combine' && <Banner tone="red">Paris en <b>SIMPLE uniquement</b> : un combiné n'est pas dans la méthode.</Banner>}

        <div className="card tight" style={{ padding: '2px 14px' }}>
          <ToggleRow
            title="Pari en live"
            desc={<span className="row" style={{ gap: 5 }}><IconBolt size={14} /> Pendant le match</span>}
            on={live}
            onChange={(v) => {
              setLive(v);
              if (v) haptic.warning();
            }}
          />
          <ToggleRow title="Pari fictif (mode TEST)" desc={<span className="row" style={{ gap: 5 }}><IconFlask size={14} /> N'affecte pas ta bankroll réelle</span>} on={test} onChange={switchTest} />
        </div>
        {live && <Banner tone="orange">Pari live : <b>déconseillé si tu t'emportes facilement.</b></Banner>}

        {test ? (
          <Banner tone="blue">
            {s.testMode && tc < s.testBetsTarget ? (
              <>Entraînement : pari fictif <b>{tc + 1}/{s.testBetsTarget}</b>. Steven conseille de s'entraîner avant de miser pour de vrai.</>
            ) : (
              <>Pari fictif : il est suivi à part, sur une bankroll d'entraînement.</>
            )}
          </Banner>
        ) : trainingOver || !s.testMode ? (
          <Banner tone="green">Pari <b>réel</b> : mise fixe de {s.stakePct} % de ta bankroll.</Banner>
        ) : (
          <Banner tone="orange">Tu enregistres un pari <b>réel</b> alors que ton entraînement n'est pas terminé ({tc}/{s.testBetsTarget}).</Banner>
        )}
        {!test && overStake && <Banner tone="orange">Mise supérieure à ta mise fixe de {money(fixed)}.</Banner>}
        {blockedByLimit && (
          <Banner tone="red">
            <b>Limite de pertes atteinte</b> cette semaine ({money(week.loss)} / {money(week.limit)}). Pas de pari réel avant lundi : tu peux continuer en fictif.
          </Banner>
        )}

        <button className="btn primary block" disabled={blockedByLimit} onClick={save}>
          {test ? 'Enregistrer le pari fictif' : 'Enregistrer le pari'}
        </button>
        <button className="btn ghost block" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Sheet>
  );
}
