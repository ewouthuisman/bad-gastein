import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/staticData', () => ({ loadGraph: () => new Promise(() => {}), loadPlaces: () => new Promise(() => {}), loadRatings: () => Promise.resolve({}) }));
vi.mock('../src/lib/supabase', () => {
  const query = { select: () => query, order: () => Promise.resolve({ data: [] }), then: (r: (v: unknown) => void) => r({ data: [] }) };
  const channel = { on: () => channel, subscribe: () => channel };
  return { uniqueChannel: () => channel, supabase: { from: () => query, channel: () => channel, removeChannel: () => Promise.resolve(), auth: {}, functions: { invoke: vi.fn() } } };
});
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
import { AuthContext, type AuthState } from '../src/auth/AuthProvider';

const signedIn: AuthState = {
  session: { user: { id: 'u1' } } as AuthState['session'],
  profile: { id: 'u1', display_name: 'Anna', color: '#fff', role: 'member', max_difficulty: 'intermediate' },
  isAdmin: false,
  loading: false,
  refreshProfile: async () => {},
};
const signedOut: AuthState = { ...signedIn, session: null, profile: null };

function renderAt(path: string, auth = signedIn) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('App shell', () => {
  it('renders five tabs in order', () => {
    renderAt('/kaart');
    const nav = screen.getByRole('navigation', { name: 'Tabs' });
    const labels = within(nav).getAllByRole('link').map((a) => a.querySelector('.tab-label')?.textContent);
    expect(labels).toEqual(['Kaart', 'Berg', 'Soipie', 'Huis', 'Planning']);
  });

  it('defaults to kaart', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Kaart' })).toBeInTheDocument();
  });

  it('redirects to login when signed out', () => {
    renderAt('/planning', signedOut);
    expect(screen.getByRole('heading', { name: 'Inloggen' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Tabs' })).not.toBeInTheDocument();
  });
});
