import { describe, expect, it } from 'vitest';
import { assignAreas, filterPlaces } from '../../scripts/lib/areas';
import type { Place, SkiGraph } from '../../src/features/nav/types';

const graph: SkiGraph = {
  version: 't',
  nodes: [
    { id: 'g1', lat: 47.11, lng: 13.15, label: 'Graukogel I (dal)' },
    { id: 'g2', lat: 47.12, lng: 13.15 },
    { id: 'x1', lat: 47.0, lng: 13.0, label: 'Gletscher Jet (dal)' },
    { id: 'x2', lat: 47.0, lng: 13.01 },
  ],
  edges: [
    { id: 'e1', from: 'g1', to: 'g2', kind: 'lift', lengthM: 1, geometry: [] },
    { id: 'e2', from: 'x1', to: 'x2', kind: 'lift', lengthM: 1, geometry: [] },
  ],
};
const p = (id: string, kind: Place['kind'], lat: number, lng: number, nodeId: string | null): Place => ({ id, name: id, kind, lat, lng, nodeId });

describe('areas', () => {
  it('keeps mountain places in the four areas and places near the house, drops the rest', () => {
    assignAreas(graph);
    const kept = filterPlaces(
      [p('house', 'house', 47.1159, 13.1388, null), p('hut', 'restaurant', 47.12, 13.15, 'g2'), p('glacier', 'restaurant', 47.0, 13.01, 'x2'),
        p('centrum', 'dinner', 47.117, 13.14, null), p('far', 'dinner', 47.2, 13.3, null)],
      graph,
    );
    expect(kept.map((x) => x.id)).toEqual(['house', 'hut', 'centrum']);
    expect(kept.find((x) => x.id === 'hut')?.area).toBe('graukogel');
  });
});
