import { useRef, useState } from 'react';
import { actions, getState, useStore } from '../lib/store';
import { DEFAULT_BOOKMAKERS, DEFAULT_COMPETITIONS, DEFAULT_SETTINGS } from '../lib/defaults';
import { exportBackup, parseBackup } from '../lib/backup';
import { money, num, odds as fmtOdds } from '../lib/format';
import { signedPct } from '../lib/value';
import { testCount } from '../lib/stats';
import { haptic, openUrl } from '../lib/native';
import { ask, Explain, NumberField, Stepper, toast, ToggleRow } from '../components/ui';
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

export function Settings({ goLearn }: { goLearn: () => void }) {
  const s = useStore((st) => st.settings);
  const bets = useStore((st) => st.bets);
  const set = actions.updateSettings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importText, setImportText] = useState('');
  const tc = testCount(bets);

  const doImport = async (text: string) => {
    try {
      const data = parseBackup(text);
      const ok = await ask({
        title: 'Remplacer par cette sauvegarde ?',
        message: `${data.bets.length} pari(s) dans ce fichier. Tes données actuelles seront remplacées (une copie de secours est gardée).`,
        confirm: 'Importer',
        tone: 'danger',
      });
      if (!ok) return;
      actions.replaceAll({ ...data, settings: { ...data.settings, ageConfirmed: true } });
      setImportText('');
      haptic.success();
      toast('Sauvegarde importée ✓');
    } catch (e) {
      haptic.error();
      toast(e instanceof Error ? e.message : 'Import impossible', 'err');
    }
  };

  return (
    <div className="stack">
      <Section title="Mon argent">
        <NumberField label="Combien j'ai pour parier (bankroll)" value={s.bankrollInitial} onChange={(v) => v !== null && v >= 0 && set({ bankrollInitial: v })} suffix="€" min={0} />
        <div className="field">
          <label>Ma mise : {num(s.stakePct, 1)} % de mon argent</label>
          <Stepper value={s.stakePct} min={0.5} max={10} step={0.5} onChange={(v) => set({ stakePct: v })} format={(v) => `${num(v, 1)} %`} />
          <span className="tiny faint">Soit environ {money((s.bankrollInitial * s.stakePct) / 100)} par pari. Toujours la même mise. Pour les outsiders, 1 % est conseillé : on perd souvent plusieurs fois de suite.</span>
        </div>
        <div className="field">
          <label>Limite de pertes par semaine</label>
          <Stepper value={s.weeklyLossLimitPct} min={0} max={50} step={1} onChange={(v) => set({ weeklyLossLimitPct: v })} format={(v) => (v === 0 ? 'Aucune' : `${v} %`)} />
          <span className="tiny faint">Au-delà, l'app bloque les paris pour de vrai jusqu'au lundi.</span>
        </div>
      </Section>

      <Section title="Entraînement">
        <ToggleRow
          title="Paris pour de faux d'abord"
          desc={`Les ${s.testBetsTarget} premiers paris sont pour de faux. Fait : ${tc}/${s.testBetsTarget}.`}
          on={s.testMode}
          onChange={async (v) => {
            if (!v && tc < s.testBetsTarget) {
              const ok = await ask({ title: 'Arrêter l\'entraînement ?', message: `Tu n'as fait que ${tc} paris pour de faux sur ${s.testBetsTarget}. Mieux vaut s'entraîner avant de miser de l'argent.`, confirm: 'Passer pour de vrai', tone: 'danger' });
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

      <Section title="Règles de la value">
        <div className="field">
          <label>« OK » à partir d'une value de {signedPct(s.valueMin)}</label>
          <Stepper value={Math.round(s.valueMin * 100)} min={0} max={30} onChange={(v) => set({ valueMin: v / 100 })} format={(v) => `+${v} %`} />
        </div>
        <div className="field">
          <label>Un outsider, c'est une cote d'au moins {fmtOdds(s.minOdds)}</label>
          <Stepper value={s.minOdds} min={2} max={10} step={0.5} onChange={(v) => set({ minOdds: v })} format={(v) => fmtOdds(v)} />
        </div>
        <div className="field">
          <label>Nombre d'outsiders par recherche</label>
          <Stepper value={s.maxPicks} min={3} max={12} onChange={(v) => set({ maxPicks: v })} />
        </div>
        <Explain q="Réglages avancés">
          <div className="stack" style={{ gap: 10, marginTop: 6 }}>
            <NumberField label="Marge Pinnacle retirée (une seule cote), en %" value={Math.round(s.pinnacleMargin * 1000) / 10} onChange={(v) => v !== null && v >= 0 && v < 15 && set({ pinnacleMargin: v / 100 })} suffix="%" />
            <div className="field">
              <label>Bookmakers à comparer</label>
              <input className="input" value={s.bookmakers} onChange={(e) => set({ bookmakers: e.target.value })} />
            </div>
            <div className="field">
              <label>Compétitions que Claude doit chercher</label>
              <textarea className="input" style={{ fontFamily: 'var(--body)', fontSize: 14, minHeight: 90 }} value={s.competitions} onChange={(e) => set({ competitions: e.target.value })} />
            </div>
            <button
              className="btn small ghost"
              onClick={() => set({ valueMin: DEFAULT_SETTINGS.valueMin, minOdds: DEFAULT_SETTINGS.minOdds, pinnacleMargin: DEFAULT_SETTINGS.pinnacleMargin, maxPicks: DEFAULT_SETTINGS.maxPicks, competitions: DEFAULT_COMPETITIONS, bookmakers: DEFAULT_BOOKMAKERS })}
            >
              <IconRefresh size={15} /> Remettre les règles par défaut
            </button>
          </div>
        </Explain>
      </Section>

      <Section title="Sauvegarde">
        <button
          className="btn block"
          onClick={async () => {
            try {
              const r = await exportBackup(getState());
              toast(r === 'shared' ? 'Choisis où garder le fichier' : 'Fichier téléchargé');
            } catch (e) {
              if (e instanceof Error && /cancel/i.test(e.message)) return;
              toast('Export impossible', 'err');
            }
          }}
        >
          <IconDownload /> Sauvegarder mes données
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>
          <IconUpload /> Remettre une sauvegarde
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
        <Explain q="Coller une sauvegarde à la place ?">
          <textarea className="input" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"app":"over15-methode", …}' />
          <button className="btn small block" style={{ marginTop: 8 }} disabled={!importText.trim()} onClick={() => doImport(importText)}>
            Importer le texte
          </button>
        </Explain>
        <button
          className="btn danger block small"
          onClick={async () => {
            if (await ask({ title: 'Tout effacer ?', message: 'Paris, outsiders et réglages reviennent à zéro. Pense à sauvegarder avant.', confirm: 'Tout effacer', tone: 'danger' })) {
              actions.resetAll();
              toast('Remis à zéro');
            }
          }}
        >
          Tout remettre à zéro
        </button>
      </Section>

      <Section title="Confort">
        <ToggleRow title="Vibrations" desc="Petites vibrations quand tu valides." on={s.haptics} onChange={(v) => set({ haptics: v })} />
        <ToggleRow title="Animation d'ouverture" desc="Le ballon et le logo au lancement." on={s.intro} onChange={(v) => set({ intro: v })} />
        <button className="btn block" onClick={goLearn}>
          Comprendre la value
        </button>
      </Section>

      <Section title="Jeu responsable">
        <div className="row">
          <span className="logo-mini" style={{ background: 'var(--red)', color: '#fff', boxShadow: 'none' }}>18+</span>
          <div className="grow small">
            <b>Interdit aux mineurs.</b> Les paris comportent des risques : endettement, isolement, dépendance. Aucune méthode ne gagne à tous les coups.
          </div>
        </div>
        <button className="btn block" onClick={() => openUrl('https://www.joueurs-info-service.fr/')}>
          Joueurs Info Service <IconExternal />
        </button>
        <button className="btn block ghost" onClick={() => openUrl('tel:0974751313')}>
          Appeler le 09 74 75 13 13 (non surtaxé)
        </button>
        <div className="tiny faint">Outsiders – application indépendante, non affiliée à un bookmaker. Version {__APP_VERSION__}.</div>
      </Section>
    </div>
  );
}
