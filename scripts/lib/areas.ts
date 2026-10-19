import { haversineM } from '../../src/lib/geo';
import { AREAS, type AreaKey } from '../../src/features/nav/areas';
import type { Place, SkiGraph } from '../../src/features/nav/types';

/** Restaurants and bars farther than this from the house, and not on a piste of the four areas, are dropped. */
export const WALKING_M = 1500;

/** Label every node with the ski area whose lift network it is connected to (pistes, lifts and links). */
export function assignAreas(graph: SkiGraph): void {
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to);
    (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push(e.from);
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const area of AREAS) {
    const seeds = graph.nodes.filter((n) => n.label?.startsWith(`${area.anchorLift} (`));
    const seen = new Set(seeds.map((n) => n.id));
    const stack = [...seen];
    while (stack.length) {
      for (const next of adj.get(stack.pop()!) ?? []) if (!seen.has(next)) (seen.add(next), stack.push(next));
    }
    for (const id of seen) byId.get(id)!.area = area.key;
  }
}

/** Mountain lodges OSM maps as town restaurants (no piste node within reach) but that belong to a ski area. */
const AREA_OVERRIDES: Record<string, AreaKey> = { 'Windischgrätzhöhe': 'graukogel' };

/** Keep the house, places on the piste network of the four areas, and anything within walking distance of the house. */
export function filterPlaces(places: Place[], graph: SkiGraph): Place[] {
  const areaOf = new Map(graph.nodes.map((n) => [n.id, n.area]));
  const house = places.find((p) => p.kind === 'house');
  const out: Place[] = [];
  for (const p of places) {
    let area: AreaKey | undefined = p.nodeId ? areaOf.get(p.nodeId) : undefined;
    if (!area && AREA_OVERRIDES[p.name]) {
      area = AREA_OVERRIDES[p.name];
      p.kind = 'restaurant';
    }
    if (area) p.area = area;
    const walkable = !!house && haversineM(p, house) <= WALKING_M;
    if (p.kind === 'house' || p.kind === 'other' || area || walkable) out.push(p);
  }
  return out;
}
