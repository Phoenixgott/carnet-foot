import { useMemo, useState } from 'react';
import { actions, useStore } from '../lib/store';
import { todayISO } from '../lib/defaults';
import { buildOutsidersPrompt, parseOutsiders } from '../lib/claude';
import { fixedStake, nextBetIsTest, weekStatus } from '../lib/stats';
import { money, odds as fmtOdds } from '../lib/format';
import { pickValue, signedPct, VERDICT_COLOR, VERDICT_SHORT, type ValueResult } from '../lib/value';
import type { Outsider } from '../lib/types';
import { haptic, openUrl } from '../lib/native';
import { ask, Banner, BigButton, Explain, Guide, NumberField, Segmented, Sheet } from '../components/ui';
import { SaveBet, ValueGauge } from '../components/Value';
import { IconBook, IconRefresh, IconTrash } from '../components/Icons';
import { FetchFlow } from './FetchFlow';

function dayTitle(date: string) {
  if (date === todayISO()) return "Outsiders d'aujourd'hui";
  if (date === todayISO(new Date(Date.now() + 86400000))) return 'Outsiders de demain';
  return `Outsiders du ${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
}

const ORDER = { OK: 0, BOF: 1, NON: 2 } as const;

export function Outsiders({ goLearn, goBets }: { goLearn: () => void; goBets: () => void }) {
  const s = useStore((st) => st.settings);
  const picks = useStore((st) => st.picks);
  const picksDate = useStore((st) => st.picksDate);
  const bets = useStore((st) => st.bets);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const date = day === 'today' ? todayISO() : todayISO(new Date(Date.now() + 86400000));
  const test = nextBetIsTest(bets, s);
  const stake = fixedStake(bets, s, test);
  const week = weekStatus(bets, s);

  const list = useMemo(
    () =>
      picks
        .map((p) => ({ p, r: pickValue(p, s) }))
        .sort((a, b) => (a.r ? ORDER[a.r.verdict] : 3) - (b.r ? ORDER[b.r.verdict] : 3) || (b.r?.value ?? -9) - (a.r?.value ?? -9)),
    [picks, s],
  );
  const oks = list.filter((x) => x.r?.verdict === 'OK').length;
  const showFlow = searching || !picks.length;
  const current = picks.find((p) => p.id === open) ?? null;

  return (
    <div className="stack">
      <div className="card tight row between">
        <div>
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Ta mise par pari</div>
          <div className="big-number" style={{ fontSize: 30 }}>{money(stake)}</div>
        </div>
        <span className={`chip ${test ? 'blue' : 'green'}`}>{test ? 'Pour de faux (entraînement)' : 'Pour de vrai'}</span>
      </div>
      {week.reached && (
        <Banner tone="red">
          <b>Stop pour cette semaine.</b> Limite de pertes atteinte ({money(week.limit)}). Reviens lundi.
        </Banner>
      )}

      {showFlow ? (
        <>
          <Guide
            steps={[
              <>Choisis le jour : <b>aujourd'hui</b> ou <b>demain</b>.</>,
              <>Fais les <b>5 étapes</b> ci-dessous. Claude cherche les outsiders, leurs cotes et la cote <b>Pinnacle</b> (la plus juste).</>,
              <>L'app calcule si chaque cote est une <b>bonne affaire ✅</b> ou un <b>piège ❌</b>.</>,
            ]}
          />
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
              return `${r.picks.length} outsider(s) reçu(s) ✓`;
            }}
          />
          {picks.length > 0 && (
            <button className="btn ghost block" onClick={() => setSearching(false)}>
              Annuler et revenir à ma liste
            </button>
          )}
          <BigButton icon={<IconBook size={22} />} title="Comprendre la value" sub="Expliquée simplement, en 2 minutes" onClick={goLearn} tone="plain" />
        </>
      ) : (
        <>
          <div className="section-title">
            <span>{picksDate ? dayTitle(picksDate) : 'Outsiders'}</span>
            <span className="chip green">{oks} bonne(s) affaire(s)</span>
          </div>
          {oks > 0 ? (
            <Guide steps={[<>Touche un outsider marqué <b style={{ color: 'var(--green)' }}>✅ OK</b>.</>, <>Lis pourquoi c'est une bonne affaire.</>, <>Si tu paries, touche <b>« J'ai parié »</b>.</>]} />
          ) : (
            <Guide tone="orange" title="Pas de bonne affaire" steps={[<>Aucune cote n'est assez généreuse aujourd'hui.</>, <>Le mieux : <b>ne pas parier</b>. Ne pas jouer, c'est aussi protéger ton argent.</>]} />
          )}
          {list.map(({ p, r }) => (
            <PickCard key={p.id} p={p} r={r} onClick={() => setOpen(p.id)} />
          ))}
          <BigButton icon={<IconRefresh size={22} />} title="Chercher d'autres outsiders" sub="Refaire les 5 étapes (autre jour)" onClick={() => setSearching(true)} tone="plain" />
        </>
      )}
      {current && <PickDetail p={current} onClose={() => setOpen(null)} goBets={goBets} />}
      <div className="tiny faint center" style={{ marginTop: 6 }}>18+ · Les paris comportent des risques : endettement, isolement, dépendance. Besoin d'aide : 09 74 75 13 13 (Joueurs Info Service).</div>
    </div>
  );
}

function PickCard({ p, r, onClick }: { p: Outsider; r: ValueResult | null; onClick: () => void }) {
  const color = r ? VERDICT_COLOR[r.verdict] : 'var(--line-2)';
  return (
    <div className="card match-card press" style={{ ['--stripe' as string]: color }} onClick={onClick} role="button">
      <div className="league">
        <span className="ellipsis grow">{p.competition}</span>
        {p.time && <span>{p.time}</span>}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="ellipsis" style={{ fontWeight: 800, fontSize: 17 }}>{p.bet}</div>
          <div className="small muted ellipsis">
            {p.home} – {p.away}
          </div>
        </div>
        <span className="odds-tag">{fmtOdds(p.odds)}</span>
      </div>
      {r ? (
        <div style={{ marginTop: 10 }}>
          <ValueGauge r={r} compact />
          <div className="row between" style={{ marginTop: 6 }}>
            <b style={{ color }}>{VERDICT_SHORT[r.verdict]}</b>
            <span className="small" style={{ color }}>Value {signedPct(r.value)}</span>
          </div>
        </div>
      ) : (
        <div className="small" style={{ marginTop: 8, color: 'var(--blue)' }}>Il manque la cote Pinnacle : touche pour la taper.</div>
      )}
    </div>
  );
}

function PickDetail({ p, onClose, goBets }: { p: Outsider; onClose: () => void; goBets: () => void }) {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const [save, setSave] = useState(false);
  const r = pickValue(p, s);
  const stake = fixedStake(bets, s, nextBetIsTest(bets, s));
  const sig = p.signals;
  const signals = [
    sig.xg && `🎯 ${sig.xg}`,
    sig.absentsFav.length > 0 && `🚑 Absents chez le favori : ${sig.absentsFav.join(', ')}`,
    sig.fatigueFav === true && '😴 Le favori est fatigué ou va faire tourner son équipe',
    sig.motivation && `🔥 ${sig.motivation}`,
    sig.oddsMove === 'baisse' && '📉 La cote de l\'outsider baisse : des parieurs bien informés misent dessus',
    sig.oddsMove === 'hausse' && '📈 La cote de l\'outsider monte : le marché y croit de moins en moins',
  ].filter(Boolean) as string[];

  return (
    <Sheet open onClose={onClose}>
      <div className="stack">
        <div className="center">
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
            {p.competition}
            {p.time ? ` · ${p.time}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 26, lineHeight: 1.1, marginTop: 4 }}>{p.bet}</div>
          <div className="small muted">
            {p.home} – {p.away}
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="odds-tag" style={{ fontSize: 26 }}>{fmtOdds(p.odds)}</span>
            {p.bookmaker && <span className="small muted"> chez {p.bookmaker}</span>}
          </div>
        </div>

        {r ? (
          <div className="card">
            <ValueGauge r={r} />
            <p className="small" style={{ margin: '12px 0 0' }}>{r.sentence}</p>
          </div>
        ) : (
          <Banner tone="blue">Claude n'a pas trouvé la cote Pinnacle ni d'estimation. Tape-la ci-dessous (OddsPortal l'affiche) : l'app fera le calcul.</Banner>
        )}

        {r?.verdict === 'OK' ? (
          <Guide
            steps={[
              <>Dans ton appli ({p.bookmaker || 'Winamax, Unibet…'}), ouvre ce match.</>,
              <>Vérifie que la cote de <b>{p.team}</b> est toujours d'au moins <b>{fmtOdds(r.minOdds)}</b>.</>,
              <>Mise <b>{money(stake)}</b> sur « {p.bet} ». Pari <b>simple</b>.</>,
              <>Reviens ici et touche <b>« J'ai parié »</b>.</>,
            ]}
          />
        ) : r ? (
          <Guide tone={r.verdict === 'BOF' ? 'orange' : 'red'} title="Ce que tu fais" steps={[<>On <b>ne parie pas</b> : la cote n'est pas assez généreuse.</>, <>Si la cote monte au-dessus de <b>{fmtOdds(r.minOdds)}</b>, ça redevient une bonne affaire.</>]} />
        ) : null}

        {r?.verdict === 'OK' && <BigButton title="J'ai parié" sub={`${money(stake)} sur ${p.team}`} onClick={() => setSave(true)} />}

        {signals.length > 0 && (
          <div className="card tight stack" style={{ gap: 8 }}>
            <b>Les signaux</b>
            {signals.map((t) => (
              <div key={t} className="small">
                {t}
              </div>
            ))}
          </div>
        )}
        {(p.reasonsFor.length > 0 || p.reasonsAgainst.length > 0) && (
          <div className="card tight stack" style={{ gap: 6 }}>
            {p.reasonsFor.map((t) => (
              <div key={t} className="small">
                <span style={{ color: 'var(--green)' }}>👍</span> {t}
              </div>
            ))}
            {p.reasonsAgainst.map((t) => (
              <div key={t} className="small">
                <span style={{ color: 'var(--red)' }}>👎</span> {t}
              </div>
            ))}
          </div>
        )}

        <Explain q="Corriger les cotes">
          <div className="stack" style={{ gap: 8, marginTop: 6 }}>
            <NumberField label={`Cote de ${p.team} chez ton bookmaker`} value={p.odds} onChange={(v) => actions.updatePick(p.id, { odds: v })} />
            <div className="grid3">
              <NumberField label="Pinnacle outsider" value={p.pinnacle.out} onChange={(v) => actions.updatePick(p.id, { pinnacle: { ...p.pinnacle, out: v } })} />
              <NumberField label="Pinnacle nul" value={p.pinnacle.draw} onChange={(v) => actions.updatePick(p.id, { pinnacle: { ...p.pinnacle, draw: v } })} />
              <NumberField label="Pinnacle favori" value={p.pinnacle.fav} onChange={(v) => actions.updatePick(p.id, { pinnacle: { ...p.pinnacle, fav: v } })} />
            </div>
            <button className="btn small" onClick={() => openUrl(`https://www.google.com/search?q=${encodeURIComponent(`oddsportal ${p.home} ${p.away}`)}`)}>
              Voir les cotes Pinnacle sur OddsPortal
            </button>
          </div>
        </Explain>

        {p.sources.length > 0 && (
          <div className="tiny faint">
            Sources trouvées par Claude :{' '}
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
            if (await ask({ title: 'Retirer cet outsider ?', confirm: 'Retirer', tone: 'danger' })) {
              actions.deletePick(p.id);
              onClose();
            }
          }}
        >
          <IconTrash size={16} /> Retirer de la liste
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
