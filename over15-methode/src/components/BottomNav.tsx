import { haptic } from '../lib/native';
import { IconBolt, IconBook, IconGear, IconHome, IconList } from './Icons';

export type Tab = 'matches' | 'live' | 'bets' | 'learn' | 'settings';

const ITEMS: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: 'matches', label: 'Matchs', icon: IconHome },
  { id: 'live', label: 'Live', icon: IconBolt },
  { id: 'bets', label: 'Mes paris', icon: IconList },
  { id: 'learn', label: 'Comprendre', icon: IconBook },
  { id: 'settings', label: 'Réglages', icon: IconGear },
];

export function BottomNav({ tab, onChange, liveActive }: { tab: Tab; onChange: (t: Tab) => void; liveActive: boolean }) {
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
            {id === 'live' && liveActive && <span className="dot RED" style={{ position: 'absolute', top: -3, right: -6, width: 10, height: 10 }} />}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
