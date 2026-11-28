import { haptic } from '../lib/native';
import { IconHome, IconList, IconTarget } from './Icons';

export type Tab = 'home' | 'find' | 'check' | 'system' | 'bets' | 'howto' | 'settings';

const IconSearch = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

const IconGrid = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);

const ITEMS: { id: Tab; label: string; Icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: 'home', label: 'Accueil', Icon: IconHome },
  { id: 'find', label: 'Trouver', Icon: IconSearch },
  { id: 'check', label: 'Vérifier', Icon: IconTarget },
  { id: 'system', label: 'Système', Icon: IconGrid },
  { id: 'bets', label: 'Mes paris', Icon: IconList },
];

export function BottomNav({ tab, onChange, pending }: { tab: Tab; onChange: (t: Tab) => void; pending: number }) {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {ITEMS.map(({ id, label, Icon }) => (
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
            <Icon size={22} />
            {id === 'bets' && pending > 0 && <span className="nav-badge">{pending}</span>}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
