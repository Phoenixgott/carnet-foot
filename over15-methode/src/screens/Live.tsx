import { useEffect, useRef, useState } from 'react';
import { actions, getState, useStore } from '../lib/store';
import { todayISO, uid } from '../lib/defaults';
import { chanceOver15, hedgedPnl, hedgePlan, minOddsAt } from '../lib/method';
import { fixedStake, nextBetIsTest, profit, testCount, weekStatus } from '../lib/stats';
import { money, odds as fmtOdds, pct, signedMoney } from '../lib/format';
import type { Bet, LiveSession } from '../lib/types';
import { haptic } from '../lib/native';
import { ask, Banner, BigButton, Explain, Guide, NumberField, Stepper, TextField, toast } from '../components/ui';
import { IconPlay } from '../components/Icons';

function minuteOf(live: LiveSession, now: number): number {
  if (!live.kickoffAt) return 0;
  return Math.max(0, Math.floor((now - live.kickoffAt) / 60000));
}

export function Live({ goMatches, goBets }: { goMatches: () => void; goBets: () => void }) {
  const live = useStore((st) => st.live);
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const [now, setNow] = useState(Date.now());
  const vibrated = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const minute = live ? minuteOf(live, now) : 0;
  useEffect(() => {
    if (live?.stage === 'chrono' && minute >= s.entryFrom && !vibrated.current) {
      vibrated.current = true;
      haptic.warning();
    }
  }, [live?.stage, minute, s.entryFrom]);

  if (!live) return <NoLive goMatches={goMatches} />;

  const bet = live.betId ? bets.find((b) => b.id === live.betId) ?? null : null;
  const end = (text: string) => actions.updateLive({ stage: 'fini', endText: text });

  return (
    <div className="stack">
      <div className="card tight row">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tiny muted ellipsis" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{live.competition}</div>
          <div className="ellipsis" style={{ fontWeight: 800, fontSize: 17 }}>{live.label}</div>
        </div>
        {live.verdict && <span className={`dot ${live.verdict}`} />}
      </div>

      {live.stage === 'attente' && <Attente live={live} />}
      {live.stage === 'chrono' && <Chrono live={live} minute={minute} end={end} />}
      {live.stage === 'parie' && bet && <Parie bet={bet} minute={minute} />}
      {live.stage === 'but' && bet && <But bet={bet} />}
      {live.stage === 'fini' && (
        <Fini
          text={live.endText ?? ''}
          bet={bet}
          onDone={() => {
            actions.setLive(null);
            goMatches();
          }}
          goBets={() => {
            actions.setLive(null);
            goBets();
          }}
        />
      )}

      {live.stage !== 'fini' && (
        <button
          className="btn ghost block small"
          onClick={async () => {
            if (await ask({ title: 'Arrêter de suivre ce match ?', message: bet ? 'Ton pari reste enregistré dans « Mes paris ».' : undefined, confirm: 'Arrêter' })) actions.setLive(null);
          }}
        >
          Arrêter de suivre ce match
        </button>
      )}
    </div>
  );
}

function NoLive({ goMatches }: { goMatches: () => void }) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [other, setOther] = useState(false);
  return (
    <div className="stack">
      <Guide
        steps={[
          <>Va dans l'onglet <b>Matchs</b>.</>,
          <>Touche un match <b style={{ color: 'var(--green)' }}>vert</b>.</>,
          <>Touche <b>« Suivre ce match en live »</b>. Tu reviendras ici automatiquement.</>,
        ]}
      />
      <BigButton title="Choisir un match" sub="Ouvre la liste des matchs" onClick={goMatches} />
      {!other ? (
        <button className="btn ghost block small" onClick={() => setOther(true)}>
          Suivre un match qui n'est pas dans la liste
        </button>
      ) : (
        <div className="card stack">
          <Banner tone="orange">Ce match n'a pas été analysé avec les 4 critères : sois prudent.</Banner>
          <TextField label="Équipe à domicile" value={home} onChange={setHome} />
          <TextField label="Équipe à l'extérieur" value={away} onChange={setAway} />
          <button
            className="btn primary block"
            disabled={!home.trim() || !away.trim()}
            onClick={() =>
              actions.setLive({ matchId: null, label: `${home.trim()} – ${away.trim()}`, competition: 'Match non analysé', lambda: 2.7, verdict: null, kickoffAt: null, stage: 'attente', betId: null, q: 'score' })
            }
          >
            Suivre ce match
          </button>
        </div>
      )}
    </div>
  );
}

