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
}

type Group = { edges: GEdge[]; kind: GEdge['kind'] };

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
    if (last && last.kind === 'piste' && samePiste(last.edges[last.edges.length - 1], e)) last.edges.push(e);
    else groups.push({ edges: [e], kind: e.kind });
  }
  return groups;
}

const colour = (e: GEdge) => (e.difficulty ? ` (${COLOUR[e.difficulty]})` : '');
const pisteLabel = (e: GEdge) => (e.ref ? `piste ${e.ref}` : e.name ? `de ${e.name}` : 'de piste');

function nextTarget(groups: Group[], i: number, destination?: Place): string | undefined {
  for (let j = i + 1; j < groups.length; j++) {
    const e = groups[j].edges[0];
    if (e.kind === 'lift' && e.name) return e.name;
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
  groups.forEach((gr, i) => {
    const first = gr.edges[0];
    let text: string | null = null;
    if (gr.kind === 'lift') text = first.name ? `Neem lift ${first.name}` : 'Neem de lift';
    else if (gr.kind === 'link') {
      const m = gr.edges.reduce((s, e) => s + e.lengthM, 0);
      if (m >= LONG_WALK_M) {
        const target = nextTarget(groups, i, opts.destination);
        text = `Loop ongeveer ${Math.round(m / 10) * 10} m${target ? ` naar ${target}` : ''}`;
      }
    } else if (first.ref || first.name) text = `Neem ${pisteLabel(first)}${colour(first)}`;
    else {
      const target = nextTarget(groups, i, opts.destination);
      text = `Volg de piste${colour(first)}${target ? ` richting ${target}` : ' naar beneden'}`;
    }
    if (!text) return;
    const note = gr.edges.map((e) => opts.notes?.get(e.id)).find(Boolean);
    steps.push(note ? `${text} — let op: ${note}` : text);
  });

  const dest = opts.destination;
  const lastGroup = groups[groups.length - 1];
  if (dest && lastGroup?.kind === 'piste') {
    const f = fractionAlong(lastGroup.edges, opts.graph);
    const where = f < 0.25 ? 'aan het begin van' : f <= 0.75 ? 'halverwege' : 'onderaan';
    const last = lastGroup.edges[lastGroup.edges.length - 1];
    steps.push(`${dest.name} ligt ${where} ${pisteLabel(last)}, ${side(last, dest)}`);
  } else if (dest) {
    steps.push(`${dest.name} is je bestemming`);
  }
  return steps;
}
