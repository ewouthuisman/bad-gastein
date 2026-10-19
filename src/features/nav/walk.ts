import { haversineM } from '../../lib/geo';
import type { GEdge, SkiGraph } from './types';

/** Farthest walk between the valley stations of two different ski areas. */
export const AREA_WALK_M = 1500;
/** Straight-line distance understates the way along roads. */
const DETOUR = 1.25;

/**
 * The ski areas are separate lift networks, but their valley stations lie in the same village. Add the walk
 * between them, so e.g. the way from the house to another mountain is "walk to its lift" rather than no route.
 */
export function withWalks(graph: SkiGraph): SkiGraph {
  const stations = graph.nodes.filter((n) => n.area && n.label?.endsWith('(dal)'));
  const edges: GEdge[] = [];
  for (const a of stations) {
    for (const b of stations) {
      if (a.id === b.id || a.area === b.area) continue;
      const d = haversineM(a, b);
      if (d > AREA_WALK_M) continue;
      edges.push({ id: `A:${a.id}:${b.id}`, from: a.id, to: b.id, kind: 'link', lengthM: d * DETOUR, geometry: [[a.lat, a.lng], [b.lat, b.lng]] });
    }
  }
  return edges.length ? { ...graph, edges: [...graph.edges, ...edges] } : graph;
}