function Attente({ live }: { live: LiveSession }) {
  const [late, setLate] = useState(false);
  const [m, setM] = useState(10);
  const start = (minute: number) => {
    haptic.success();
    actions.updateLive({ stage: 'chrono', kickoffAt: Date.now() - minute * 60000, q: 'score' });
  };
  return (
    <>
      <Guide steps={[<>Attends le <b>coup d'envoi</b> du match.</>, <>Dès que le match commence, touche le gros bouton <b>COUP D'ENVOI</b>.</>, <>Ne parie rien pour l'instant.</>]} />
      <BigButton icon={<IconPlay size={26} />} title="Coup d'envoi" sub={`Le chrono démarre pour ${live.label}`} onClick={() => start(0)} />
      {!late ? (
        <button className="btn ghost block small" onClick={() => setLate(true)}>
          Le match a déjà commencé ?
        </button>
      ) : (
        <div className="card stack">
          <div className="label">À quelle minute en est le match ?</div>
          <Stepper value={m} min={0} max={44} onChange={setM} format={(v) => `${v}e minute`} />
          <button className="btn primary block" onClick={() => start(m)}>
            Démarrer le chrono à la {m}e minute
          </button>
        </div>
      )}
    </>
  );
}

function ChronoBox({ minute, live }: { minute: number; live: LiveSession }) {
  return (
    <div className="card center" style={{ padding: '14px 12px' }}>
      <div className="chrono">
        {minute}
        <small> min</small>
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 6 }}>
        <button className="chip" onClick={() => actions.updateLive({ kickoffAt: (live.kickoffAt ?? Date.now()) + 60000 })}>
          −1 min
        </button>
        <span className="tiny faint">Recaler le chrono</span>
        <button className="chip" onClick={() => actions.updateLive({ kickoffAt: (live.kickoffAt ?? Date.now()) - 60000 })}>
          +1 min
        </button>
      </div>
    </div>
  );
}

