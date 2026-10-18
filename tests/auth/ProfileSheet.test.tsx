import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const update = vi.fn();
const eq = vi.fn();
const signOut = vi.fn();
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ update: (v: unknown) => { update(v); return { eq: (...a: unknown[]) => { eq(...a); return Promise.resolve({ error: null }); } }; } }),
    auth: { signOut: () => { signOut(); return Promise.resolve({}); } },
  },
}));

import { ProfileSheet } from '../../src/auth/ProfileSheet';
import { AuthContext, type AuthState } from '../../src/auth/AuthProvider';

const base: AuthState = {
  session: { user: { id: 'u1' } } as AuthState['session'],
  profile: { id: 'u1', display_name: 'Anna', color: '#ff6b6b', role: 'member', max_difficulty: 'intermediate' },
  isAdmin: false, loading: false, refreshProfile: async () => {},
};

function renderSheet(auth = base) {
  return render(<AuthContext.Provider value={auth}><MemoryRouter><ProfileSheet onClose={() => {}} /></MemoryRouter></AuthContext.Provider>);
}

describe('ProfileSheet', () => {
  it('saves the max difficulty for routes', async () => {
    renderSheet();
    await userEvent.selectOptions(screen.getByLabelText('Max. pisteniveau'), 'easy');
    await userEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ max_difficulty: 'easy', display_name: 'Anna' }));
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('shows the admin link only for admins', () => {
    renderSheet();
    expect(screen.queryByRole('link', { name: 'Beheer' })).not.toBeInTheDocument();
  });

  it('signs out', async () => {
    renderSheet({ ...base, isAdmin: true });
    expect(screen.getByRole('link', { name: 'Beheer' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Uitloggen' }));
    expect(signOut).toHaveBeenCalled();
  });
});
