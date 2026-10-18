import { haversineM } from '../../lib/geo';
import { DIFFICULTY_RANK, edgeRank, edgeSeconds, outgoing } from './graph';
import type { Difficulty, GEdge, SkiGraph } from './types';

export interface RouteOpts {
  maxDifficulty: Difficulty;
  closedStatusIds: Set<string>;
}

export type RouteResult =
  | { ok: true; edges: GEdge[]; totalM: number; minutes: number }
  | { ok: false; reason: 'no-route' | 'difficulty' | 'closed' };

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

function dijkstra(g: SkiGraph, from: string, to: string, allowed: (e: GEdge) => boolean): GEdge[] | null {
  const adj = outgoing(g);
  const dist = new Map<string, number>([[from, 0]]);
  const via = new Map<string, GEdge>();
  const heap = new MinHeap();
  heap.push([0, from]);
  while (heap.size) {
    const [d, node] = heap.pop();
    if (node === to) break;
    if (d > (dist.get(node) ?? Infinity)) continue;
    for (const e of adj.get(node) ?? []) {
      if (!allowed(e)) continue;
      const nd = d + edgeSeconds(e);
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        via.set(e.to, e);
        heap.push([nd, e.to]);
      }
    }
  }
  if (from !== to && !via.has(to)) return null;
  const path: GEdge[] = [];
  for (let n = to; n !== from; ) {
    const e = via.get(n)!;
    path.unshift(e);
    n = e.from;
  }
  return path;
}

export function findRoute(g: SkiGraph, from: string, to: string, opts: RouteOpts): RouteResult {
  const cap = DIFFICULTY_RANK[opts.maxDifficulty];
  const withinCap = (e: GEdge) => edgeRank(e) <= cap;
  const isOpen = (e: GEdge) => !(e.statusId && opts.closedStatusIds.has(e.statusId));
  // Expert and freeride terrain is never routed, whatever the cap.
  const notOffPiste = (e: GEdge) => edgeRank(e) <= DIFFICULTY_RANK.advanced;

  const path = dijkstra(g, from, to, (e) => withinCap(e) && isOpen(e));
  if (path) {
    const seconds = path.reduce((s, e) => s + edgeSeconds(e), 0);
    return {
      ok: true,
      edges: path,
      totalM: Math.round(path.reduce((s, e) => s + e.lengthM, 0)),
      minutes: Math.round(seconds / 60),
    };
  }
  if (dijkstra(g, from, to, withinCap)) return { ok: false, reason: 'closed' };
  if (dijkstra(g, from, to, (e) => notOffPiste(e) && isOpen(e)) || dijkstra(g, from, to, () => true)) {
    return { ok: false, reason: 'difficulty' };
  }
  return { ok: false, reason: 'no-route' };
}

export function nearestNode(g: SkiGraph, lat: number, lng: number): { nodeId: string; distM: number } {
  let best = { nodeId: '', distM: Infinity };
  for (const n of g.nodes) {
    const d = haversineM({ lat, lng }, n);
    if (d < best.distM) best = { nodeId: n.id, distM: d };
  }
  return best;
}
