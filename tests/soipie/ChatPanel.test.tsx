import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const history = [
  { id: '1', role: 'user', content: 'Waar lunchen we?', created_at: '2027-03-02T10:00:00Z' },
  { id: '2', role: 'assistant', content: 'Wengeralm. Proost.', created_at: '2027-03-02T10:00:05Z' },
];
vi.mock('../../src/lib/supabase', () => {
  const q = { select: () => q, order: () => q, limit: () => Promise.resolve({ data: [...history].reverse() }) };
  return { supabase: { from: () => q, functions: { invoke: (...a: unknown[]) => invoke(...a) } } };
});

import { ChatPanel } from '../../src/features/soipie/ChatPanel';

describe('ChatPanel', () => {
  beforeEach(() => invoke.mockReset());

  it('shows the chat history', async () => {
    render(<ChatPanel />);
    expect(await screen.findByText('Wengeralm. Proost.')).toBeInTheDocument();
    expect(screen.getByText('Waar lunchen we?')).toBeInTheDocument();
  });

  it('disables sending while Soipie is thinking and shows the reply', async () => {
    let resolve!: (v: unknown) => void;
    invoke.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ChatPanel />);
    await userEvent.type(screen.getByLabelText('Bericht aan Soipie'), 'Welke liften zijn dicht?');
    await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }));
    expect(screen.getByRole('button', { name: 'Verstuur' })).toBeDisabled();
    expect(invoke).toHaveBeenCalledWith('soipie', { body: { message: 'Welke liften zijn dicht?' } });
    resolve({ data: { reply: 'Graukogel I. Pech.' }, error: null });
    expect(await screen.findByText('Graukogel I. Pech.')).toBeInTheDocument();
  });

  it('shows the daily limit message', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ error: 'Soipie heeft even genoeg gehad. Morgen weer.' }), { status: 429 }) },
    });
    render(<ChatPanel />);
    await userEvent.type(screen.getByLabelText('Bericht aan Soipie'), 'Nog eentje?');
    await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }));
    expect(await screen.findByText('Soipie heeft even genoeg gehad. Morgen weer.')).toBeInTheDocument();
  });

  it('sends a suggested question with one tap', async () => {
    invoke.mockResolvedValue({ data: { reply: 'Morgen?' }, error: null });
    render(<ChatPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Waar lunchen we morgen?' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('soipie', { body: { message: 'Waar lunchen we morgen?' } }));
  });
});
