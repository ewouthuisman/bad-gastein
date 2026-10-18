import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavOverrides } from '../../src/features/admin/NavOverrides';
import type { GEdge, SkiGraph } from '../../src/features/nav/types';

const e = (id: string, from: string, to: string, extra: Partial<GEdge>): GEdge => ({
  id, from, to, kind: 'piste', lengthM: 300, geometry: [[47.1, 13.1], [47.09, 13.1]], ...extra,
});
const graph: SkiGraph = {
  version: 't',
  nodes: [
    { id: 'A', lat: 47.12, lng: 13.1, label: 'Testbahn (berg)' },
    { id: 'B', lat: 47.1, lng: 13.1, label: 'Testbahn (dal)' },
    { id: 'C', lat: 47.11, lng: 13.12 },
  ],
  edges: [
    e('200:0', 'A', 'C', { ref: '27', difficulty: 'easy', osmId: 'way/200' }),
    e('200:1', 'C', 'B', { ref: '27', difficulty: 'easy', osmId: 'way/200' }),
    e('300:0', 'A', 'B', { ref: '5', difficulty: 'intermediate', osmId: 'way/300' }),
    e('lift', 'B', 'A', { kind: 'lift', name: 'Testbahn' }),
  ],
};

function setup(onInsert = vi.fn().mockResolvedValue(undefined)) {
  render(<NavOverrides graph={graph} places={[]} overrides={[]} onInsert={onInsert} onDelete={vi.fn()} />);
  return onInsert;
}

describe('NavOverrides', () => {
  it('finds pistes by number and blocks every segment of that piste way', async () => {
    const onInsert = setup();
    await userEvent.type(screen.getByLabelText('Zoek piste of lift'), '27');
    const hit = screen.getByRole('group', { name: /Piste 27/ });
    await userEvent.click(within(hit).getByRole('button', { name: 'Blokkeren' }));
    expect(onInsert).toHaveBeenCalledWith([
      { op: 'block_edge', payload: { edgeId: '200:0' } },
      { op: 'block_edge', payload: { edgeId: '200:1' } },
    ]);
  });

  it('changes the colour of a piste', async () => {
    const onInsert = setup();
    await userEvent.type(screen.getByLabelText('Zoek piste of lift'), '5');
    const hit = screen.getByRole('group', { name: /Piste 5/ });
    await userEvent.selectOptions(within(hit).getByLabelText('Kleur'), 'advanced');
    await userEvent.click(within(hit).getByRole('button', { name: 'Kleur opslaan' }));
    expect(onInsert).toHaveBeenCalledWith([{ op: 'set_attr', payload: { edgeId: '300:0', attrs: { difficulty: 'advanced' } } }]);
  });

  it('adds a note to a piste', async () => {
    const onInsert = setup();
    await userEvent.type(screen.getByLabelText('Zoek piste of lift'), '5');
    const hit = screen.getByRole('group', { name: /Piste 5/ });
    await userEvent.type(within(hit).getByLabelText('Notitie'), 'stuk schaatsen');
    await userEvent.click(within(hit).getByRole('button', { name: 'Notitie opslaan' }));
    expect(onInsert).toHaveBeenCalledWith([{ op: 'note', payload: { edgeId: '300:0', text: 'stuk schaatsen' } }]);
  });

  it('adds a walking connection in both directions', async () => {
    const onInsert = setup();
    await userEvent.selectOptions(screen.getByLabelText('Verbinding van'), 'A');
    await userEvent.selectOptions(screen.getByLabelText('Verbinding naar'), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Verbinding toevoegen' }));
    const rows = onInsert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ op: 'add_edge', payload: { edge: { from: 'A', to: 'B', kind: 'link' } } });
    expect(rows[1]).toMatchObject({ op: 'add_edge', payload: { edge: { from: 'B', to: 'A', kind: 'link' } } });
    expect(rows[0].payload.edge.lengthM).toBeGreaterThan(2000);
  });
});
