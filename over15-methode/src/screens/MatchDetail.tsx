import { useState } from 'react';
import { buildMatchPrompt, mergeMatch } from '../lib/claude';
import { FetchFlow } from './FetchFlow';
import { actions, useStore } from '../lib/store';
import { analyze, CONTEXT_LABEL, VERDICT_COLOR } from '../lib/method';
import { fixedStake, nextBetIsTest } from '../lib/stats';
import { money, num, odds as fmtOdds } from '../lib/format';
import type { Context, MatchData, TeamData } from '../lib/types';
import { haptic, openUrl } from '../lib/native';
import { ask, BigButton, Explain, Guide, NumberField, Sheet, StatusIcon, toast } from '../components/ui';
import { IconBolt, IconSpark, IconTrash } from '../components/Icons';

const STATUS_WORD = { ok: 'Oui ✓', warn: 'Moyen', fail: 'Non ✗', unknown: 'On ne sait pas' } as const;

export function MatchDetail({ id, onClose, goLive }: { id: string | null; onClose: () => void; goLive: () => void }) {
  const m = useStore((st) => st.matches.find((x) => x.id === id) ?? null);
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const live = useStore((st) => st.live);
  const [edit, setEdit] = useState(false);
  const [complete, setComplete] = useState(false);
  if (!m) return null;
  const a = analyze(m, s);
  const missing = a.criteria.filter((c) => c.status === 'unknown').length;
  const stake = fixedStake(bets, s, nextBetIsTest(bets, s));
  const color = VERDICT_COLOR[a.verdict];

  const follow = async () => {
    if (live && live.stage !== 'fini' && live.matchId !== m.id) {
      const ok = await ask({ title: 'Un autre match est déjà suivi', message: `Tu suis déjà « ${live.label} ». Le remplacer par ce match ?`, confirm: 'Oui, suivre ce match' });
      if (!ok) return;
    }
    haptic.success();
    actions.setLive({
      matchId: m.id,
      label: `${m.home.name} – ${m.away.name}`,
      competition: m.competition,
      lambda: a.lambda,
      verdict: a.verdict,
      kickoffAt: null,
      stage: 'attente',
      betId: null,
      q: 'score',
    });
    onClose();
    goLive();
  };

  const plan =
    a.verdict === 'RED'
      ? [<>On <b>ne joue pas</b> ce match.</>, <>Choisis un autre match <b style={{ color: 'var(--green)' }}>vert</b>, ou ne joue pas aujourd'hui. Passer son tour, c'est aussi ça, la méthode.</>]
      : [
          ...(missing ? [<>Il manque des infos : touche <b>« Compléter avec Claude »</b> juste en dessous.</>] : []),
          ...(a.verdict === 'ORANGE' && !missing ? [<>D'abord, vérifie le point <b style={{ color: 'var(--orange)' }}>orange</b> plus bas. Dans le doute, on ne joue pas.</>] : []),
          <>Ne parie <b>pas</b> avant le match : la cote est trop basse.</>,
          <>Au coup d'envoi{m.time ? ` (${m.time})` : ''}, touche <b>« Suivre ce match en live »</b> puis <b>« Coup d'envoi »</b>.</>,
          <>Vers la <b>{s.entryFrom}e–{s.entryTo}e minute</b>, l'app te pose 3 questions : 0-0 ? match animé ? quelle cote ?</>,
          <>Si tout est bon : mise <b>{money(stake)}</b> sur <b>« Plus de 1,5 but »</b>.</>,
          <>Au premier but, touche <b>BUT !</b> : l'app te dit comment gagner à coup sûr.</>,
        ];

  return (
    <Sheet open={!!m} onClose={onClose}>
      <div className="stack">
        <div className="center">
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
            {m.competition}
            {m.time ? ` · ${m.time}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 26, lineHeight: 1.1, marginTop: 4 }}>
            {m.home.name}
            <span className="muted"> – </span>
            {m.away.name}
          </div>
          <div className={`big-light ${a.verdict}`} style={{ marginTop: 14 }} />
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 30, color, marginTop: 12, letterSpacing: 0.5 }}>{a.headline}</div>
          <div className="small muted" style={{ marginTop: 4 }}>{a.reason}</div>
        </div>

        <Guide title="Le plan pour ce match" tone={a.verdict === 'GREEN' ? 'green' : a.verdict === 'ORANGE' ? 'orange' : 'red'} steps={plan} />

        {missing > 0 && (
          <BigButton icon={<IconSpark size={24} />} title="Compléter avec Claude" sub={`${missing} info(s) manquante(s) : Claude les cherche pour ce match`} onClick={() => setComplete(true)} />
        )}
        {a.verdict !== 'RED' ? (
          <BigButton icon={<IconBolt size={24} />} title="Suivre ce match en live" sub="À faire au coup d'envoi" onClick={follow} tone={missing ? 'plain' : 'primary'} />
        ) : (
          <button className="btn ghost block small" onClick={follow}>
            Le suivre quand même (déconseillé)
          </button>
        )}

        <div className="section-title">Les 4 critères de la méthode</div>
        {a.criteria.map((c, i) => (
          <div key={c.key} className="card tight stack" style={{ gap: 8 }}>
            <div className="row">
              <StatusIcon status={c.status} />
              <b className="grow">
                {i + 1}. {c.title}
              </b>
              <span className={`chip ${c.status === 'ok' ? 'green' : c.status === 'fail' ? 'red' : c.status === 'warn' ? 'orange' : 'blue'}`}>{STATUS_WORD[c.status]}</span>
            </div>
            <div className="small">{c.detail}</div>
            <Explain q="Pourquoi c'est important ?">{c.simple}</Explain>
          </div>
        ))}

        <div className="section-title">Bonus</div>
        <div className="card tight stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="small muted">Buts attendus dans ce match</span>
            <b style={{ fontFamily: 'var(--display)', fontSize: 24 }}>{num(a.lambda, 1)}</b>
          </div>
          {a.h2h.n > 0 && (
            <div className="row between">
              <span className="small muted">Derniers matchs entre eux avec 2 buts ou plus</span>
              <b>
                {a.h2h.over} sur {a.h2h.n}
              </b>
            </div>
          )}
          {m.preOdds !== null && (
            <div className="small muted">
              Cote avant le match : <b style={{ color: 'var(--text)' }}>{fmtOdds(m.preOdds)}</b>. C'est pour ça qu'on attend le live : la cote sera plus haute.
            </div>
          )}
        </div>

        <div className="grid2">
          <button className="btn" onClick={() => setEdit(true)}>
            Corriger une info
          </button>
          <button className="btn" onClick={() => setComplete(true)}>
            Redemander à Claude
          </button>
        </div>
        {m.sources.length > 0 && (
          <div className="tiny faint">
            Sources trouvées par Claude :{' '}
            {m.sources.map((u, i) => (
              <button key={u + i} className="tiny" style={{ color: 'var(--blue)', textDecoration: 'underline', marginRight: 8 }} onClick={() => openUrl(u)}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
        <button
          className="btn ghost block small"
          onClick={async () => {
            if (await ask({ title: 'Retirer ce match de la liste ?', confirm: 'Retirer', tone: 'danger' })) {
              actions.deleteMatch(m.id);
              onClose();
            }
          }}
        >
          <IconTrash size={16} /> Retirer ce match
        </button>
      </div>
      {edit && <EditMatch m={m} onClose={() => setEdit(false)} />}
      {complete && (
        <Sheet open onClose={() => setComplete(false)} title="Compléter avec Claude" top>
          <div className="stack">
            <Guide steps={[<>Fais les 5 étapes, comme d'habitude.</>, <>Cette fois, Claude cherche <b>seulement ce match</b> : il trouve plus d'infos.</>, <>L'app ajoute ce qui manquait et recalcule le feu.</>]} />
            <FetchFlow
              fallbackDate={m.date}
              buildPrompt={() => buildMatchPrompt(m.home.name, m.away.name, m.date)}
              onImported={(ms) => {
                const fresh = ms[0];
                if (fresh) actions.updateMatch(m.id, mergeMatch(m, fresh));
                setComplete(false);
                toast('Match complété ✓');
              }}
            />
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

function TeamEditor({ t, onChange }: { t: TeamData; onChange: (t: TeamData) => void }) {
  return (
    <div className="card tight stack" style={{ gap: 10 }}>
      <b>{t.name}</b>
      <div className="grid2">
        <NumberField label="Matchs joués" value={t.played} onChange={(v) => onChange({ ...t, played: v })} />
        <NumberField label="Matchs avec 2 buts ou +" value={t.over15} onChange={(v) => onChange({ ...t, over15: v })} />
        <NumberField label="Buts marqués" value={t.scored} onChange={(v) => onChange({ ...t, scored: v })} />
        <NumberField label="Buts encaissés" value={t.conceded} onChange={(v) => onChange({ ...t, conceded: v })} />
      </div>
      {t.scorers.map((sc, i) => (
        <div key={sc.name + i} className="row">
          <span className="grow small">
            {sc.name}
            {sc.goals !== null ? ` (${sc.goals} buts)` : ''}
          </span>
          {([true, null, false] as const).map((v) => (
            <button
              key={String(v)}
              className={`chip ${sc.available === v ? (v === true ? 'green' : v === false ? 'red' : 'blue') : ''}`}
              onClick={() => onChange({ ...t, scorers: t.scorers.map((x, j) => (j === i ? { ...x, available: v } : x)) })}
            >
              {v === true ? 'Joue' : v === false ? 'Absent' : '?'}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function EditMatch({ m, onClose }: { m: MatchData; onClose: () => void }) {
  const [draft, setDraft] = useState<MatchData>(structuredClone(m));
  const contexts: Context[] = ['normal', 'derby', 'finale', 'maintien', 'montee', 'sans_enjeu', 'inconnu'];
  return (
    <Sheet open onClose={onClose} title="Corriger une info" top>
      <div className="stack">
        <Guide steps={[<>Change seulement ce qui est faux.</>, <>Touche <b>Enregistrer</b> : le feu se recalcule tout seul.</>]} />
        <TeamEditor t={draft.home} onChange={(home) => setDraft({ ...draft, home })} />
        <TeamEditor t={draft.away} onChange={(away) => setDraft({ ...draft, away })} />
        <div className="label">Contexte du match</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {contexts.map((c) => (
            <button key={c} className={`chip ${draft.context === c ? 'green' : ''}`} style={{ padding: '8px 11px', fontSize: 12 }} onClick={() => setDraft({ ...draft, context: c })}>
              {CONTEXT_LABEL[c]}
            </button>
          ))}
        </div>
        <button
          className="btn primary block"
          onClick={() => {
            actions.updateMatch(m.id, draft);
            haptic.success();
            toast('Corrigé ✓');
            onClose();
          }}
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

