// Turns an Overpass JSON snapshot of the Gastein valley into a routable ski graph and a place list.
import { haversineM, polylineLengthM } from '../../src/lib/geo';
import { normaliseLiftName } from '../../supabase/functions/_shared/names.ts';
import type { Difficulty, GEdge, GNode, Place, PlaceKind, SkiGraph } from '../../src/features/nav/types';

type Tags = Record<string, string>;
interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Tags }
interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags?: Tags;
  center?: { lat: number; lon: number };
}
interface OsmRelation {
  type: 'relation';
  id: number;
  members: { type: string; ref: number; role: string }[];
  tags?: Tags;
  center?: { lat: number; lon: number };
}
type OsmElement = OsmNode | OsmWay | OsmRelation;
export interface OverpassJson { elements: OsmElement[] }

const LIFT_TYPES = new Set([
  'cable_car', 'gondola', 'mixed_lift', 'chair_lift', 'drag_lift', 't-bar', 'j-bar', 'platter', 'rope_tow', 'magic_carpet',
]);
const DIFFICULTIES = new Set<Difficulty>(['novice', 'easy', 'intermediate', 'advanced', 'expert', 'freeride']);
export const APRES_NAMES =
  /hirschen|weitmoser|aeroplan|salettl|feuer|gastein alm|silver bullet|haeggblom|lederhosen|schirmbar|après|apres/i;

interface BuildOpts {
  snapM?: number;
  liftSnapM?: number;
  /** Points of interest (huts, bars): the nearest piste vertex within anchorM becomes a graph node. */
  anchors?: { lat: number; lng: number }[];
  anchorM?: number;
}

interface WayInfo {
  way: OsmWay;
  kind: 'piste' | 'lift';
  ref?: string;
  name?: string;
  difficulty?: Difficulty;
  liftType?: string;
  bothWays: boolean;
}

function routeRelations(elements: OsmElement[]): Map<number, Tags> {
  const byWay = new Map<number, Tags>();
  for (const el of elements) {
    if (el.type !== 'relation' || el.tags?.route !== 'piste') continue;
    for (const m of el.members) if (m.type === 'way' && !byWay.has(m.ref)) byWay.set(m.ref, el.tags);
  }
  return byWay;
}

function collectWays(elements: OsmElement[]): WayInfo[] {
  const rel = routeRelations(elements);
  const out: WayInfo[] = [];
  for (const el of elements) {
    if (el.type !== 'way' || !el.tags || !el.geometry?.length) continue;
    const t = el.tags;
    if (t['piste:type'] === 'downhill' && t.area !== 'yes') {
      const r = rel.get(el.id) ?? {};
      const diff = (t['piste:difficulty'] ?? r['piste:difficulty']) as Difficulty | undefined;
      out.push({
        way: el,
        kind: 'piste',
        ref: t['piste:ref'] ?? t.ref ?? r['piste:ref'] ?? r.ref,
        name: t['piste:name'] ?? t.name ?? r['piste:name'] ?? r.name,
        difficulty: diff && DIFFICULTIES.has(diff) ? diff : undefined,
        bothWays: t['piste:oneway'] === 'no',
      });
    } else if (t.aerialway && LIFT_TYPES.has(t.aerialway)) {
      out.push({ way: el, kind: 'lift', name: t.name, ref: t.ref, liftType: t.aerialway, bothWays: false });
    }
  }
  return out;
}

const key = (id: number) => String(id);


