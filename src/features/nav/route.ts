import { haversineM } from '../../lib/geo';
import { DIFFICULTY_RANK, WALK_MPS, edgeRank, edgeSeconds, outgoing } from './graph';
import type { Difficulty, GEdge, SkiGraph } from './types';

export interface RouteOpts {
  maxDifficulty: Difficulty;
  closedStatusIds: Set<string>;
}

/** How far people will walk (or skate) from a hut or their position to a piste point. */
export const ACCESS_M = 150;
/** Fallback reach, used only when no route exists from or to the points within ACCESS_M. */
export const WIDE_ACCESS_M = 300;

export type RouteResult =
  | { ok: true; edges: GEdge[]; totalM: number; minutes: number; startWalkM: number; endWalkM: number }
  | { ok: false; reason: 'no-route' | 'closed' }
  // needs: the lowest level with an open route, when there is one
  | { ok: false; reason: 'difficulty'; needs?: Difficulty };

class MinHeap {
  private items: [number, string][] = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, string]) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, string] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** A way onto or off the piste network: a graph node plus the walk between it and the actual spot. */
export interface Access {
  nodeId: string;
  walkM: number;
}

export type Endpoint = string | string[] | Access[];

const toAccess = (x: Endpoint): Access[] =>
  (typeof x === 'string' ? [x] : x).map((a) => (typeof a === 'string' ? { nodeId: a, walkM: 0 } : a));

const walkSeconds = (m: number) => m / WALK_MPS;

function cheapestWalk(points: Access[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of points) m.set(a.nodeId, Math.min(m.get(a.nodeId) ?? Infinity, a.walkM));
  return m;
}

interface Path {
  edges: GEdge[];
  startWalkM: number;
  endWalkM: number;
}

/** Fastest path from any start to any end, counting the walk onto the first and off the last node. */
function dijkstra(g: SkiGraph, from: Access[], to: Access[], allowed: (e: GEdge) => boolean): Path | null {
  const adj = outgoing(g);
  const startWalk = cheapestWalk(from);
  const endWalk = cheapestWalk(to);
  const dist = new Map<string, number>();
  const via = new Map<string, GEdge>();
  const heap = new MinHeap();
  for (const [id, m] of startWalk) {
    dist.set(id, walkSeconds(m));
    heap.push([walkSeconds(m), id]);
  }
  let best = Infinity;
  let reached: string | null = null;
  while (heap.size) {
    const [d, node] = heap.pop();
    if (d >= best) break;
    if (d > (dist.get(node) ?? Infinity)) continue;
    const end = endWalk.get(node);
    if (end !== undefined && d + walkSeconds(end) < best) {
      best = d + walkSeconds(end);
      reached = node;
    }
    for (const e of adj.get(node) ?? []) {
      if (!allowed(e)) continue;
      const nd = d + edgeSeconds(e) + (e.penaltyS ?? 0);
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        via.set(e.to, e);
        heap.push([nd, e.to]);
      }
    }
  }
  if (reached === null) return null;
  const edges: GEdge[] = [];
  let n = reached;
  while (via.has(n)) {
    const e = via.get(n)!;
    edges.unshift(e);
    n = e.from;
  }
  return { edges, startWalkM: startWalk.get(n)!, endWalkM: endWalk.get(reached)! };
}

function route(g: SkiGraph, starts: Access[], ends: Access[], opts: RouteOpts): RouteResult {
  const cap = DIFFICULTY_RANK[opts.maxDifficulty];
  const withinCap = (e: GEdge) => edgeRank(e) <= cap;
  const isOpen = (e: GEdge) => !(e.statusId && opts.closedStatusIds.has(e.statusId));
  // Expert and freeride terrain is never routed, whatever the cap.
  const notOffPiste = (e: GEdge) => edgeRank(e) <= DIFFICULTY_RANK.advanced;
  const search = (allowed: (e: GEdge) => boolean) => dijkstra(g, starts, ends, allowed);

  const path = search((e) => withinCap(e) && isOpen(e));
  if (path) {
    const walkM = path.startWalkM + path.endWalkM;
    const seconds = path.edges.reduce((s, e) => s + edgeSeconds(e), 0) + walkSeconds(walkM);
    return {
      ok: true,
      edges: path.edges,
      totalM: Math.round(path.edges.reduce((s, e) => s + e.lengthM, 0) + walkM),
      minutes: Math.round(seconds / 60),
      startWalkM: Math.round(path.startWalkM),
      endWalkM: Math.round(path.endWalkM),
    };
  }
  if (search(withinCap)) return { ok: false, reason: 'closed' };
  if (search((e) => notOffPiste(e) && isOpen(e))) {
    const needs = (['easy', 'intermediate', 'advanced'] as const).find(
      (d) => DIFFICULTY_RANK[d] > cap && search((e) => edgeRank(e) <= DIFFICULTY_RANK[d] && isOpen(e)),
    );
    return { ok: false, reason: 'difficulty', needs };
  }
  if (search(() => true)) return { ok: false, reason: 'difficulty' };
  return { ok: false, reason: 'no-route' };
}

const nearby = (points: Access[]) => {
  const near = points.filter((a) => a.walkM <= ACCESS_M);
  return near.length ? near : points.slice(0, 1);
};

/**
 * Route between two spots. Each end is a node, or several nodes to choose from (e.g. every piste point
 * beside a hut) with the walk to reach each one; the fastest combination wins. Points within ACCESS_M
 * are tried first; farther ones only when those give no route.
 */
export function findRoute(g: SkiGraph, from: Endpoint, to: Endpoint, opts: RouteOpts): RouteResult {
  const starts = toAccess(from);
  const ends = toAccess(to);
  const first = route(g, nearby(starts), nearby(ends), opts);
  if (first.ok || (starts.length === nearby(starts).length && ends.length === nearby(ends).length)) return first;
  const wide = route(g, starts, ends, opts);
  return wide.ok ? wide : first;
}

/** Piste points within walking reach of a spot, nearest first; the single nearest one when none is that close. */
export function accessPoints(g: SkiGraph, lat: number, lng: number, reachM = WIDE_ACCESS_M): Access[] {
  const all = g.nodes.map((n) => ({ nodeId: n.id, walkM: haversineM({ lat, lng }, n) })).sort((a, b) => a.walkM - b.walkM);
  const near = all.filter((a) => a.walkM <= reachM);
  return near.length ? near : all.slice(0, 1);
}

export function nearestNode(g: SkiGraph, lat: number, lng: number): { nodeId: string; distM: number } {
  let best = { nodeId: '', distM: Infinity };
  for (const n of g.nodes) {
    const d = haversineM({ lat, lng }, n);
    if (d < best.distM) best = { nodeId: n.id, distM: d };
  }
  return best;
}
