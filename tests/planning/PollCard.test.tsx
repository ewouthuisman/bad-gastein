import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PollCard, type PollCardProps } from '../../src/features/planning/PollCard';

const base: PollCardProps = {
  poll: { id: 'p1', day: '2027-03-03', kind: 'lunch_place', decided_option_id: null },
  options: [
    { id: 'o1', label: 'Wengeralm', place_id: 'pl1', created_by: 'u2' },
    { id: 'o2', label: 'Bergstadl', place_id: 'pl2', created_by: 'u2' },
  ],
  votes: [{ user_id: 'u2', option_id: 'o1' }],
  names: new Map([['u1', 'Ewout'], ['u2', 'Anna']]),
  myUserId: 'u1',
  isAdmin: false,
  places: [
    { id: 'pl1', dbId: 'pl1', name: 'Wengeralm', kind: 'restaurant', lat: 0, lng: 0, nodeId: 'n' },
    { id: 'pl2', dbId: 'pl2', name: 'Bergstadl', kind: 'restaurant', lat: 0, lng: 0, nodeId: 'n' },
    { id: 'osm:node/9', name: 'Jungerstube', kind: 'restaurant', lat: 0, lng: 0, nodeId: 'n' },
    { id: 'osm:node/8', name: 'Silver Bullet', kind: 'apres', lat: 0, lng: 0, nodeId: null },
  ],
  onVote: vi.fn(),
  onDecide: vi.fn(),
  onUndecide: vi.fn(),
  onReset: vi.fn(),
  onPropose: vi.fn(),
  onRoute: vi.fn(),
  onRemoveOption: vi.fn(),
};

describe('PollCard', () => {
  it('lets members vote and shows who voted', async () => {
    const onVote = vi.fn();
    render(<PollCard {...base} onVote={onVote} />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Bergstadl/ }));
    expect(onVote).toHaveBeenCalledWith('o2');
  });

  it('shows the decide button only to admins', () => {
    const { rerender } = render(<PollCard {...base} />);
    expect(screen.queryByRole('button', { name: 'Besluit' })).not.toBeInTheDocument();
    rerender(<PollCard {...base} isAdmin />);
    expect(screen.getByRole('button', { name: 'Besluit' })).toBeInTheDocument();
  });

  it('admin decides on the leading option', async () => {
    const onDecide = vi.fn();
    render(<PollCard {...base} isAdmin onDecide={onDecide} />);
    await userEvent.click(screen.getByRole('button', { name: 'Besluit' }));
    expect(onDecide).toHaveBeenCalledWith('o1');
  });

  it('after a decision shows the result with a route and disables voting', async () => {
    const onRoute = vi.fn();
    render(<PollCard {...base} poll={{ ...base.poll, decided_option_id: 'o1' }} onRoute={onRoute} />);
    expect(screen.getByText(/Besloten: Wengeralm/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bergstadl/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Route' }));
    expect(onRoute).toHaveBeenCalledWith('pl1');
  });

  it('proposes a place from the restaurant list for lunch', async () => {
    const onPropose = vi.fn();
    render(<PollCard {...base} onPropose={onPropose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plek voorstellen' }));
    const picker = screen.getByRole('dialog', { name: 'Plek voorstellen' });
    expect(within(picker).queryByText('Silver Bullet')).not.toBeInTheDocument();
    await userEvent.click(within(picker).getByRole('button', { name: 'Jungerstube' }));
    expect(onPropose).toHaveBeenCalledWith({ place: expect.objectContaining({ id: 'osm:node/9' }) });
  });

  it('proposes a new place by name', async () => {
    const onPropose = vi.fn();
    render(<PollCard {...base} onPropose={onPropose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plek voorstellen' }));
    await userEvent.type(screen.getByLabelText('Nieuwe plek'), 'Hütte X');
    await userEvent.click(screen.getByRole('button', { name: 'Toevoegen' }));
    expect(onPropose).toHaveBeenCalledWith({ newName: 'Hütte X', link: '' });
  });

  it('lets admins remove an option', async () => {
    const onRemoveOption = vi.fn();
    const { rerender } = render(<PollCard {...base} onRemoveOption={onRemoveOption} />);
    expect(screen.queryByRole('button', { name: 'Verwijder Bergstadl' })).not.toBeInTheDocument();
    rerender(<PollCard {...base} isAdmin onRemoveOption={onRemoveOption} />);
    await userEvent.click(screen.getByRole('button', { name: 'Verwijder Bergstadl' }));
    expect(onRemoveOption).toHaveBeenCalledWith('o2');
  });

  it('lets people remove their own proposal before the decision', () => {
    render(<PollCard {...base} myUserId="u2" />);
    expect(screen.getByRole('button', { name: 'Verwijder Bergstadl' })).toBeInTheDocument();
  });

  it('time polls have no proposing or route', () => {
    render(<PollCard {...base} poll={{ ...base.poll, kind: 'lunch_time' }} options={[{ id: 't1', label: '12:00', place_id: null, created_by: null }]} votes={[]} />);
    expect(screen.queryByRole('button', { name: 'Plek voorstellen' })).not.toBeInTheDocument();
  });
});