export function buildGraph(osm: OverpassJson, opts: BuildOpts = {}): SkiGraph {
  const snapM = opts.snapM ?? 40;
  const liftSnapM = opts.liftSnapM ?? 80;
  const ways = collectWays(osm.elements);

  const coords = new Map<string, { lat: number; lng: number }>();
  const usage = new Map<string, number>();
  for (const w of ways) {
    w.way.nodes.forEach((n, i) => {
      coords.set(key(n), { lat: w.way.geometry[i].lat, lng: w.way.geometry[i].lon });
      usage.set(key(n), (usage.get(key(n)) ?? 0) + 1);
    });
  }

  // Graph nodes: way endpoints, nodes shared between pistes, and snap targets.
  const graphNodes = new Set<string>();
  for (const w of ways) {
    const ids = w.way.nodes.map(key);
    graphNodes.add(ids[0]);
    graphNodes.add(ids[ids.length - 1]);
    if (w.kind === 'piste') for (const id of ids) if ((usage.get(id) ?? 0) > 1) graphNodes.add(id);
  }

  // Anchors: split pistes where a hut or bar sits beside them, so routes can end there.
  const anchorM = opts.anchorM ?? 300;
  for (const a of opts.anchors ?? []) {
    for (const w of ways) {
      if (w.kind !== 'piste') continue;
      let best: string | null = null;
      let bestD = Infinity;
      for (const n of w.way.nodes) {
        const d = haversineM(a, coords.get(key(n))!);
        if (d < bestD) {
          bestD = d;
          best = key(n);
        }
      }
      if (best && bestD <= anchorM) graphNodes.add(best);
    }
  }

  // Snap: each way endpoint links to the nearest vertex of every other way within range,
  // unless the two ways already share that endpoint.
  const links: [string, string, number][] = [];
  const seenLink = new Set<string>();
  for (const w of ways) {
    const ids = w.way.nodes.map(key);
    for (const end of [ids[0], ids[ids.length - 1]]) {
      const p = coords.get(end)!;
      for (const other of ways) {
        if (other === w) continue;
        const otherIds = other.way.nodes.map(key);
        if (otherIds.includes(end)) continue;
        const radius = w.kind === 'lift' || other.kind === 'lift' ? liftSnapM : snapM;
        // Lifts can only be boarded or left at their stations, never mid-span.
        const candidates = other.kind === 'lift' ? [otherIds[0], otherIds[otherIds.length - 1]] : otherIds;
        let best: string | null = null;
        let bestD = Infinity;
        for (const c of candidates) {
          const d = haversineM(p, coords.get(c)!);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        if (best && bestD <= radius) {
          graphNodes.add(best);
          const k = [end, best].sort().join('|');
          if (!seenLink.has(k)) {
            seenLink.add(k);
            links.push([end, best, bestD]);
          }
        }
      }
    }
  }

  const edges: GEdge[] = [];
  for (const w of ways) {
    const ids = w.way.nodes.map(key);
    const geo = w.way.geometry.map((g) => [g.lat, g.lon] as [number, number]);
    const base = {
      kind: w.kind,
      ref: w.ref,
      name: w.name,
      difficulty: w.difficulty,
      liftType: w.liftType,
      osmId: `way/${w.way.id}`,
      statusId: w.kind === 'lift' ? normaliseLiftName(w.name ?? '') || undefined : w.ref,
    };
    if (w.kind === 'lift') {
      edges.push({ ...base, id: `${w.way.id}`, from: ids[0], to: ids[ids.length - 1], geometry: geo, lengthM: polylineLengthM(geo) });
      continue;
    }
    let start = 0;
    let seg = 0;
    for (let i = 1; i < ids.length; i++) {
      if (!graphNodes.has(ids[i]) && i !== ids.length - 1) continue;
      const g = geo.slice(start, i + 1);
      const lengthM = polylineLengthM(g);
      edges.push({ ...base, id: `${w.way.id}:${seg}`, from: ids[start], to: ids[i], geometry: g, lengthM });
      if (w.bothWays) {
        edges.push({ ...base, id: `${w.way.id}:${seg}r`, from: ids[i], to: ids[start], geometry: [...g].reverse(), lengthM });
      }
      start = i;
      seg++;
    }
  }
  for (const [a, b, d] of links) {
    const pa = coords.get(a)!;
    const pb = coords.get(b)!;
    edges.push({ id: `L:${a}:${b}`, from: a, to: b, kind: 'link', lengthM: d, geometry: [[pa.lat, pa.lng], [pb.lat, pb.lng]] });
    edges.push({ id: `L:${b}:${a}`, from: b, to: a, kind: 'link', lengthM: d, geometry: [[pb.lat, pb.lng], [pa.lat, pa.lng]] });
  }

  const nodes: GNode[] = [...graphNodes].map((id) => ({ id, ...coords.get(id)! }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const w of ways) {
    if (w.kind !== 'lift' || !w.name) continue;
    const ids = w.way.nodes.map(key);
    const bottom = byId.get(ids[0]);
    const top = byId.get(ids[ids.length - 1]);
    if (bottom && !bottom.label) bottom.label = `${w.name} (dal)`;
    if (top && !top.label) top.label = `${w.name} (berg)`;
  }
  return { version: new Date().toISOString().slice(0, 10), nodes, edges };
}

function placeKind(t: Tags, nearPiste: boolean): PlaceKind | null {
  const name = t.name ?? '';
  if (/schiller/i.test(name) && (t.tourism || t.building)) return 'house';
  if (t.amenity === 'bar' || t.amenity === 'pub' || t.amenity === 'biergarten' || APRES_NAMES.test(name)) return 'apres';
  if (['restaurant', 'cafe', 'fast_food'].includes(t.amenity ?? '') || t.tourism === 'alpine_hut') {
    return nearPiste ? 'restaurant' : 'dinner';
  }
  return null;
}

export function buildPlaces(osm: OverpassJson, graph: SkiGraph, maxSnapM = 150): Place[] {
  const places: Place[] = [];
  for (const el of osm.elements) {
    const t = el.tags;
    if (!t?.name) continue;
    const pos =
      el.type === 'node' ? { lat: el.lat, lng: el.lon } : el.center ? { lat: el.center.lat, lng: el.center.lon } : null;
    if (!pos) continue;
    const within = graph.nodes
      .map((n) => ({ n, d: haversineM(pos, n) }))
      .filter((x) => x.d <= maxSnapM)
      .sort((x, y) => x.d - y.d)
      .slice(0, 8);
    const nearest: GNode | null = within[0]?.n ?? null;
    const near = !!nearest;
    const kind = placeKind(t, near);
    if (!kind) continue;
    places.push({
      id: `osm:${el.type}/${el.id}`,
      name: t.name,
      kind,
      lat: pos.lat,
      lng: pos.lng,
      nodeId: near && nearest ? nearest.id : null,
      nodeIds: within.map((x) => x.n.id),
      osmId: `${el.type}/${el.id}`,
      website: t.website ?? t['contact:website'],
      menuUrl: t['website:menu'] ?? t.menu,
    });
  }
  return places;
}