function Chrono({ live, minute, end }: { live: LiveSession; minute: number; end: (t: string) => void }) {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const [o, setO] = useState<number | null>(null);
  const [checked, setChecked] = useState<null | 'ok' | 'low'>(null);
  const [calm, setCalm] = useState(false);
  const { min, chance } = minOddsAt(live.lambda, minute, s);
  const test = nextBetIsTest(bets, s);
  const stake = fixedStake(bets, s, test);
  const week = weekStatus(bets, s);

  if (minute < s.entryFrom) {
    return (
      <>
        <ChronoBox minute={minute} live={live} />
        <Guide
          steps={[
            <>Ne fais <b>rien</b> pour l'instant : regarde le match.</>,
            <>Reviens à la <b>{s.entryFrom}e minute</b> (dans {s.entryFrom - minute} min). Laisse l'app ouverte : elle vibrera.</>,
          ]}
        />
        <Explain q="Pourquoi attendre ?">
          Il y a peu de buts dans le premier quart d'heure (environ 1 but sur 9). Si c'est encore 0-0, presque tous les buts sont encore à venir, et la cote, elle, a déjà monté. C'est ça, l'astuce.
        </Explain>
      </>
    );
  }

  if (minute > s.lastEntry) {
    return (
      <>
        <ChronoBox minute={minute} live={live} />
        <div className="answer no">
          <div className="big">TROP TARD</div>
          Après la {s.lastEntry}e minute, on n'entre plus : il reste trop peu de temps.
        </div>
        <BigButton title="Terminer" sub="On passe ce match, pas grave" onClick={() => end(`Trop tard pour entrer (après la ${s.lastEntry}e minute). On passe, pas grave.`)} tone="plain" />
      </>
    );
  }

  const bet = (asTest: boolean) => {
    const st = getState();
    const fixed = fixedStake(st.bets, st.settings, asTest);
    const b: Bet = {
      id: uid(),
      createdAt: new Date().toISOString(),
      date: todayISO(),
      match: live.label,
      home: live.label.split(' – ')[0] ?? '',
      away: live.label.split(' – ')[1] ?? '',
      league: live.competition,
      odds: o!,
      stake: fixed,
      kind: 'simple',
      live: true,
      test: asTest,
      verdict: live.verdict,
      score: null,
      result: 'pending',
      minute,
    };
    actions.addBet(b);
    actions.updateLive({ stage: 'parie', betId: b.id });
    haptic.success();
    toast(asTest ? `Pari pour de faux noté (${testCount(st.bets) + 1}/${st.settings.testBetsTarget})` : 'Pari noté ✓');
  };

  return (
    <>
      <ChronoBox minute={minute} live={live} />
      {live.q === 'score' && (
        <>
          <Guide steps={[<>Regarde le score dans ton appli de paris.</>, <>Réponds à la question.</>]} />
          <div className="card center" style={{ fontWeight: 800, fontSize: 22 }}>
            Le score est <span style={{ color: 'var(--neon)' }}>0-0</span> ?
          </div>
          <div className="grid2">
            <button className="btn primary" style={{ minHeight: 64, fontSize: 20 }} onClick={() => { haptic.tap(); actions.updateLive({ q: 'anime' }); }}>
              OUI, 0-0
            </button>
            <button className="btn" style={{ minHeight: 64, fontSize: 16 }} onClick={() => end('Un but est déjà tombé avant qu\'on entre : on ne joue pas ce match. Pas grave, il y en aura d\'autres !')}>
              NON, il y a un but
            </button>
          </div>
        </>
      )}
      {live.q === 'anime' && (
        <>
          <Guide steps={[<>Regarde le match (ou les stats en direct).</>, <>Les deux équipes attaquent ? Il y a des tirs, des occasions ?</>]} />
          <div className="card center" style={{ fontWeight: 800, fontSize: 22 }}>
            Le match est <span style={{ color: 'var(--neon)' }}>animé</span> ?
          </div>
          {!calm ? (
            <div className="grid2">
              <button className="btn primary" style={{ minHeight: 64, fontSize: 20 }} onClick={() => { haptic.tap(); actions.updateLive({ q: 'cote' }); }}>
                OUI
              </button>
              <button className="btn" style={{ minHeight: 64, fontSize: 16 }} onClick={() => setCalm(true)}>
                NON, c'est calme
              </button>
            </div>
          ) : (
            <>
              <div className="answer wait">
                <div className="big">ON ATTEND</div>
                Attends 5 minutes, puis repose-toi la question. Si c'est toujours calme à la {s.lastEntry}e minute : on passe.
              </div>
              <button className="btn block" onClick={() => { setCalm(false); actions.updateLive({ q: 'score' }); }}>
                Je revérifie maintenant
              </button>
            </>
          )}
        </>
      )}
      {live.q === 'cote' && (
        <>
          <Guide
            steps={[
              <>Dans ton appli de paris, ouvre ce match.</>,
              <>Trouve le pari <b>« Plus de 1,5 but »</b> (parfois écrit « +1,5 buts » ou « Over 1.5 »).</>,
              <>Tape sa cote ici, puis touche <b>Vérifier</b>.</>,
            ]}
          />
          <div className="card tight row between">
            <span className="small muted">Cote minimum maintenant</span>
            <span className="odds-tag" style={{ fontSize: 24 }}>{fmtOdds(min)}</span>
          </div>
          <NumberField label="La cote « Plus de 1,5 but »" value={o} onChange={(v) => { setO(v); setChecked(null); }} placeholder="Ex. 1,75" />
          <button
            className="btn primary block"
            disabled={!o || o <= 1}
            onClick={() => {
              const ok = (o ?? 0) >= min;
              setChecked(ok ? 'ok' : 'low');
              if (ok) haptic.success();
              else haptic.warning();
            }}
          >
            Vérifier
          </button>
          {checked === 'low' && (
            <div className="answer wait">
              <div className="big">TROP BASSE</div>
              Attends 2 ou 3 minutes : tant qu'il n'y a pas de but, la cote monte. Puis tape la nouvelle cote.
            </div>
          )}
          {checked === 'ok' && !test && week.reached && (
            <div className="answer no">
              <div className="big">STOP</div>
              Tu as atteint ta limite de pertes de la semaine. Pas de pari pour de vrai avant lundi.
              <button className="btn block" style={{ marginTop: 10 }} onClick={() => bet(true)}>
                Le noter pour de faux (entraînement)
              </button>
            </div>
          )}
          {checked === 'ok' && (test || !week.reached) && (
            <>
              <div className="answer ok">
                <div className="big">C'EST BON ✓</div>
                Mise <b>{money(stake)}</b> sur « Plus de 1,5 but » à la cote <b>{fmtOdds(o)}</b>.
                <div className="small muted" style={{ marginTop: 6 }}>Chances estimées de voir 2 buts : {pct(chance)}</div>
              </div>
              <Guide
                steps={[
                  <>Dans ton appli de paris, mise exactement <b>{money(stake)}</b> sur « Plus de 1,5 but ».</>,
                  <>Vérifie que c'est un pari <b>SIMPLE</b> (un seul match, pas de combiné).</>,
                  <>Reviens ici et touche <b>J'AI PARIÉ</b>.</>,
                ]}
              />
              {test && <Banner tone="blue">Entraînement : ne mets <b>pas</b> d'argent pour de vrai. Note juste le pari ici, pour t'exercer.</Banner>}
              <BigButton title="J'ai parié" sub={test ? 'Pari pour de faux (entraînement)' : `${money(stake)} à ${fmtOdds(o)}`} onClick={() => bet(test)} />
            </>
          )}
          <button className="btn ghost block small" onClick={() => end('Un but est tombé avant qu\'on entre : on ne joue pas ce match. Pas grave !')}>
            Un but est tombé pendant que j'attendais
          </button>
        </>
      )}
    </>
  );
}

