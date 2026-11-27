import { useState } from 'react';
import { copyText, haptic, openUrl, readText } from '../lib/native';
import { Banner, BigButton, Explain, toast } from '../components/ui';
import { IconCopy, IconExternal, IconPaste } from '../components/Icons';

/**
 * Les 5 étapes « Demander à Claude », expliquées très simplement :
 * copier la demande → ouvrir Claude → coller et envoyer → copier la réponse → la coller ici.
 */
export function FetchFlow({ buildPrompt, onText, pasteLabel = 'Colle la réponse ici', pasteHint = 'L\'app lit la réponse de Claude et fait les calculs toute seule.' }: { buildPrompt: () => string; onText: (text: string) => string; pasteLabel?: string; pasteHint?: string }) {
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    const ok = await copyText(buildPrompt());
    if (ok) {
      haptic.success();
      setCopied(true);
      toast('Demande copiée ✓');
    } else {
      haptic.error();
      toast('Copie impossible : réessaie', 'err');
    }
  };

  const importText = (text: string) => {
    try {
      const msg = onText(text);
      haptic.success();
      setError(null);
      toast(msg);
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const paste = async () => {
    setBusy(true);
    const text = await readText();
    setBusy(false);
    if (!text || !text.trim()) {
      haptic.warning();
      setError('Il n\'y a rien de copié. Dans Claude, touche d\'abord « Copier » sous sa réponse (l\'icône avec deux feuilles).');
      return;
    }
    importText(text);
  };

  return (
    <div className="stack">
      <div className={`card step-card ${copied ? 'done' : ''}`}>
        <span className="step-badge">{copied ? '✓' : '1'}</span>
        <b>Copie la demande</b>
        <div className="small muted" style={{ margin: '2px 0 10px' }}>Elle est déjà écrite pour toi. Touche juste le bouton.</div>
        <BigButton icon={<IconCopy size={24} />} title={copied ? 'Copiée ✓' : 'Copier la demande'} onClick={copy} tone={copied ? 'plain' : 'primary'} />
      </div>

      <div className={`card step-card ${opened ? 'done' : copied ? '' : 'later'}`}>
        <span className="step-badge">{opened ? '✓' : '2'}</span>
        <b>Ouvre Claude</b>
        <div className="small muted" style={{ margin: '2px 0 10px' }}>L'app Claude (ou le site claude.ai) va s'ouvrir.</div>
        <BigButton
          icon={<IconExternal size={22} />}
          title="Ouvrir Claude"
          onClick={() => {
            haptic.tap();
            setOpened(true);
            void openUrl('https://claude.ai/new');
          }}
          tone={copied && !opened ? 'primary' : 'plain'}
        />
      </div>

      <div className={`card step-card ${opened ? '' : 'later'}`}>
        <span className="step-badge">3</span>
        <b>Colle et envoie</b>
        <ol className="list-plain small" style={{ marginTop: 6 }}>
          <li>Appuie <b>longtemps</b> dans la case en bas où on écrit.</li>
          <li>Touche <b>Coller</b>.</li>
          <li>Touche la <b>flèche ↑</b> pour envoyer.</li>
        </ol>
        <Explain q="Claude dit qu'il ne peut pas chercher sur internet ?">
          Sous la case où on écrit, touche le bouton <b>＋</b> (ou l'icône des réglages), active <b>Recherche web</b>, puis renvoie la demande.
        </Explain>
      </div>

      <div className={`card step-card ${opened ? '' : 'later'}`}>
        <span className="step-badge">4</span>
        <b>Attends, puis copie la réponse</b>
        <ol className="list-plain small" style={{ marginTop: 6 }}>
          <li>Attends que Claude ait <b>fini d'écrire</b> (1 à 3 minutes).</li>
          <li>
            Sous sa réponse, touche l'icône <b>Copier</b> (deux petites feuilles 📄📄).
          </li>
          <li>Reviens dans cette app.</li>
        </ol>
      </div>

      <div className={`card step-card ${opened ? '' : 'later'}`}>
        <span className="step-badge">5</span>
        <b>{pasteLabel}</b>
        <div className="small muted" style={{ margin: '2px 0 10px' }}>{pasteHint}</div>
        <BigButton icon={<IconPaste size={24} />} title={busy ? 'Lecture…' : 'Coller la réponse'} onClick={paste} tone={opened ? 'primary' : 'plain'} disabled={busy} />
      </div>

      {error && (
        <Banner tone="red">
          <b>Ça n'a pas marché.</b> {error}
        </Banner>
      )}

      <Explain q="Le bouton « Coller la réponse » ne marche pas ?">
        Appuie longtemps dans la case ci-dessous, touche <b>Coller</b>, puis touche <b>Analyser ce texte</b>.
        <textarea className="input" style={{ marginTop: 8 }} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Colle ici la réponse de Claude" />
        <button className="btn small block" style={{ marginTop: 8 }} disabled={!manual.trim()} onClick={() => importText(manual)}>
          Analyser ce texte
        </button>
      </Explain>
    </div>
  );
}
