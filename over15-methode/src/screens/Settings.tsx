import { useRef, useState } from 'react';
import { actions, getState, useStore } from '../lib/store';
import { DEFAULT_SETTINGS } from '../lib/defaults';
import { exportBackup, parseBackup } from '../lib/backup';
import { cacheInfo, clearCache, getQuota } from '../lib/api/cache';
import { getProvider } from '../lib/api';
import { STEPS } from '../lib/method';
import { money, num } from '../lib/format';
import { testCount } from '../lib/stats';
import type { ProviderId, Weights } from '../lib/types';
import { haptic, openUrl } from '../lib/native';
import { ask, Banner, NumberField, Segmented, Stepper, toast, ToggleRow } from '../components/ui';
import { IconDownload, IconExternal, IconRefresh, IconUpload } from '../components/Icons';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="card stack" style={{ gap: 12 }}>
        {children}
      </div>
    </>
  );
}

export function Settings() {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const set = actions.updateSettings;
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importText, setImportText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [, force] = useState(0);
  const totalW = Object.values(s.weights).reduce((a, b) => a + b, 0) || 1;
  const quota = getQuota();
  const cache = cacheInfo();
  const tc = testCount(bets);

  const setWeight = (k: keyof Weights, v: number) => set({ weights: { ...s.weights, [k]: v } });

  const check = async () => {
    const p = getProvider(getState().settings);
    if (!p) {
      setCheckMsg({ ok: false, text: 'Choisis une API et colle ta clé.' });
      return;
    }
    setChecking(true);
    setCheckMsg(null);
    try {
      const msg = await p.check();
      setCheckMsg({ ok: true, text: msg });
      haptic.success();
    } catch (e) {
      setCheckMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
      haptic.error();
    } finally {
      setChecking(false);
    }
  };

  const doImport = async (text: string) => {
    try {
      const data = parseBackup(text);
      const ok = await ask({
        title: 'Importer cette sauvegarde ?',
        message: `${data.bets.length} pari(s), ${data.leagues.length} championnat(s). Tes données actuelles seront remplacées (une copie de secours est gardée).`,
        confirm: 'Importer',
        tone: 'danger',
      });
      if (!ok) return;
      actions.replaceAll({ ...data, settings: { ...data.settings, ageConfirmed: true } });
      setImportText('');
      haptic.success();
      toast('Sauvegarde importée');
    } catch (e) {
      haptic.error();
      toast(e instanceof Error ? e.message : 'Import impossible', 'err');
    }
  };

  return (
    <div className="stack">
      <Section title="Bankroll et mises">
        <NumberField label="Bankroll de départ" value={s.bankrollInitial} onChange={(v) => v !== null && v >= 0 && set({ bankrollInitial: v })} suffix="€" min={0} />
        <div className="field">
          <label>Mise fixe : {num(s.stakePct, 1)} % de la bankroll</label>
          <Stepper value={s.stakePct} min={0.5} max={10} step={0.5} onChange={(v) => set({ stakePct: v })} format={(v) => `${num(v, 1)} %`} />
          <span className="tiny faint">Soit {money((s.bankrollInitial * s.stakePct) / 100)} sur une bankroll de {money(s.bankrollInitial)}. Steven conseille une mise fixe, jamais de « remontée ».</span>
        </div>
        <div className="field">
          <label>Limite de pertes par semaine : {s.weeklyLossLimitPct} % de la bankroll</label>
          <Stepper value={s.weeklyLossLimitPct} min={0} max={50} step={1} onChange={(v) => set({ weeklyLossLimitPct: v })} format={(v) => (v === 0 ? 'Aucune' : `${v} %`)} />
          <span className="tiny faint">Au-delà, l'app bloque les paris réels jusqu'au lundi suivant.</span>
        </div>
      </Section>

      <Section title="Mode TEST">
        <ToggleRow
          title="Mode TEST (paris fictifs)"
          desc={`Les ${s.testBetsTarget} premiers paris sont fictifs, pour s'entraîner. Fait : ${tc}/${s.testBetsTarget}.`}
          on={s.testMode}
          onChange={async (v) => {
            if (!v && tc < s.testBetsTarget) {
              const ok = await ask({ title: 'Arrêter l\'entraînement ?', message: `Tu n'as fait que ${tc} paris fictifs sur ${s.testBetsTarget}. Steven conseille de s'entraîner avant de miser de l'argent réel.`, confirm: 'Passer en réel', tone: 'danger' });
              if (!ok) return;
            }
            set({ testMode: v });
          }}
        />
        <div className="field">
          <label>Nombre de paris d'entraînement</label>
          <Stepper value={s.testBetsTarget} min={5} max={100} step={5} onChange={(v) => set({ testBetsTarget: v })} />
        </div>
      </Section>

      <Section title="Pondérations du score">
        <div className="tiny faint" style={{ marginTop: -4 }}>Poids de chaque étape dans le score sur 100 (normalisé automatiquement).</div>
        {STEPS.map((st, i) => (
          <div key={st.key} className="field">
            <label className="row between">
              <span>
                {i + 1}. {st.title}
              </span>
              <b style={{ color: 'var(--text)' }}>{Math.round((s.weights[st.key] / totalW) * 100)} pts</b>
            </label>
            <input className="range" type="range" min={0} max={40} step={1} value={s.weights[st.key]} onChange={(e) => setWeight(st.key, Number(e.target.value))} aria-label={st.title} />
          </div>
        ))}
        <div className="grid2">
          <NumberField label="Vert à partir de" value={s.greenMin} onChange={(v) => v !== null && set({ greenMin: v })} suffix="/100" min={0} max={100} />
          <NumberField label="Orange à partir de" value={s.orangeMin} onChange={(v) => v !== null && set({ orangeMin: v })} suffix="/100" min={0} max={100} />
        </div>
        <button className="btn small ghost" onClick={() => set({ weights: { ...DEFAULT_SETTINGS.weights }, greenMin: DEFAULT_SETTINGS.greenMin, orangeMin: DEFAULT_SETTINGS.orangeMin })}>
          <IconRefresh size={15} /> Valeurs par défaut
        </button>
      </Section>

      <Section title="Critères de la méthode">
        <div className="grid2">
          <NumberField label="Buts marqués mini / match" value={s.teamMinScored} onChange={(v) => v !== null && set({ teamMinScored: v })} />
          <NumberField label="Buts encaissés mini / match" value={s.teamMinConceded} onChange={(v) => v !== null && set({ teamMinConceded: v })} />
        </div>
        <NumberField label="% +1.5 mini à domicile / extérieur" value={s.homeAwayMin} onChange={(v) => v !== null && set({ homeAwayMin: v })} suffix="%" min={0} max={100} />
        <div className="grid2">
          <NumberField label="Cote mini" value={s.oddsMin} onChange={(v) => v !== null && set({ oddsMin: v })} />
          <NumberField label="Cote maxi" value={s.oddsMax} onChange={(v) => v !== null && set({ oddsMax: v })} />
        </div>
        <div className="label" style={{ marginTop: 4 }}>Critères bloquants (→ rouge)</div>
        <div>
          <ToggleRow title="Buteur clé absent" desc="Toujours bloquant (règle de la méthode)." on onChange={() => toast('Ce critère est toujours bloquant', 'warn')} />
          <ToggleRow title="Championnat hors méthode" on={s.blocking.outOfMethod} onChange={(v) => set({ blocking: { ...s.blocking, outOfMethod: v } })} />
          <ToggleRow title="Équipes qui ne marquent ET n'encaissent pas" on={s.blocking.teams} onChange={(v) => set({ blocking: { ...s.blocking, teams: v } })} />
          <ToggleRow title="Championnat sous le seuil" on={s.blocking.belowThreshold} onChange={(v) => set({ blocking: { ...s.blocking, belowThreshold: v } })} />
          <ToggleRow title="Confrontations aux petits scores" on={s.blocking.h2hLow} onChange={(v) => set({ blocking: { ...s.blocking, h2hLow: v } })} />
          <ToggleRow title="Cote hors fourchette" on={s.blocking.oddsOutOfRange} onChange={(v) => set({ blocking: { ...s.blocking, oddsOutOfRange: v } })} />
        </div>
      </Section>

      <Section title="Données automatiques (API)">
        <div className="small muted">Optionnel : sans clé, l'app fonctionne entièrement hors ligne en saisie manuelle.</div>
        <Segmented<ProviderId>
          value={s.provider}
          onChange={(v) => { set({ provider: v }); setCheckMsg(null); }}
          options={[
            { value: 'none', label: 'Aucune' },
            { value: 'apifootball', label: 'API-Football' },
            { value: 'footballdata', label: 'football-data' },
          ]}
        />
        {s.provider !== 'none' && (
          <>
            <div className="field">
              <label>Clé API</label>
              <input className="input" value={s.apiKey} onChange={(e) => set({ apiKey: e.target.value.trim() })} placeholder="Colle ta clé ici" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </div>
            {s.provider === 'apifootball' ? (
              <Banner tone="blue">
                <b>API-Football</b> (api-sports.io) : offre gratuite de 100 requêtes par jour, avec matchs, stats, <b>blessés</b>, confrontations et cotes. Une analyse coûte environ 5 à 6 requêtes, beaucoup moins grâce au cache.
                <div style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={() => openUrl('https://dashboard.api-football.com/register')}>
                    Créer ma clé gratuite <IconExternal />
                  </button>
                </div>
                <div className="tiny faint" style={{ marginTop: 6 }}>Si l'offre gratuite refuse la saison en cours, l'app te le dira : passe alors sur football-data.org.</div>
              </Banner>
            ) : (
              <Banner tone="blue">
                <b>football-data.org</b> : offre gratuite avec les 5 grands championnats (matchs, résultats, buteurs, confrontations), 10 requêtes par minute. Pas de blessés ni de cotes : à vérifier sur Transfermarkt / Flashscore.
                <div style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={() => openUrl('https://www.football-data.org/client/register')}>
                    Créer ma clé gratuite <IconExternal />
                  </button>
                </div>
              </Banner>
            )}
            <button className="btn block" disabled={checking || !s.apiKey} onClick={check}>
              <IconRefresh className={checking ? 'spin' : ''} /> Tester la clé
            </button>
            {checkMsg && <Banner tone={checkMsg.ok ? 'green' : 'red'}>{checkMsg.text}</Banner>}
            <div className="row between small muted">
              <span>
                Requêtes aujourd'hui : <b style={{ color: 'var(--text)' }}>{quota.used}</b>
                {quota.remaining !== undefined && s.provider === 'apifootball' ? ` · reste ${quota.remaining}` : ''}
              </span>
              <span>Cache : {cache.entries} · {cache.kb} Ko</span>
            </div>
            <button className="btn small ghost" onClick={() => { clearCache(); force((x) => x + 1); toast('Cache vidé'); }}>
              Vider le cache
            </button>
          </>
        )}
      </Section>

      <Section title="Sauvegarde">
        <button
          className="btn block"
          onClick={async () => {
            try {
              const r = await exportBackup(getState());
              toast(r === 'shared' ? 'Choisis où enregistrer le fichier' : 'Fichier téléchargé');
            } catch (e) {
              if (e instanceof Error && /cancel/i.test(e.message)) return;
              toast('Export impossible : ' + (e instanceof Error ? e.message : e), 'err');
            }
          }}
        >
          <IconDownload /> Exporter mes données (JSON)
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>
          <IconUpload /> Importer un fichier JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/plain"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) await doImport(await f.text());
          }}
        />
        <details>
          <summary className="small muted" style={{ padding: '4px 0' }}>Ou coller le contenu JSON</summary>
          <textarea className="input" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"app":"over15-methode", …}' style={{ marginTop: 8 }} />
          <button className="btn small block" style={{ marginTop: 8 }} disabled={!importText.trim()} onClick={() => doImport(importText)}>
            Importer le texte
          </button>
        </details>
        <button
          className="btn danger block small"
          onClick={async () => {
            if (await ask({ title: 'Tout effacer ?', message: 'Paris, réglages et ligues reviennent à zéro. Pense à exporter avant.', confirm: 'Tout effacer', tone: 'danger' })) {
              actions.resetAll();
              toast('Données remises à zéro');
            }
          }}
        >
          Remettre l'application à zéro
        </button>
      </Section>

      <Section title="Confort">
        <ToggleRow title="Retours haptiques" desc="Vibrations légères aux validations." on={s.haptics} onChange={(v) => set({ haptics: v })} />
        <ToggleRow title="Animation d'ouverture" desc="Le ballon et le logo +1.5 au lancement." on={s.intro} onChange={(v) => set({ intro: v })} />
      </Section>

      <Section title="Jeu responsable">
        <div className="row">
          <span className="logo-mini" style={{ background: 'var(--red)', color: '#fff', boxShadow: 'none' }}>18+</span>
          <div className="grow small">
            <b>Interdit aux mineurs.</b> Les paris sportifs comportent des risques : endettement, isolement, dépendance. Aucune méthode ne gagne à tous les coups.
          </div>
        </div>
        <button className="btn block" onClick={() => openUrl('https://www.joueurs-info-service.fr/')}>
          Joueurs Info Service <IconExternal />
        </button>
        <button className="btn block ghost" onClick={() => openUrl('tel:0974751313')}>
          Appeler le 09 74 75 13 13 (appel non surtaxé)
        </button>
        <div className="tiny faint">Méthode inspirée des conseils de Steven (Team Soccer Bet). Application indépendante, non affiliée. Version {__APP_VERSION__}.</div>
      </Section>
    </div>
  );
}