function settle(bet: Bet, over: boolean, text: string) {
  const r = over ? 'won' : 'lost';
  actions.updateBet(bet.id, { result: r, settledAt: new Date().toISOString() });
  actions.updateLive({ stage: 'fini', endText: text });
  if (over) haptic.success();
  else haptic.error();
}

function Parie({ bet, minute }: { bet: Bet; minute: number }) {
  const live = useStore((st) => st.live)!;
  const chance = chanceOver15(live.lambda, minute, 0);
  return (
    <>
      <div className="card tight row between">
        <span className="small muted">Ton pari</span>
        <b>
          {money(bet.stake)} à {fmtOdds(bet.odds)} {bet.test ? '(pour de faux)' : ''}
        </b>
      </div>
      <ChronoBox minute={minute} live={live} />
      <Guide steps={[<>Regarde le match ou les scores en direct.</>, <>Dès qu'il y a un <b>BUT</b>, touche le gros bouton rouge.</>]} />
      <button className="goal-btn" onClick={() => { haptic.success(); actions.updateLive({ stage: 'but' }); }}>
        BUT !
      </button>
      <div className="tiny faint center">Chances estimées de voir 2 buts, à cette minute : {pct(chance)}</div>
      <div className="grid2">
        <button className="btn small" onClick={() => settle(bet, true, 'Il y a eu 2 buts ou plus : pari gagné !')}>
          Fini : 2 buts ou + ✓
        </button>
        <button className="btn small" onClick={() => settle(bet, false, 'Moins de 2 buts : pari perdu. Ça arrive, la mise fixe te protège.')}>
          Fini : moins de 2 ✗
        </button>
      </div>
    </>
  );
}

function But({ bet }: { bet: Bet }) {
  const [mode, setMode] = useState<'contraire' | 'cashout' | null>(null);
  const [u, setU] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const plan = u && u > 1 ? hedgePlan(bet.stake, bet.odds, u) : null;

  const doHedge = () => {
    if (!plan || !u) return;
    const pnl = Math.min(hedgedPnl(bet.stake, bet.odds, plan.stake, u, true), hedgedPnl(bet.stake, bet.odds, plan.stake, u, false));
    actions.updateBet(bet.id, { hedge: { kind: 'contraire', odds: u, amount: plan.stake }, pnl, result: pnl > 0 ? 'won' : pnl < 0 ? 'lost' : 'void', settledAt: new Date().toISOString() });
    actions.updateLive({ stage: 'fini', endText: `Sécurisé ! Tu gagnes ${signedMoney(pnl)} quoi qu'il arrive.` });
    haptic.success();
  };
  const doCash = () => {
    if (!c) return;
    const pnl = Math.round((c - bet.stake) * 100) / 100;
    actions.updateBet(bet.id, { hedge: { kind: 'cashout', amount: c }, pnl, result: pnl > 0 ? 'won' : pnl < 0 ? 'lost' : 'void', settledAt: new Date().toISOString() });
    actions.updateLive({ stage: 'fini', endText: `Cash-out encaissé : ${signedMoney(pnl)}.` });
    haptic.success();
  };

  return (
    <>
      <div className="answer ok">
        <div className="big">BUT ! ⚽</div>
        Maintenant, on <b>sécurise</b> tout de suite. Choisis <b>une</b> façon :
      </div>
      {!mode && (
        <>
          <BigButton title="Pari contraire" sub="Le plus sûr : tu gagnes quoi qu'il arrive" onClick={() => setMode('contraire')} />
          <BigButton title="Cash-out" sub="Si ton appli propose « Cash-out »" onClick={() => setMode('cashout')} tone="plain" />
          <Explain q="C'est quoi la différence ?">
            Le <b>pari contraire</b>, c'est parier un peu sur « Moins de 1,5 but » : si le 2e but arrive, ton premier pari gagne ; s'il n'arrive pas, c'est le 2e pari qui gagne. Dans les deux cas, tu finis gagnant. Le <b>cash-out</b>, c'est l'appli qui te rachète ton pari tout de suite contre un montant fixe.
          </Explain>
          <button className="btn ghost block small" onClick={() => actions.updateLive({ stage: 'parie' })}>
            Je ne sécurise pas (je garde mon pari)
          </button>
        </>
      )}
      {mode === 'contraire' && (
        <>
          <Guide
            steps={[
              <>Dans ton appli, sur ce match, trouve <b>« Moins de 1,5 but »</b>.</>,
              <>Tape sa cote ici.</>,
              <>L'app te dit combien miser dessus.</>,
            ]}
          />
          <NumberField label="Cote « Moins de 1,5 but »" value={u} onChange={setU} placeholder="Ex. 4,00" />
          {plan && plan.worth && (
            <>
              <div className="answer ok">
                Mise <b style={{ fontSize: 22 }}>{money(plan.stake)}</b> sur « Moins de 1,5 but ».
                <div className="big">+{money(plan.gain)}</div>
                gagnés quoi qu'il arrive ✓
              </div>
              <BigButton title="C'est fait" sub="J'ai mis le pari contraire" onClick={doHedge} />
            </>
          )}
          {plan && !plan.worth && (
            <div className="answer wait">
              <div className="big">NE SÉCURISE PAS</div>
              Avec cette cote, sécuriser te ferait perdre de l'argent. Garde ton pari, ou regarde le cash-out.
            </div>
          )}
          <button className="btn ghost block small" onClick={() => setMode(null)}>
            Retour
          </button>
        </>
      )}
      {mode === 'cashout' && (
        <>
          <Guide steps={[<>Dans ton appli, regarde le montant <b>Cash-out</b> proposé pour ce pari.</>, <>Tape ce montant ici.</>]} />
          <NumberField label="Montant du cash-out" value={c} onChange={setC} suffix="€" />
          {c !== null && c > 0 && (
            <>
              <div className={`answer ${c > bet.stake ? 'ok' : 'wait'}`}>
                {c > bet.stake ? (
                  <>
                    Tu récupères {money(c)}, donc tu gagnes
                    <div className="big">+{money(c - bet.stake)}</div>
                  </>
                ) : (
                  <>
                    <div className="big">PAS INTÉRESSANT</div>
                    Ce cash-out ne te fait rien gagner. Garde plutôt ton pari.
                  </>
                )}
              </div>
              {c > bet.stake && <BigButton title="J'ai encaissé" sub="Cash-out fait dans mon appli" onClick={doCash} />}
            </>
          )}
          <button className="btn ghost block small" onClick={() => setMode(null)}>
            Retour
          </button>
        </>
      )}
    </>
  );
}

function Fini({ text, bet, onDone, goBets }: { text: string; bet: Bet | null; onDone: () => void; goBets: () => void }) {
  const p = bet && bet.result !== 'pending' ? profit(bet) : null;
  return (
    <>
      <div className={`answer ${p === null ? 'wait' : p >= 0 ? 'ok' : 'no'}`}>
        <div className="big">{p === null ? 'TERMINÉ' : p >= 0 ? 'BRAVO' : 'PERDU'}</div>
        {text}
        {p !== null && <div className="big" style={{ marginTop: 8 }}>{signedMoney(p)}</div>}
      </div>
      <Guide steps={[<>Respire : un pari à la fois.</>, <>Ne cherche jamais à « te refaire » après une perte.</>, <>Choisis le prochain match vert quand tu veux.</>]} />
      <BigButton title="Retour aux matchs" onClick={onDone} />
      <button className="btn block" onClick={goBets}>
        Voir mes paris
      </button>
    </>
  );
}
