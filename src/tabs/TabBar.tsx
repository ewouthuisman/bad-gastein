import { NavLink } from 'react-router-dom';

export const TABS = [
  { path: '/kaart', label: 'Kaart', icon: '🗺️' },
  { path: '/berg', label: 'Berg', icon: '⛷️' },
  { path: '/ai', label: 'AI', icon: '🍻' },
  { path: '/huis', label: 'Huis', icon: '🏠' },
  { path: '/planning', label: 'Planning', icon: '🗳️' },
] as const;

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Tabs">
      {TABS.map((t) => (
        <NavLink key={t.path} to={t.path} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <span className="tab-icon" aria-hidden="true">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
