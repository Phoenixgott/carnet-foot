import { haptic } from '../lib/native';

export type Tab = 'home' | 'find' | 'check' | 'system' | 'bets' | 'howto' | 'settings';

const ITEMS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'home', label: 'Accueil', emoji: '🏠' },
  { id: 'find', label: 'Trouver', emoji: '🔎' },
  { id: 'check', label: 'Vérifier', emoji: '✅' },
  { id: 'system', label: 'Système', emoji: '🎯' },
  { id: 'bets', label: 'Mes paris', emoji: '📊' },
];

export function BottomNav({ tab, onChange, pending }: { tab: Tab; onChange: (t: Tab) => void; pending: number }) {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {ITEMS.map(({ id, label, emoji }) => (
        <button
          key={id}
          type="button"
          className={`nav-item ${tab === id ? 'active' : ''}`}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => {
            if (tab !== id) haptic.tap();
            onChange(id);
          }}
        >
          <span style={{ position: 'relative' }}>
            <span className="nav-emoji">{emoji}</span>
            {id === 'bets' && pending > 0 && <span className="nav-badge">{pending}</span>}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
