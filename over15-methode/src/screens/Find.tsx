import { useMemo, useState } from 'react';
import { actions, useStore } from '../lib/store';
import { todayISO } from '../lib/defaults';
import { buildOutsidersPrompt, parseOutsiders } from '../lib/claude';
import { fixedStake, nextBetIsTest } from '../lib/stats';
import { money, odds as fmtOdds } from '../lib/format';
import { pickValue, signedPct, type ValueResult } from '../lib/value';
import type { Outsider } from '../lib/types';
import { haptic, openUrl } from '../lib/native';
import { Coach } from '../components/Coach';
import { ask, BigButton, Explain, NumberField, Segmented, Sheet } from '../components/ui';
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
            return `${r.picks.length} cote(s) reçue(s) ✓`;
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
              {r ? `${WORD[r.verdict]} (${signedPct(r.value)})` : 'Touche pour compléter'}
            </span>
          </span>
          <span className="odds-tag">{fmtOdds(p.odds)}</span>
        </button>
      ))}
      <BigButton icon="🔄" title="Nouvelle recherche" sub="autre jour ou plus tard" onClick={() => setSearching(true)} tone="plain" />
      {current && <PickSheet p={current} onClose={() => setOpen(null)} goBets={goBets} />}
    </div>
  );
}

function PickSheet({ p, onClose, goBets }: { p: Outsider; onClose: () => void; goBets: () => void }) {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const [save, setSave] = useState(false);
  const r: ValueResult | null = pickValue(p, s);
  const stake = fixedStake(bets, s, nextBetIsTest(bets, s));
  const sig = p.signals;
  const why = [
    ...p.reasonsFor.map((t) => `👍 ${t}`),
    ...p.reasonsAgainst.map((t) => `👎 ${t}`),
    sig.xg && `🎯 ${sig.xg}`,
    sig.absentsFav.length > 0 && `🚑 Absents chez le favori : ${sig.absentsFav.join(', ')}`,
    sig.fatigueFav === true && '😴 Le favori est fatigué ou fait tourner',
    sig.motivation && `🔥 ${sig.motivation}`,
    sig.oddsMove === 'baisse' && '📉 Sa cote baisse : des parieurs bien informés misent dessus',
    sig.oddsMove === 'hausse' && '📈 Sa cote monte : le marché y croit moins',
  ].filter(Boolean) as string[];

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

        {r ? (
          <>
            <div className="center">
              <span className={`stamp ${r.verdict}`}>
                {EMOJI[r.verdict]} {WORD[r.verdict].toUpperCase()}
              </span>
            </div>
            <div className="card">
              <ValueGauge r={r} compact />
            </div>
            {r.verdict === 'OK' ? (
              <Coach mood="happy">
                Mise <b>{money(stake)}</b> sur « {p.bet} » si la cote est encore à <b>{fmtOdds(r.minOdds)}</b> ou plus. Puis touche « J'ai parié ».
              </Coach>
            ) : (
              <Coach mood="sad">On ne parie pas. Ça devient bon à partir d'une cote de {fmtOdds(r.minOdds)}.</Coach>
            )}
            {r.verdict === 'OK' && <BigButton icon="💶" title="J'ai parié" sub={`${money(stake)} sur ${p.team}`} onClick={() => setSave(true)} tone="primary" />}
          </>
        ) : (
          <Coach mood="think">Il me manque la cote Pinnacle. Tape-la dans « Corriger les cotes » ci-dessous.</Coach>
        )}

        {why.length > 0 && (
          <Explain q="Pourquoi ?">
            {why.map((t) => (
              <div key={t} style={{ margin: '4px 0' }}>
                {t}
              </div>
            ))}
          </Explain>
        )}
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
      {save && r && (
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
