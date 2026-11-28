import { useState } from 'react';
import { copyText, haptic, openUrl, readText } from '../lib/native';
import { Banner, BigButton, Explain, toast } from '../components/ui';
import { ClaudeVideo } from '../components/Videos';

/**
 * « Demander à Claude » en 3 gros boutons : Copier → Ouvrir Claude → Coller la réponse.
 * La mini-vidéo montre les gestes à faire entre les boutons.
 */
export function FetchFlow({ buildPrompt, onText, video = true }: { buildPrompt: () => string; onText: (text: string) => string; video?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    if (await copyText(buildPrompt())) {
      haptic.success();
      setCopied(true);
      toast('Copié ✓');
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
      setError('Rien n\'est copié. Dans Claude, touche d\'abord « Copier » sous sa réponse.');
      return;
    }
    importText(text);
  };

  return (
    <div className="stack">
      {video && <ClaudeVideo />}

      <div className={`big-step ${copied ? 'done' : ''}`}>
        <span className="num">{copied ? '✓' : '1'}</span>
        <BigButton icon="📋" title={copied ? 'Copié !' : 'Copier'} sub="la demande pour Claude" onClick={copy} tone={copied ? 'plain' : 'primary'} />
      </div>

      <div className={`big-step ${opened ? 'done' : ''}`}>
        <span className="num">{opened ? '✓' : '2'}</span>
        <BigButton
          icon="🤖"
          title="Ouvrir Claude"
          sub="colle, envoie, puis copie sa réponse"
          onClick={() => {
            haptic.tap();
            setOpened(true);
            void openUrl('https://claude.ai/new');
          }}
          tone={copied && !opened ? 'primary' : 'plain'}
        />
      </div>

      <div className="big-step">
        <span className="num">3</span>
        <BigButton icon="📥" title={busy ? 'Je lis…' : 'Coller la réponse'} sub="l'app fait le reste" onClick={paste} tone={opened ? 'primary' : 'plain'} disabled={busy} />
      </div>

      {error && (
        <Banner tone="red">
          <b>Oups.</b> {error}
        </Banner>
      )}

      <Explain q="Dans Claude, je fais comment ?">
        Appuie <b>longtemps</b> dans la case en bas → <b>Coller</b> → flèche <b>↑</b>. Attends qu'il ait fini (1 à 3 min), puis touche <b>Copier</b> (📄📄) sous sa réponse et reviens ici.
      </Explain>
      <Explain q="Claude dit qu'il ne peut pas chercher sur internet ?">
        Touche le <b>＋</b> sous la case où on écrit, active <b>Recherche web</b>, puis renvoie la demande.
      </Explain>
      <Explain q="Le bouton « Coller la réponse » ne marche pas ?">
        Colle la réponse dans la case ci-dessous (appui long → Coller), puis touche <b>Lire ce texte</b>.
        <textarea className="input" style={{ marginTop: 8 }} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Colle ici la réponse de Claude" />
        <button className="btn small block" style={{ marginTop: 8 }} disabled={!manual.trim()} onClick={() => importText(manual)}>
          Lire ce texte
        </button>
      </Explain>
    </div>
  );
}
