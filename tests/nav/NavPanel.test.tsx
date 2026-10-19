import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavPanel, type NavPanelProps } from '../../src/features/nav/NavPanel';
import type { GEdge, SkiGraph } from '../../src/features/nav/types';

const e = (id: string, from: string, to: string, extra: Partial<GEdge>): GEdge => ({
  id, from, to, kind: 'piste', lengthM: 500, geometry: [[47.1, 13.1], [47.09, 13.1]], ...extra,
});

const graph: SkiGraph = {
  version: 't',
  nodes: [
    { id: 'T', lat: 47.12, lng: 13.1, label: 'Testbahn (berg)' },
    { id: 'B', lat: 47.1, lng: 13.1, label: 'Testbahn (dal)' },
    { id: 'H', lat: 47.11, lng: 13.1 },
    { id: 'X', lat: 47.2, lng: 13.2 },
  ],
  edges: [
    e('lift', 'B', 'T', { kind: 'lift', name: 'Testbahn', statusId: 'testbahn' }),
    e('blue', 'T', 'H', { ref: '27', difficulty: 'easy', geometry: [[47.12, 13.1], [47.11, 13.1]] }),
    e('black', 'T', 'B', { ref: '9', difficulty: 'advanced', geometry: [[47.12, 13.1], [47.1, 13.1]] }),
  ],
};

const base: NavPanelProps = {
  graph,
  places: [
    { id: 'hut', name: 'Testhütte', kind: 'restaurant', lat: 47.11, lng: 13.1001, nodeId: 'H' },
    { id: 'house', name: 'Ons huis', kind: 'house', lat: 47.1, lng: 13.1, nodeId: 'B' },
    { id: 'bar', name: 'Silver Bullet', kind: 'apres', lat: 47.3, lng: 13.3, nodeId: null },
    { id: 'far', name: 'Verre Hütte', kind: 'restaurant', lat: 47.2, lng: 13.2, nodeId: 'X' },
  ],
  people: [],
  position: { lat: 47.1001, lng: 13.1, accuracy: 10, at: new Date() },
  closedStatusIds: new Set(),
  notes: new Map(),
  maxDifficulty: 'intermediate',
  onDifficultyChange: vi.fn(),
  onRoute: vi.fn(),
};

describe('NavPanel', () => {
  it('routes from your current position to a preset destination with numbered steps', () => {
    render(<NavPanel {...base} initialTo="hut" />);
    const steps = screen.getByRole('list', { name: 'Route' });
    expect(steps.querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByText('Neem lift Testbahn')).toBeInTheDocument();
    expect(screen.getByText(/Neem piste 27 \(blauw\)/)).toBeInTheDocument();
    expect(base.onRoute).toHaveBeenCalled();
  });

  it('defaults the level to the profile and reports changes', async () => {
    const onDifficultyChange = vi.fn();
    render(<NavPanel {...base} onDifficultyChange={onDifficultyChange} />);
    const select = screen.getByLabelText('Max. niveau') as HTMLSelectElement;
    expect(select.value).toBe('intermediate');
    await userEvent.selectOptions(select, 'easy');
    expect(onDifficultyChange).toHaveBeenCalledWith('easy');
  });

  it('starts from any piste point beside a hut, not only the nearest one', () => {
    // K, right beside the hut, only has a black run; H, a few metres farther, has a blue one.
    const g: SkiGraph = {
      ...graph,
      nodes: [...graph.nodes, { id: 'K', lat: 47.11, lng: 13.10008 }],
      edges: [...graph.edges, e('k-black', 'K', 'B', { ref: '9', difficulty: 'advanced' }), e('h-blue', 'H', 'B', { ref: '28', difficulty: 'easy' })],
    };
    render(<NavPanel {...base} graph={g} initialFrom="hut" initialTo="house" maxDifficulty="easy" />);
    expect(screen.getByText('Neem piste 28 (blauw)')).toBeInTheDocument();
    expect(screen.queryByText(/Geen route/)).not.toBeInTheDocument();
  });

  it('explains when only harder pistes lead there', () => {
    render(<NavPanel {...base} initialFrom="node:T" initialTo="node:B" maxDifficulty="easy" graph={{ ...graph, edges: graph.edges.filter((x) => x.id !== 'blue') }} />);
    expect(screen.getByText('Geen route op dit niveau — wel op zwart. Of neem een lift naar beneden.')).toBeInTheDocument();
  });

  it('suggests the ski bus when the area is not connected', () => {
    render(<NavPanel {...base} initialTo="far" />);
    expect(screen.getByText('Geen route over de piste. Misschien is de skibus nodig.')).toBeInTheDocument();
  });

  it('says when a closed lift blocks the way', () => {
    render(<NavPanel {...base} initialTo="hut" closedStatusIds={new Set(['testbahn'])} />);
    expect(screen.getByText('Geen route: er is een lift of piste dicht op de weg.')).toBeInTheDocument();
  });

  it('explains places that are not on the slopes', () => {
    render(<NavPanel {...base} initialTo="bar" />);
    expect(screen.getByText('Silver Bullet ligt niet aan de piste — loop of neem de bus.')).toBeInTheDocument();
  });

  it('asks for a location when "Hier" has no fix', () => {
    render(<NavPanel {...base} position={null} initialTo="hut" />);
    expect(screen.getByText('Je locatie is nog onbekend. Kies een startpunt of deel je locatie.')).toBeInTheDocument();
  });
});
