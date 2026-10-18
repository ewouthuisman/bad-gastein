import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const insert = vi.fn((_row: Record<string, unknown>) => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'd1' }, error: null }) }) }));
const del = vi.fn(() => ({ eq: (_c: string, _v: string) => Promise.resolve({ error: null }) }));
vi.mock('../../src/lib/supabase', () => ({ supabase: { from: () => ({ insert, delete: del }) } }));

import { DrinkButtons } from '../../src/features/soipen/DrinkButtons';

describe('DrinkButtons', () => {
  it('shows the six drinks', () => {
    render(<DrinkButtons />);
    for (const label of ['Bier 0,3', 'Bier 0,5', 'Jägermeister', 'Wijn', 'Shot', 'Glühwein']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('logs a drink with one tap', async () => {
    render(<DrinkButtons />);
    await userEvent.click(screen.getByRole('button', { name: /Bier 0,5/ }));
    expect(insert).toHaveBeenCalledWith({ kind: 'beer_05' });
  });

  it('can undo the last drink', async () => {
    render(<DrinkButtons />);
    await userEvent.click(screen.getByRole('button', { name: /Jägermeister/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ongedaan maken' }));
    expect(del).toHaveBeenCalled();
  });

  it('hides the undo after 10 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<DrinkButtons />);
    await userEvent.click(screen.getByRole('button', { name: /Wijn/ }));
    expect(await screen.findByRole('button', { name: 'Ongedaan maken' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_500));
    expect(screen.queryByRole('button', { name: 'Ongedaan maken' })).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
