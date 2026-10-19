import { hhmm } from './bus';
import type { Difficulty, GEdge, Place, SkiGraph } from './types';

const COLOUR: Record<Difficulty, string> = {
  novice: 'blauw',
  easy: 'blauw',
  intermediate: 'rood',
  advanced: 'zwart',
  expert: 'skiroute',
  freeride: 'skiroute',
};

const LONG_WALK_M = 100;

interface DescribeOpts {
  graph?: SkiGraph;
  destination?: Place;
  notes?: Map<string, string>;
  /** Walk from the start spot onto the first piste point, and from the last one to the destination. */
  startWalkM?: number;
  endWalkM?: number;
}

type Group = { edges: GEdge[]; kind: GEdge['kind']; absorbed: GEdge[] };

const SHORT_HOP_M = 150;
const RANK: Record<Difficulty, number> = { novice: 0, easy: 1, intermediate: 2, advanced: 3, expert: 4, freeride: 5 };

function samePiste(a: GEdge, b: GEdge): boolean {
  if (a.kind !== 'piste' || b.kind !== 'piste') return false;
  if (a.ref || b.ref) return a.ref === b.ref;
  if (a.name || b.name) return a.name === b.name;
  return a.difficulty === b.difficulty;
}

function group(edges: GEdge[]): Group[] {
  const groups: Group[] = [];
  for (const e of edges) {
    const last = groups[groups.length - 1];
    // Consecutive walks (via a bus stop, say) read as one.
    if (last && ((last.kind === 'bus' && e.kind === 'bus') || (last.kind === 'link' && e.kind === 'link'))) last.edges.push(e);
    else if (last && last.kind === 'piste' && samePiste(last.edges[last.edges.length - 1], e)) last.edges.push(e);
    else groups.push({ edges: [e], kind: e.kind, absorbed: [] });
  }
  return absorbShortHops(groups);
}

const groupLength = (g: Group) => g.edges.reduce((s, e) => s + e.lengthM, 0);

/** OSM often has parallel or overlapping pistes; a short hop onto another one is not a separate step. */
function absorbShortHops(groups: Group[]): Group[] {
  const out: Group[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const prev = out[out.length - 1];
    const next = groups[i + 1];
    if (g.kind === 'piste' && prev?.kind === 'piste' && next?.kind === 'piste' && groupLength(g) < SHORT_HOP_M) {
      prev.absorbed.push(...g.edges);
      continue;
    }
    if (prev?.kind === 'piste' && g.kind === 'piste' && samePiste(prev.edges[0], g.edges[0])) {
      prev.edges.push(...g.edges);
      prev.absorbed.push(...g.absorbed);
      continue;
    }
    out.push(g);
  }
  return out;
}

/** "(blauw)", or "(blauw, kort stuk rood)" when an absorbed hop is harder than the main piste. */
function colour(e: GEdge, absorbed: GEdge[] = []): string {
  const base = RANK[e.difficulty ?? 'intermediate'];
  const harder = absorbed
    .filter((a) => a.difficulty && RANK[a.difficulty] > base)
    .sort((a, b) => RANK[b.difficulty!] - RANK[a.difficulty!])[0];
  const parts = [e.difficulty && COLOUR[e.difficulty], harder && `kort stuk ${COLOUR[harder.difficulty!]}`].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
}
/** "Neem bus 550 van halte A naar halte B (± 12 min, vertrekt o.a. 14:34, 14:49)". */
function busStep(edges: GEdge[]): string {
  const board = edges.find((e) => e.busRole === 'board');
  const alight = [...edges].reverse().find((e) => e.busRole === 'alight');
  const rideMin = Math.round(edges.filter((e) => e.busRole === 'ride').reduce((s, e) => s + (e.seconds ?? 0), 0) / 60);
  const times = board?.departures?.length ? `, vertrekt o.a. ${board.departures.slice(0, 2).map(hhmm).join(', ')}` : '';
  return `Neem bus ${board?.ref ?? ''} van halte ${board?.name} naar halte ${alight?.name} (± ${rideMin} min${times})`.replace('bus  ', 'bus ');
}

const walk = (m: number, target: string) => `Loop ongeveer ${Math.round(m / 10) * 10} m naar ${target}`;

