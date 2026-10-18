import type { GEdge, SkiGraph } from './types';

export type NavOverride =
  | { op: 'add_edge'; edge: GEdge }
  | { op: 'block_edge'; edgeId: string }
  | { op: 'set_attr'; edgeId: string; attrs: Partial<GEdge> }
  | { op: 'note'; edgeId: string; text: string };

/** Lays admin corrections over the base graph; returns a new graph. */
export function applyOverrides(g: SkiGraph, overrides: NavOverride[]): SkiGraph {
  let edges = g.edges.map((e) => ({ ...e }));
  const nodes = [...g.nodes];
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const o of overrides) {
    if (o.op === 'block_edge') edges = edges.filter((e) => e.id !== o.edgeId);
    else if (o.op === 'set_attr') edges = edges.map((e) => (e.id === o.edgeId ? { ...e, ...o.attrs, id: e.id } : e));
    else if (o.op === 'add_edge') {
      edges.push({ ...o.edge });
      for (const [id, [lat, lng]] of [
        [o.edge.from, o.edge.geometry[0]],
        [o.edge.to, o.edge.geometry[o.edge.geometry.length - 1]],
      ] as const) {
        if (!nodeIds.has(id)) {
          nodes.push({ id, lat, lng });
          nodeIds.add(id);
        }
      }
    }
  }
  return { ...g, nodes, edges };
}

export function overrideNotes(overrides: NavOverride[]): Map<string, string> {
  const notes = new Map<string, string>();
  for (const o of overrides) if (o.op === 'note') notes.set(o.edgeId, o.text);
  return notes;
}
