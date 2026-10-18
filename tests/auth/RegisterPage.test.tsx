import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signUp = vi.fn();
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { signUp: (...a: unknown[]) => signUp(...a) } } }));

import { RegisterPage } from '../../src/auth/RegisterPage';

async function fill() {
  const u = userEvent.setup();
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);
  await u.type(screen.getByLabelText('Naam'), 'Anna');
  await u.type(screen.getByLabelText('E-mail'), 'anna@test.nl');
  await u.type(screen.getByLabelText('Wachtwoord'), 'geheim123');
  await u.type(screen.getByLabelText('Groepscode'), 'SOIPEN');
  return u;
}

describe('RegisterPage', () => {
  beforeEach(() => signUp.mockReset());

  it('signs up with display name and group code as metadata', async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    const u = await fill();
    await u.click(screen.getByRole('button', { name: 'Account maken' }));
    expect(signUp).toHaveBeenCalledWith({
      email: 'anna@test.nl',
      password: 'geheim123',
      options: { data: { display_name: 'Anna', group_code: 'SOIPEN' } },
    });
  });

  it('shows a Dutch message for a wrong group code', async () => {
    signUp.mockResolvedValue({ data: {}, error: { message: 'Database error saving new user: invalid group code' } });
    const u = await fill();
    await u.click(screen.getByRole('button', { name: 'Account maken' }));
    expect(await screen.findByText('Ongeldige groepscode')).toBeInTheDocument();
  });

  it('treats the real Supabase trigger error as a wrong group code', async () => {
    signUp.mockResolvedValue({ data: {}, error: { message: 'Database error saving new user' } });
    const u = await fill();
    await u.click(screen.getByRole('button', { name: 'Account maken' }));
    expect(await screen.findByText('Ongeldige groepscode')).toBeInTheDocument();
  });

  it('disables submit while pending', async () => {
    let resolve!: (v: unknown) => void;
    signUp.mockReturnValue(new Promise((r) => (resolve = r)));
    const u = await fill();
    const btn = screen.getByRole('button', { name: 'Account maken' });
    await u.click(btn);
    expect(btn).toBeDisabled();
    resolve({ data: {}, error: null });
    await waitFor(() => expect(btn).not.toBeDisabled());
  });
});
