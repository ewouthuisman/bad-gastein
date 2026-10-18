import { describe, expect, it } from 'vitest';
import type { GEdge, SkiGraph } from '../../src/features/nav/types';
import { findRoute, nearestNode } from '../../src/features/nav/route';
import { applyOverrides } from '../../src/features/nav/overrides';

const e = (id: string, from: string, to: string, extra: Partial<GEdge>): GEdge => ({
  id, from, to, kind: 'piste', lengthM: 100, geometry: [[0, 0], [0, 0]], ...extra,
});

const graph: SkiGraph = {
  version: 'test',
  nodes: [
    { id: 'A', lat: 47.02, lng: 13.0 },
    { id: 'C', lat: 47.0, lng: 13.0 },
    { id: 'D', lat: 47.01, lng: 13.01 },
    { id: 'E', lat: 47.03, lng: 13.03 },
  ],
  edges: [
    e('blue', 'A', 'C', { difficulty: 'easy', ref: '1', lengthM: 2000 }),
    e('red', 'A', 'C', { difficulty: 'intermediate', ref: '2', lengthM: 600 }),
    e('lift', 'C', 'A', { kind: 'lift', name: 'Lift 1', statusId: 'lift 1', lengthM: 1000 }),
    e('black', 'A', 'D', { difficulty: 'advanced', ref: '3', lengthM: 500 }),
  ],
};
const open = { maxDifficulty: 'intermediate' as const, closedStatusIds: new Set<string>() };
const ids = (r: ReturnType<typeof findRoute>) => (r.ok ? r.edges.map((x) => x.id) : r.reason);

describe('findRoute', () => {
  it('takes the fastest route within the difficulty cap', () => {
    expect(ids(findRoute(graph, 'A', 'C', open))).toEqual(['red']);
  });

  it('avoids red pistes when capped at blue', () => {
    expect(ids(findRoute(graph, 'A', 'C', { ...open, maxDifficulty: 'easy' }))).toEqual(['blue']);
  });

  it('reports difficulty when only harder pistes lead there', () => {
    expect(findRoute(graph, 'A', 'D', open)).toEqual({ ok: false, reason: 'difficulty' });
  });

  it('reports no-route for disconnected parts', () => {
    expect(findRoute(graph, 'A', 'E', open)).toEqual({ ok: false, reason: 'no-route' });
  });

  it('reports closed when the only path uses a closed lift', () => {
    expect(findRoute(graph, 'C', 'A', { ...open, closedStatusIds: new Set(['lift 1']) })).toEqual({ ok: false, reason: 'closed' });
  });

  it('estimates minutes with lift speed and boarding time', () => {
    const r = findRoute(graph, 'C', 'A', open);
    expect(r.ok && r.minutes).toBe(5); // 1000 m / 5 m/s + 120 s ≈ 5.3 min
    expect(r.ok && r.totalM).toBe(1000);
  });

  it('never routes over freeride terrain', () => {
    const g = { ...graph, edges: [...graph.edges, e('fr', 'A', 'E', { difficulty: 'freeride', lengthM: 10 })] };
    expect(findRoute(g, 'A', 'E', { ...open, maxDifficulty: 'advanced' })).toEqual({ ok: false, reason: 'difficulty' });
  });
});

describe('applyOverrides', () => {
  it('block_edge removes an edge', () => {
    const g = applyOverrides(graph, [{ op: 'block_edge', edgeId: 'red' }]);
    expect(ids(findRoute(g, 'A', 'C', open))).toEqual(['blue']);
  });

  it('add_edge connects a previously unreachable node', () => {
    const g = applyOverrides(graph, [{ op: 'add_edge', edge: e('walk', 'A', 'E', { kind: 'link', lengthM: 50 }) }]);
    expect(ids(findRoute(g, 'A', 'E', open))).toEqual(['walk']);
  });

  it('set_attr changes difficulty', () => {
    const g = applyOverrides(graph, [{ op: 'set_attr', edgeId: 'black', attrs: { difficulty: 'intermediate' } }]);
    expect(ids(findRoute(g, 'A', 'D', open))).toEqual(['black']);
  });

  it('does not mutate the input graph', () => {
    applyOverrides(graph, [{ op: 'block_edge', edgeId: 'red' }]);
    expect(graph.edges.some((x) => x.id === 'red')).toBe(true);
  });
});

describe('nearestNode', () => {
  it('finds the closest node and its distance', () => {
    const n = nearestNode(graph, 47.0001, 13.0);
    expect(n.nodeId).toBe('C');
    expect(Math.round(n.distM)).toBe(11);
  });
});
