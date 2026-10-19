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

/** Keep the house, places on the piste network of the four areas, and anything within walking distance of the house. */
export function filterPlaces(places: Place[], graph: SkiGraph): Place[] {
  const areaOf = new Map(graph.nodes.map((n) => [n.id, n.area]));
  const house = places.find((p) => p.kind === 'house');
  const out: Place[] = [];
  for (const p of places) {
    const area: AreaKey | undefined = p.nodeId ? areaOf.get(p.nodeId) : undefined;
    if (area) p.area = area;
    const walkable = !!house && haversineM(p, house) <= WALKING_M;
    if (p.kind === 'house' || p.kind === 'other' || area || walkable) out.push(p);
  }
  return out;
}

/** Farthest walk from where a piste ends in the valley to a lift's bottom station. */
export const VALLEY_WALK_M = 500;

/**
 * Pistes that end in the valley away from any lift (e.g. the run into Bad Hofgastein) leave skiers stuck in
 * the graph. Link each such dead end to the nearest bottom station of its area that leads back up, on foot.
 */
export function linkValleyEnds(graph: SkiGraph, maxM = VALLEY_WALK_M): number {
  const rev = new Map<string, string[]>();
  for (const e of graph.edges) (rev.get(e.to) ?? rev.set(e.to, []).get(e.to)!).push(e.from);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  let added = 0;
  for (const area of AREAS) {
    const anchor = graph.nodes.find((n) => n.label === `${area.anchorLift} (dal)`);
    if (!anchor) continue;
    // Everything that can still get back to the area's main valley station.
    const home = new Set([anchor.id]);
    const stack = [anchor.id];
    while (stack.length) {
      for (const prev of rev.get(stack.pop()!) ?? []) if (!home.has(prev)) (home.add(prev), stack.push(prev));
    }
    const stations = graph.edges
      .filter((e) => e.kind === 'lift' && home.has(e.from) && byId.get(e.from)?.area === area.key)
      .map((e) => byId.get(e.from)!);
    const ends = graph.nodes.filter(
      (n) => n.area === area.key && !home.has(n.id) && !graph.edges.some((e) => e.from === n.id && e.kind !== 'link'),
    );
    for (const end of ends) {
      const best = stations.map((s) => ({ s, d: haversineM(end, s) })).sort((a, b) => a.d - b.d)[0];
      if (!best || best.d > maxM) continue;
      for (const [a, b] of [[end, best.s], [best.s, end]]) {
        graph.edges.push({ id: `V:${a.id}:${b.id}`, from: a.id, to: b.id, kind: 'link', lengthM: best.d, geometry: [[a.lat, a.lng], [b.lat, b.lng]] });
      }
      added++;
    }
  }
  return added;
}