const pisteLabel = (e: GEdge) => (e.ref ? `piste ${e.ref}` : e.name ? `de ${e.name}` : 'de piste');

function nextTarget(groups: Group[], i: number, destination?: Place): string | undefined {
  for (let j = i + 1; j < groups.length; j++) {
    const e = groups[j].edges[0];
    if (e.kind === 'lift' && e.name) return e.name;
    if (e.kind === 'bus') return `halte ${e.name}`;
  }
  return destination?.name;
}

/** Fraction of the piste (same ref/name) covered when arriving at the end of `edges`. */
function fractionAlong(edges: GEdge[], graph?: SkiGraph): number {
  const covered = edges.reduce((s, e) => s + e.lengthM, 0);
  let remaining = 0;
  if (graph) {
    let node = edges[edges.length - 1].to;
    const seen = new Set<string>();
    for (;;) {
      const next = graph.edges.find((x) => x.from === node && samePiste(edges[0], x) && !seen.has(x.id));
      if (!next) break;
      seen.add(next.id);
      remaining += next.lengthM;
      node = next.to;
    }
  }
  return covered / (covered + remaining || 1);
}

/** 'links' or 'rechts' of the direction of travel at the end of the edge. */
function side(edge: GEdge, place: Place): string {
  const g = edge.geometry;
  const [aLat, aLng] = g[g.length - 2] ?? g[0];
  const [bLat, bLng] = g[g.length - 1];
  const k = Math.cos((bLat * Math.PI) / 180);
  const dx = (bLng - aLng) * k;
  const dy = bLat - aLat;
  const px = (place.lng - bLng) * k;
  const py = place.lat - bLat;
  return dx * py - dy * px > 0 ? 'links' : 'rechts';
}

export function describeRoute(edges: GEdge[], opts: DescribeOpts = {}): string[] {
  const groups = group(edges);
  const steps: string[] = [];
  if ((opts.startWalkM ?? 0) >= LONG_WALK_M) {
    const first = groups[0]?.edges[0];
    const target = first?.kind === 'lift' && first.name ? `lift ${first.name}` : first?.kind === 'bus' ? `halte ${first.name}` : 'de piste';
    steps.push(walk(opts.startWalkM!, target));
  }
  groups.forEach((gr, i) => {
    const first = gr.edges[0];
    let text: string | null = null;
    if (gr.kind === 'lift') text = first.name ? `Neem lift ${first.name}` : 'Neem de lift';
    else if (gr.kind === 'bus') text = busStep(gr.edges);
    else if (gr.kind === 'link') {
      const m = gr.edges.reduce((s, e) => s + e.lengthM, 0);
      if (m >= LONG_WALK_M) {
        const target = nextTarget(groups, i, opts.destination);
        text = target ? walk(m, target) : `Loop ongeveer ${Math.round(m / 10) * 10} m`;
      }
    } else if (first.ref || first.name) text = `Neem ${pisteLabel(first)}${colour(first, gr.absorbed)}`;
    else {
      const target = nextTarget(groups, i, opts.destination);
      text = `Volg de piste${colour(first, gr.absorbed)}${target ? ` richting ${target}` : ' naar beneden'}`;
    }
    if (!text) return;
    const note = gr.edges.map((e) => opts.notes?.get(e.id)).find(Boolean);
    steps.push(note ? `${text} — let op: ${note}` : text);
  });

  const dest = opts.destination;
  const lastGroup = groups[groups.length - 1];
  if (dest && (opts.endWalkM ?? 0) >= LONG_WALK_M) {
    steps.push(walk(opts.endWalkM!, dest.name));
  } else if (dest && lastGroup?.kind === 'piste') {
    const f = fractionAlong(lastGroup.edges, opts.graph);
    const where = f < 0.25 ? 'aan het begin van' : f <= 0.75 ? 'halverwege' : 'onderaan';
    const last = lastGroup.edges[lastGroup.edges.length - 1];
    steps.push(`${dest.name} ligt ${where} ${pisteLabel(last)}, ${side(last, dest)}`);
  } else if (dest) {
    steps.push(`${dest.name} is je bestemming`);
  }
  return steps;
}
