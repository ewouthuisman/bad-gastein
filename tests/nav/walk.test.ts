import { describe, expect, it } from 'vitest';
import { withWalks } from '../../src/features/nav/walk';
import type { SkiGraph } from '../../src/features/nav/types';

const graph: SkiGraph = {
  version: 't',
  nodes: [
    { id: 'a', lat: 47.1, lng: 13.1, label: 'Aalbahn (dal)', area: 'graukogel' },
    { id: 'a2', lat: 47.1001, lng: 13.1, label: 'Aa-Schlepplift (dal)', area: 'graukogel' },
    { id: 'b', lat: 47.105, lng: 13.1, label: 'Beebahn (dal)', area: 'stubnerkogel' },
    { id: 'far', lat: 47.2, lng: 13.1, label: 'Verre bahn (dal)', area: 'gibfelbahn' },
    { id: 'top', lat: 47.11, lng: 13.1, label: 'Beebahn (berg)', area: 'stubnerkogel' },
  ],
  edges: [],
};

describe('withWalks', () => {
  it('links valley stations of different areas that lie within walking distance, both ways', () => {
    const g = withWalks(graph);
    const ids = g.edges.map((x) => x.id).sort();
    expect(ids).toEqual(['A:a2:b', 'A:a:b', 'A:b:a', 'A:b:a2']);
    expect(g.edges.every((x) => x.kind === 'link')).toBe(true);
  });

  it('counts the way along the road as longer than the straight line', () => {
    const e = withWalks(graph).edges.find((x) => x.id === 'A:a:b')!;
    expect(e.lengthM).toBeGreaterThan(556 * 1.2);
  });

  it('returns the graph unchanged when there is nothing to link', () => {
    const lone = { ...graph, nodes: graph.nodes.slice(0, 2) };
    expect(withWalks(lone)).toBe(lone);
  });
});
