import { useMemo, useState } from 'react';
import { actions, useStore } from '../lib/store';
import { todayISO } from '../lib/defaults';
import { buildOutsidersPrompt, parseOutsiders } from '../lib/claude';
import { fixedStake, nextBetIsTest } from '../lib/stats';
import { money, odds as fmtOdds } from '../lib/format';
import { pickValue, signedPct, valueInWords, type ValueResult } from '../lib/value';
import { computeSignals, countSignals, formPoints, type Signal } from '../lib/signals';
import type { Outsider, TeamFacts } from '../lib/types';
import { haptic, openUrl } from '../lib/native';
import { Coach } from '../components/Coach';
import { ask, Banner, BigButton, Explain, NumberField, Segmented, Sheet } from '../components/ui';
import { SaveBet, ValueGauge } from '../components/Value';
import { FetchFlow } from './FetchFlow';

const ORDER = { OK: 0, BOF: 1, NON: 2 } as const;
const EMOJI = { OK: '✅', BOF: '➖', NON: '❌' } as const;
const WORD = { OK: 'Bonne affaire', BOF: 'Bof', NON: 'Piège' } as const;

/** « Trouver » : Claude cherche les outsiders, l'app dit ✅ ou ❌. */
export function Find({ goBets }: { goBets: () => void }) {
  const s = useStore((st) => st.settings);
  const picks = useStore((st) => st.picks);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const date = day === 'today' ? todayISO() : todayISO(new Date(Date.now() + 86400000));

  const list = useMemo(
    () => picks.map((p) => ({ p, r: pickValue(p, s) })).sort((a, b) => (a.r ? ORDER[a.r.verdict] : 3) - (b.r ? ORDER[b.r.verdict] : 3) || (b.r?.value ?? -9) - (a.r?.value ?? -9)),
    [picks, s],
  );
  const oks = list.filter((x) => x.r?.verdict === 'OK').length;
  const current = picks.find((p) => p.id === open) ?? null;

  if (searching || !picks.length) {
    return (
      <div className="stack">
        <Coach mood="think">Je demande à Claude les grosses cotes du jour. Regarde la vidéo, puis touche les 3 boutons !</Coach>
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
          buildPrompt={() => buildOutsidersPrompt(date, s)}
          onText={(text) => {
            const r = parseOutsiders(text, date);
            actions.setPicks(r.picks, r.date);
            setSearching(false);
            return r.salvaged ? `${r.picks.length} match(s) lu(s) ✓ (un morceau abîmé a été ignoré)` : `${r.picks.length} match(s) reçu(s) ✓`;
          }}
        />
        {picks.length > 0 && (
          <button className="btn ghost block" onClick={() => setSearching(false)}>
            Revenir à ma liste
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      {oks > 0 ? (
        <Coach mood="wow">J'ai trouvé {oks} bonne{oks > 1 ? 's' : ''} affaire{oks > 1 ? 's' : ''} ! Touche un ✅.</Coach>
      ) : (
        <Coach mood="sad">Aujourd'hui, pas de bonne affaire. Le mieux : ne pas parier.</Coach>
      )}
      {list.map(({ p, r }) => (
        <button key={p.id} className="card press row" style={{ textAlign: 'left', width: '100%' }} onClick={() => setOpen(p.id)}>
          <span className={`verdict-dot ${r ? r.verdict : ''}`} style={r ? undefined : { background: 'var(--blue-soft)' }}>
            {r ? EMOJI[r.verdict] : '❔'}
          </span>
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="ellipsis" style={{ display: 'block', fontWeight: 900, fontSize: 18 }}>
              {p.team}
            </span>
            <span className="ellipsis small muted" style={{ display: 'block' }}>
              contre {p.team === p.home ? p.away : p.home}
              {p.time ? ` · ${p.time}` : ''}
            </span>
            <span className="small" style={{ display: 'block', fontWeight: 900, color: r ? `var(--${r.verdict === 'OK' ? 'green-d' : r.verdict === 'BOF' ? 'orange-d' : 'red-d'})` : 'var(--blue-d)' }}>
              {r ? `${WORD[r.verdict]} (${signedPct(r.value)})` : 'Value : cote Pinnacle manquante'}
            </span>
            <SignalCount p={p} />
          </span>
          <span className="odds-tag">{fmtOdds(p.odds)}</span>
        </button>
      ))}
      <BigButton icon="🔄" title="Nouvelle recherche" sub="autre jour ou plus tard" onClick={() => setSearching(true)} tone="plain" />
      {current && <PickSheet p={current} onClose={() => setOpen(null)} goBets={goBets} />}
    </div>
  );
}

function SignalCount({ p }: { p: Outsider }) {
  const c = countSignals(computeSignals(p));
  if (!c.pour && !c.contre) return null;
  return (
    <span className="tiny" style={{ display: 'block', fontWeight: 800, marginTop: 2 }}>
      <span style={{ color: 'var(--green-d)' }}>👍 {c.pour} pour</span> · <span style={{ color: 'var(--red-d)' }}>👎 {c.contre} contre</span>
    </span>
  );
}

const dash = (x: unknown) => (x === null || x === undefined || x === '' ? '—' : String(x));
const n1 = (x: number | null) => (x === null ? '—' : x.toFixed(1).replace('.', ','));
const per = (n: number | null, t: TeamFacts) => (n !== null && t.played ? n1(n / t.played) : '—');

function FormPills({ form }: { form: string }) {
  if (!form) return <>—</>;
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[...form].map((c, i) => (
        <span key={i} className={`fpill ${c}`}>
          {c}
        </span>
      ))}
    </span>
  );
}

function FaceAFace({ p }: { p: Outsider }) {
  const o = p.out!;
  const f = p.fav!;
  const venueTxt = (t: TeamFacts) => (t.venue ? `${dash(t.venue.w)}V ${dash(t.venue.d)}N ${dash(t.venue.l)}D · ${dash(t.venue.gf)}-${dash(t.venue.ga)}` : '—');
  const top = (t: TeamFacts) => {
    const b = [...t.scorers].sort((a, c) => (c.goals ?? 0) - (a.goals ?? 0))[0];
    return b ? `${b.name} ${b.goals ?? '?'} buts ${b.available === false ? '❌' : b.available ? '✅' : '❔'}` : '—';
  };
  const rows: [string, React.ReactNode, React.ReactNode][] = [
    ['Cote (ton appli)', p.team === o.name ? fmtOdds(p.odds) : fmtOdds(o.odds), fmtOdds(f.odds)],
    ['Cote Pinnacle', fmtOdds(o.pinnacle), fmtOdds(f.pinnacle)],
    ['Classement', o.rank ? `${o.rank}e` : '—', f.rank ? `${f.rank}e` : '—'],
    ['Points', dash(o.points), dash(f.points)],
    ['Zone rouge', o.zoneGap === null ? '—' : `${o.zoneGap >= 0 ? '+' : ''}${o.zoneGap} pt`, f.zoneGap === null ? '—' : `${f.zoneGap >= 0 ? '+' : ''}${f.zoneGap} pt`],
    ['Objectif', dash(o.goal), dash(f.goal)],
    ['Forme (5 derniers)', <FormPills form={o.form} />, <FormPills form={f.form} />],
    ['Points sur la forme', dash(formPoints(o.form)), dash(formPoints(f.form))],
    [p.home === o.name ? 'Dom. / Ext.' : 'Ext. / Dom.', venueTxt(o), venueTxt(f)],
    ['Buts marqués / match', per(o.scored, o), per(f.scored, f)],
    ['Buts encaissés / match', per(o.conceded, o), per(f.conceded, f)],
    ['xG pour / contre', o.xgFor === null ? '—' : `${n1(o.xgFor)} / ${n1(o.xgAgainst)}`, f.xgFor === null ? '—' : `${n1(f.xgFor)} / ${n1(f.xgAgainst)}`],
    ['Meilleur buteur', top(o), top(f)],
    ['Absents', o.absents.length ? o.absents.map((a) => a.name).join(', ') : 'aucun', f.absents.length ? f.absents.map((a) => a.name).join(', ') : 'aucun'],
    ['Repos', o.restDays === null ? '—' : `${o.restDays} j`, f.restDays === null ? '—' : `${f.restDays} j`],
    ["Coupe d'Europe cette semaine", o.europe === null ? '—' : o.europe ? 'oui' : 'non', f.europe === null ? '—' : f.europe ? 'oui' : 'non'],
    ['Entraîneur', `${dash(o.coach)}${o.newCoach ? ' 🆕' : ''}`, `${dash(f.coach)}${f.newCoach ? ' 🆕' : ''}`],
    ['Elo', dash(o.elo === null ? null : Math.round(o.elo)), dash(f.elo === null ? null : Math.round(f.elo))],
  ];
  return (
    <table className="facts">
      <thead>
        <tr>
          <th />
          <th className="out">{o.name || p.team}</th>
          <th>{f.name || 'Favori'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, a, b]) => (
          <tr key={label}>
            <td className="lbl">{label}</td>
            <td className="out">{a}</td>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SignalList({ list }: { list: Signal[] }) {
  const order = { pour: 0, contre: 1, info: 2 } as const;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {[...list]
        .sort((a, b) => order[a.side] - order[b.side])
        .map((s) => (
          <div key={s.text} className={`signal ${s.side}`}>
            <span className="signal-ico">{s.side === 'pour' ? '👍' : s.side === 'contre' ? '👎' : s.icon}</span>
            <span>{s.text}</span>
          </div>
        ))}
    </div>
  );
}

function PickSheet({ p, onClose, goBets }: { p: Outsider; onClose: () => void; goBets: () => void }) {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const [save, setSave] = useState(false);
  const r: ValueResult | null = pickValue(p, s);
  const stake = fixedStake(bets, s, nextBetIsTest(bets, s));
  const signals = computeSignals(p);
  const c = countSignals(signals);
  const ctx = p.ctx;

  let advice: { mood: 'happy' | 'think' | 'sad' | 'wow'; text: React.ReactNode };
  if (!r) advice = { mood: 'think', text: <>Il manque la cote Pinnacle pour calculer la value. Regarde les signaux et décide, ou tape la cote dans « Corriger les cotes ».</> };
  else if (r.verdict === 'OK' && c.pour >= c.contre + 2) advice = { mood: 'wow', text: <>Value ✅ et {c.pour} signaux pour : ça vaut le coup d'essayer, avec ta petite mise de <b>{money(stake)}</b>.</> };
  else if (r.verdict === 'OK') advice = { mood: 'think', text: <>Value ✅, mais {c.contre} signal(aux) contre. À toi de voir : regarde les 👎 avant de décider.</> };
  else advice = { mood: 'sad', text: <>La cote n'est pas assez généreuse ({WORD[r.verdict].toLowerCase()}). Même avec de bons signaux, sur le long terme ce genre de pari fait perdre. Mon conseil : on passe.</> };

  return (
    <Sheet open onClose={onClose}>
      <div className="stack">
        <div className="center">
          <div className="tiny muted" style={{ fontWeight: 800 }}>
            {p.competition}
            {p.time ? ` · ${p.time}` : ''}
          </div>
          <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.1, marginTop: 4 }}>{p.bet}</div>
          <div className="small muted">
            {p.home} – {p.away}
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="odds-tag" style={{ fontSize: 24 }}>{fmtOdds(p.odds)}</span>
            {p.bookmaker && <span className="small muted"> chez {p.bookmaker}</span>}
          </div>
        </div>

        <div className="grid2">
          <div className="card tight center" style={{ background: 'var(--green-soft)', borderColor: '#b7ebc8', boxShadow: '0 3px 0 #b7ebc8' }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--green-d)' }}>👍 {c.pour}</div>
            <div className="tiny" style={{ fontWeight: 800 }}>signaux pour</div>
          </div>
          <div className="card tight center" style={{ background: 'var(--red-soft)', borderColor: '#f8c4c4', boxShadow: '0 3px 0 #f8c4c4' }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--red-d)' }}>👎 {c.contre}</div>
            <div className="tiny" style={{ fontWeight: 800 }}>signaux contre</div>
          </div>
        </div>

        <div className="section-title">💰 La value (la cote vaut-elle le coup ?)</div>
        {r ? (
          <div className="card stack" style={{ gap: 10 }}>
            <div className="center">
              <span className={`stamp ${r.verdict}`} style={{ fontSize: 20 }}>
                {EMOJI[r.verdict]} {WORD[r.verdict].toUpperCase()} {signedPct(r.value)}
              </span>
            </div>
            <ValueGauge r={r} compact />
            <div style={{ fontWeight: 800 }}>{valueInWords(r.value)}</div>
            <Explain q="Comment je lis ça ?">
              <b>Chance selon ta cote</b> = 1 ÷ cote : ce que le bookmaker pense. <b>Vraie chance</b> = la cote de Pinnacle, le bookmaker le plus juste, sans sa marge
              {r.source === 'claude' ? ' (ici, faute de Pinnacle : l\'estimation de Claude, moins fiable)' : ''}. Si la vraie chance est plus grande, la cote est trop généreuse.
              <br />✅ <b>Bonne affaire</b> : +{Math.round(s.valueMin * 100)} % ou plus. ➖ <b>Bof</b> : entre 0 et +{Math.round(s.valueMin * 100)} %. ❌ <b>Piège</b> : en dessous de 0.
              <br />La value ne dit pas si ce match-ci va passer : un outsider perd souvent. Elle dit si, en jouant ce genre de pari 100 fois, tu gagnes ou tu perds.
              <br />Ça devient une bonne affaire à partir d'une cote de <b>{fmtOdds(r.minOdds)}</b>.
            </Explain>
          </div>
        ) : (
          <Banner tone="blue">Pas de cote Pinnacle ni d'estimation : la value ne peut pas être calculée. Tape la cote dans « Corriger les cotes ».</Banner>
        )}

        {signals.length > 0 && (
          <>
            <div className="section-title">🔍 Les signaux</div>
            <SignalList list={signals} />
          </>
        )}

        {p.out && p.fav && (
          <>
            <div className="section-title">⚖️ Face à face</div>
            <FaceAFace p={p} />
          </>
        )}

        {ctx && (ctx.stakes || ctx.link || ctx.h2h.length > 0 || ctx.weather || ctx.referee || ctx.extra.length > 0 || ctx.oddsMoveDetail) && (
          <>
            <div className="section-title">📋 Le match</div>
            <div className="card stack" style={{ gap: 8, fontSize: 15 }}>
              {ctx.stakes && <div>🔥 <b>Enjeu :</b> {ctx.stakes}</div>}
              {ctx.link && <div>⚔️ <b>Lien :</b> {ctx.link}</div>}
              {ctx.h2h.length > 0 && <div>🤝 <b>Confrontations :</b> {ctx.h2h.join(' · ')}</div>}
              {ctx.oddsMoveDetail && <div>📉 <b>Cote :</b> {ctx.oddsMoveDetail}</div>}
              {ctx.drawOdds !== null && <div>🟰 <b>Cote du nul :</b> {fmtOdds(ctx.drawOdds)}</div>}
              {ctx.weather && <div>🌦️ <b>Météo :</b> {ctx.weather}</div>}
              {ctx.referee && <div>🟨 <b>Arbitre :</b> {ctx.referee}</div>}
              {ctx.extra.map((t) => (
                <div key={t}>ℹ️ {t}</div>
              ))}
            </div>
          </>
        )}

        {(p.reasonsFor.length > 0 || p.reasonsAgainst.length > 0) && (
          <Explain q="L'avis de Claude">
            {p.reasonsFor.map((t) => (
              <div key={t} style={{ margin: '4px 0' }}>👍 {t}</div>
            ))}
            {p.reasonsAgainst.map((t) => (
              <div key={t} style={{ margin: '4px 0' }}>👎 {t}</div>
            ))}
            {p.estimate !== null && <div style={{ marginTop: 6 }}>Estimation de Claude : {Math.round(p.estimate * 100)} % de chances de victoire.</div>}
          </Explain>
        )}

        <div className="section-title">🧑‍⚖️ À toi de décider</div>
        <Coach mood={advice.mood}>{advice.text}</Coach>
        <div className="grid2">
          <button className="btn primary" onClick={() => setSave(true)}>
            💶 Je parie
          </button>
          <button className="btn" onClick={onClose}>
            🙅 Je passe
          </button>
        </div>

        <Explain q="Corriger les cotes">
          <div className="stack" style={{ gap: 8, marginTop: 6 }}>
            <NumberField label={`Cote de ${p.team} (ton appli)`} value={p.odds} onChange={(v) => actions.updatePick(p.id, { odds: v })} />
            <div className="grid3">
              <NumberField label="Pinnacle équipe" value={p.pinnacle.out} onChange={(v) => actions.updatePick(p.id, { pinnacle: { ...p.pinnacle, out: v } })} />
              <NumberField label="Pinnacle nul" value={p.pinnacle.draw} onChange={(v) => actions.updatePick(p.id, { pinnacle: { ...p.pinnacle, draw: v } })} />
              <NumberField label="Pinnacle favori" value={p.pinnacle.fav} onChange={(v) => actions.updatePick(p.id, { pinnacle: { ...p.pinnacle, fav: v } })} />
            </div>
            <button className="btn small" onClick={() => openUrl(`https://www.google.com/search?q=${encodeURIComponent(`oddsportal ${p.home} ${p.away}`)}`)}>
              Chercher les cotes Pinnacle
            </button>
          </div>
        </Explain>
        {p.sources.length > 0 && (
          <div className="tiny faint">
            Sources :{' '}
            {p.sources.map((u, i) => (
              <button key={u + i} className="tiny" style={{ color: 'var(--blue)', textDecoration: 'underline', marginRight: 8 }} onClick={() => openUrl(u)}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
        <button
          className="btn ghost block small"
          onClick={async () => {
            if (await ask({ title: 'Retirer de la liste ?', confirm: 'Retirer', tone: 'danger' })) {
              actions.deletePick(p.id);
              onClose();
            }
          }}
        >
          🗑️ Retirer de la liste
        </button>
      </div>
      {save && (
        <SaveBet
          preset={{ match: `${p.home} – ${p.away}`, league: p.competition, pick: p.bet, odds: p.odds, result: r, date: p.date }}
          onClose={() => setSave(false)}
          onSaved={() => {
            haptic.success();
            onClose();
            goBets();
          }}
        />
      )}
    </Sheet>
  );
}
