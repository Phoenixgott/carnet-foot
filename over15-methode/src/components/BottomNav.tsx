import { haptic } from '../lib/native';
import { IconGear, IconHome, IconList, IconTarget, IconTrophy } from './Icons';

export type Tab = 'home' | 'analyze' | 'leagues' | 'history' | 'settings';

const ITEMS: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: 'home', label: 'Accueil', icon: IconHome },
  { id: 'analyze', label: 'Analyser', icon: IconTarget },
  { id: 'leagues', label: 'Ligues', icon: IconTrophy },
  { id: 'history', label: 'Historique', icon: IconList },
  { id: 'settings', label: 'Réglages', icon: IconGear },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
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
          <Icon size={23} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
