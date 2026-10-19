import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PollGroup, type PollGroupProps } from '../../src/features/planning/PollGroup';
import { PollCard } from '../../src/features/planning/PollCard';

const base: PollGroupProps = {
  title: 'Lunch op de berg',
  icon: '🍲',
  polls: [
    { id: 'pp', day: '2027-03-02', kind: 'lunch_place', decided_option_id: null },
    { id: 'pt', day: '2027-03-02', kind: 'lunch_time', decided_option_id: null },
  ],
  decidable: ['lunch_place', 'lunch_time'],
  options: [
    { id: 'o1', poll_id: 'pp', label: 'Wengeralm', place_id: null, created_by: null },
    { id: 'o2', poll_id: 'pt', label: '12:30', place_id: null, created_by: null },
  ],
  votes: [{ poll_id: 'pp', user_id: 'u2', option_id: 'o1' }, { poll_id: 'pt', user_id: 'u2', option_id: 'o2' }],
  names: new Map([['u2', 'Anna']]),
  myUserId: 'u1',
  isAdmin: true,
  places: [],
  onVote: vi.fn(), onDecide: vi.fn(), onUndecide: vi.fn(), onReset: vi.fn(), onPropose: vi.fn(), onRemoveOption: vi.fn(), onRoute: vi.fn(),
};

describe('PollGroup', () => {
  it('decides place and time with a single button', async () => {
    const onDecide = vi.fn();
    render(<PollGroup {...base} onDecide={onDecide} />);
    await userEvent.click(screen.getByRole('button', { name: 'Besluit' }));
    expect(onDecide).toHaveBeenCalledWith('pp', 'o1');
    expect(onDecide).toHaveBeenCalledWith('pt', 'o2');
  });

  it('shows one combined decision', () => {
    const polls = base.polls.map((p, i) => ({ ...p, decided_option_id: i ? 'o2' : 'o1' }));
    render(<PollGroup {...base} polls={polls} />);
    expect(screen.getByText('Besloten: Wengeralm om 12:30')).toBeInTheDocument();
  });

  it('keeps a personal poll (no decision) out of the shared decision', async () => {
    const onDecide = vi.fn();
    render(<PollGroup {...base} title="Skiën" polls={[{ id: 'pa', day: 'd', kind: 'ski_area', decided_option_id: null }, { id: 'ps', day: 'd', kind: 'ski_time', decided_option_id: null }]}
      decidable={['ski_area']} options={[{ id: 'a1', poll_id: 'pa', label: 'Graukogel (Bad Gastein)', place_id: null, created_by: null }, { id: 't1', poll_id: 'ps', label: '09:00', place_id: null, created_by: null }]}
      votes={[{ poll_id: 'pa', user_id: 'u2', option_id: 'a1' }]} onDecide={onDecide} />);
    await userEvent.click(screen.getByRole('button', { name: 'Besluit' }));
    expect(onDecide).toHaveBeenCalledTimes(1);
    expect(onDecide).toHaveBeenCalledWith('pa', 'a1');
  });
});

describe('PollCard proposals', () => {
  const card = {
    poll: { id: 'p', day: 'd', kind: 'ski_time' as const, decided_option_id: null },
    options: [], votes: [], names: new Map(), myUserId: 'u1', isAdmin: false, places: [],
    onVote: vi.fn(), onDecide: vi.fn(), onUndecide: vi.fn(), onReset: vi.fn(), onRoute: vi.fn(), onRemoveOption: vi.fn(),
  };
  it('lets anyone propose a time', async () => {
    const onPropose = vi.fn();
    render(<PollCard {...card} onPropose={onPropose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Optie voorstellen' }));
    await userEvent.type(screen.getByLabelText(/Hoe laat skiën/), '11:15');
    await userEvent.click(screen.getByRole('button', { name: 'Toevoegen' }));
    expect(onPropose).toHaveBeenCalledWith({ text: '11:15' });
  });

  it('limits lunch suggestions to the decided ski area', async () => {
    const places = [
      { id: 'a', name: 'Grauhütte', kind: 'restaurant' as const, lat: 0, lng: 0, nodeId: 'n', area: 'graukogel' as const },
      { id: 'b', name: 'Stubnerhütte', kind: 'restaurant' as const, lat: 0, lng: 0, nodeId: 'n', area: 'stubnerkogel' as const },
    ];
    render(<PollCard {...card} poll={{ id: 'p', day: 'd', kind: 'lunch_place', decided_option_id: null }} places={places} area="graukogel" onPropose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plek voorstellen' }));
    expect(screen.getByRole('button', { name: 'Grauhütte' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stubnerhütte' })).not.toBeInTheDocument();
  });
});
