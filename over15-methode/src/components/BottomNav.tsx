import { haptic } from '../lib/native';
import { IconBook, IconGear, IconHome, IconList, IconTarget } from './Icons';

export type Tab = 'outsiders' | 'calc' | 'bets' | 'learn' | 'settings';

const ITEMS: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: 'outsiders', label: 'Outsiders', icon: IconHome },
  { id: 'calc', label: 'Calculer', icon: IconTarget },
  { id: 'bets', label: 'Mes paris', icon: IconList },
  { id: 'learn', label: 'Comprendre', icon: IconBook },
  { id: 'settings', label: 'Réglages', icon: IconGear },
];

export function BottomNav({ tab, onChange, pending }: { tab: Tab; onChange: (t: Tab) => void; pending: number }) {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {ITEMS.map(({ id, label, icon: Icon }) => (
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
            <Icon size={23} />
            {id === 'bets' && pending > 0 && <span className="nav-badge">{pending}</span>}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
