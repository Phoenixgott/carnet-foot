import { useState } from 'react';
import { actions, getState, useStore } from '../lib/store';
import { DEFAULT_LEAGUES, uid } from '../lib/defaults';
import { getProvider, refreshLeaguePct } from '../lib/api';
import type { League } from '../lib/types';
import { haptic } from '../lib/native';
import { ask, Banner, NumberField, Sheet, Stepper, TextField, toast, Toggle, ToggleRow } from '../components/ui';
import { IconPlus, IconRefresh, IconTrash } from '../components/Icons';

export function Leagues() {
  const leagues = useStore((s) => s.leagues);
  const s = useStore((st) => st.settings);
  const t = s.leagueThreshold;
  const provider = getProvider(s);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const sorted = [...leagues].sort((a, b) => Number(b.inMethod) - Number(a.inMethod) || b.pct - a.pct);
  const inCount = leagues.filter((l) => l.inMethod && l.pct >= t).length;

  const refresh = async () => {
    if (!provider) return;
    setBusy(true);
    let ok = 0;
    const errs: string[] = [];
    for (const l of leagues) {
      try {
        const r = await refreshLeaguePct(provider, l);
        if (r) {
          actions.updateLeague(l.id, { apiPct: r.pct, apiSample: r.n, apiAt: Date.now() });
          ok++;
        }
      } catch (e) {
        errs.push(`${l.name} : ${e instanceof Error ? e.message : e}`);
      }
    }
    setBusy(false);
    if (errs.length) {
      haptic.warning();
      toast(errs[0], 'warn');
    } else {
      haptic.success();
      toast(`${ok} championnat(s) actualisé(s)`);
    }
  };

  return (
    <div className="stack">
      <div className="card hero">
        <div className="row between">
          <span className="label">SEUIL DE LA MÉTHODE</span>
          <span className="chip green">{inCount} ligue(s) au-dessus</span>
        </div>
        <div className="big-number" style={{ marginTop: 4 }}>{t} %</div>
        <div className="small muted">de matchs avec au moins 2 buts sur 90 minutes</div>
        <input className="range" type="range" min={60} max={95} step={1} value={t} onChange={(e) => actions.updateSettings({ leagueThreshold: Number(e.target.value) })} onPointerUp={() => haptic.tap()} aria-label="Seuil" />
        <div className="row between tiny faint">
          <span>60 %</span>
          <span>Défaut 85 %</span>
          <span>95 %</span>
        </div>
      </div>

      {provider && (
        <button className="btn block" disabled={busy} onClick={refresh}>
          <IconRefresh className={busy ? 'spin' : ''} /> Calculer la saison en cours via {provider.label}
        </button>
      )}

      {sorted.map((l) => (
        <LeagueCard key={l.id} l={l} threshold={t} />
      ))}

      <button className="btn block" onClick={() => setAddOpen(true)}>
        <IconPlus /> Ajouter un championnat
      </button>
      <button
        className="btn ghost block small"
        onClick={async () => {
          if (await ask({ title: 'Réinitialiser les ligues ?', message: 'Les 5 championnats reprennent leurs valeurs de référence (Ligue 1 89 %, Bundesliga 87 %, Premier League 81 %, Serie A 78 %, Liga 75 %). Les championnats ajoutés sont conservés.', confirm: 'Réinitialiser' })) {
            const custom = leagues.filter((l) => !l.builtin);
            actions.setLeagues([...structuredClone(DEFAULT_LEAGUES), ...custom]);
            toast('Valeurs de référence restaurées');
          }
        }}
      >
        Restaurer les valeurs de référence
      </button>
      <AddLeague open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function LeagueCard({ l, threshold }: { l: League; threshold: number }) {
  const ok = l.inMethod && l.pct >= threshold;
  const color = !l.inMethod ? 'var(--faint)' : ok ? 'var(--green)' : 'var(--orange)';
  return (
    <div className="card tight stack" style={{ gap: 10, opacity: l.inMethod ? 1 : 0.85 }}>
      <div className="row">
        <span style={{ fontSize: 26 }}>{l.flag}</span>
        <div className="grow">
          <b style={{ fontSize: 16 }}>{l.name}</b>
          <div className="tiny muted">{l.country}</div>
        </div>
        {!l.inMethod ? <span className="chip">Hors méthode</span> : ok ? <span className="chip green">Dans la méthode</span> : <span className="chip orange">Sous le seuil</span>}
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <span className="big-number" style={{ fontSize: 40, color }}>{l.pct}%</span>
        <div className="grow" style={{ paddingBottom: 8 }}>
          <div style={{ position: 'relative' }}>
            <div className={`progress ${ok ? '' : 'red'}`} style={{ height: 10 }}>
              <div style={{ width: `${l.pct}%` }} />
            </div>
            <div style={{ position: 'absolute', left: `${threshold}%`, top: -4, bottom: -4, width: 2, background: 'var(--text)', opacity: 0.6 }} />
          </div>
        </div>
      </div>
      <Stepper value={l.pct} min={0} max={100} onChange={(v) => actions.updateLeague(l.id, { pct: v })} format={(v) => `${v} %`} />
      {l.apiPct !== undefined && (
        <div className="row small">
          <span className="grow muted">
            Saison en cours (API) : <b style={{ color: 'var(--text)' }}>{l.apiPct} %</b> sur {l.apiSample} matchs
          </span>
          {l.apiPct !== l.pct && (
            <button className="chip blue" onClick={() => { haptic.tap(); actions.updateLeague(l.id, { pct: l.apiPct! }); }}>
              Utiliser
            </button>
          )}
        </div>
      )}
      <div className="row">
        <span className="grow small muted">Inclus dans la méthode</span>
        <Toggle on={l.inMethod} onChange={(v) => actions.updateLeague(l.id, { inMethod: v })} label="Inclus dans la méthode" />
        {!l.builtin && (
          <button
            className="icon-btn"
            aria-label="Supprimer"
            onClick={async () => {
              if (await ask({ title: `Supprimer ${l.name} ?`, confirm: 'Supprimer', tone: 'danger' })) actions.setLeagues(getState().leagues.filter((x) => x.id !== l.id));
            }}
          >
            <IconTrash />
          </button>
        )}
      </div>
    </div>
  );
}

function AddLeague({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [flag, setFlag] = useState('🏳️');
  const [p, setP] = useState<number | null>(null);
  const [inMethod, setInMethod] = useState(false);
  const [afId, setAfId] = useState<number | null>(null);
  const [fdCode, setFdCode] = useState('');
  const save = () => {
    if (!name.trim() || p === null) {
      toast('Nom et % obligatoires', 'warn');
      return;
    }
    const l: League = { id: uid(), name: name.trim(), country: country.trim(), flag: flag || '🏳️', pct: Math.round(p), inMethod, builtin: false, apiFootballId: afId ?? undefined, footballDataCode: fdCode.trim().toUpperCase() || undefined };
    actions.setLeagues([...getState().leagues, l]);
    haptic.success();
    toast(`${l.name} ajouté`);
    setName('');
    setCountry('');
    setP(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Nouveau championnat">
      <div className="stack" style={{ gap: 12 }}>
        <Banner tone="orange">Une ligue « exotique » est <b>hors méthode</b> par défaut : son verdict sera rouge (réglable dans Réglages → Critères bloquants).</Banner>
        <div className="grid2">
          <TextField label="Nom" value={name} onChange={setName} placeholder="Eredivisie" />
          <TextField label="Pays" value={country} onChange={setCountry} placeholder="Pays-Bas" />
        </div>
        <div className="grid2">
          <TextField label="Drapeau (emoji)" value={flag} onChange={setFlag} />
          <NumberField label="% +1.5 (90 min)" value={p} onChange={setP} suffix="%" min={0} max={100} />
        </div>
        <ToggleRow title="Inclure dans la méthode" desc="À réserver aux championnats que tu connais bien." on={inMethod} onChange={setInMethod} />
        <div className="grid2">
          <NumberField label="ID API-Football (option)" value={afId} onChange={setAfId} />
          <TextField label="Code football-data (option)" value={fdCode} onChange={setFdCode} placeholder="DED" />
        </div>
        <button className="btn primary block" onClick={save}>
          Ajouter
        </button>
      </div>
    </Sheet>
  );
}
