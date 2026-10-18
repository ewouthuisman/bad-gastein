// Route coverage report: from the house to every lift, and from every lift top to every mountain
// restaurant / après bar in the same ski area. Writes docs/route-check.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { findRoute } from '../src/features/nav/route';
import type { Place, SkiGraph } from '../src/features/nav/types';

const graph = JSON.parse(readFileSync('public/data/ski-graph.json', 'utf8')) as SkiGraph;
const places = JSON.parse(readFileSync('public/data/places.json', 'utf8')) as Place[];
const opts = { maxDifficulty: 'intermediate' as const, closedStatusIds: new Set<string>() };

// Weakly connected components = separate ski areas (Graukogel, Sportgastein, …).
const parent = new Map<string, string>();
const find = (x: string): string => {
  while (parent.get(x) !== x) x = parent.get(x)!;
  return x;
};
for (const n of graph.nodes) parent.set(n.id, n.id);
for (const e of graph.edges) {
  if (!parent.has(e.from)) parent.set(e.from, e.from);
  if (!parent.has(e.to)) parent.set(e.to, e.to);
  parent.set(find(e.from), find(e.to));
}

const lifts = graph.edges.filter((e) => e.kind === 'lift');
const areaLifts = new Map<string, string[]>();
for (const l of lifts) {
  const c = find(l.from);
  areaLifts.set(c, [...(areaLifts.get(c) ?? []), l.name ?? l.id]);
}
const targets = places.filter((p) => (p.kind === 'restaurant' || p.kind === 'apres') && p.nodeId);

const lines: string[] = ['# Route-check', '', `Graaf ${graph.version}: ${graph.nodes.length} knopen, ${graph.edges.length} verbindingen.`, ''];
lines.push('## Skigebieden (losse delen van het netwerk)', '');
for (const [c, names] of [...areaLifts.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`- ${names.length} liften: ${[...new Set(names)].sort().join(', ')} (${c})`);
}

const failures: string[] = [];
const suspicious: string[] = [];
let ok = 0;
for (const lift of lifts) {
  const from = lift.to;
  for (const t of targets) {
    if (find(from) !== find(t.nodeId!)) continue;
    const r = findRoute(graph, from, t.nodeId!, opts);
    if (!r.ok) {
      failures.push(`- ${lift.name ?? lift.id} (berg) → ${t.name}: ${r.reason}`);
      continue;
    }
    ok++;
    const longLink = r.edges.find((e) => e.kind === 'link' && e.lengthM > 100);
    if (longLink) suspicious.push(`- ${lift.name ?? lift.id} → ${t.name}: looproute van ${Math.round(longLink.lengthM)} m (${longLink.id})`);
  }
}

const house = places.find((p) => p.kind === 'house');
lines.push('', '## Vanaf het huis', '');
if (!house?.nodeId) lines.push('- Het huis ligt niet binnen 150 m van het pistenetwerk; ga lopend/met de bus naar een dalstation.');
else {
  for (const lift of lifts) {
    if (find(house.nodeId) !== find(lift.from)) continue;
    const r = findRoute(graph, house.nodeId, lift.from, opts);
    lines.push(`- ${lift.name ?? lift.id} (dal): ${r.ok ? `${r.minutes} min` : r.reason}`);
  }
}

lines.push('', `## Lift → plek (rood als maximum): ${ok} ok, ${failures.length} mislukt`, '', ...failures.slice(0, 300));
lines.push('', `## Verdacht: lange loopstukken (${suspicious.length})`, '', ...[...new Set(suspicious)].slice(0, 100));
writeFileSync('docs/route-check.md', lines.join('\n') + '\n');
console.log(`ok ${ok}, failed ${failures.length}, suspicious ${suspicious.length}`);
