// Route coverage report for the four ski areas, routed the way the app does it: from the house to every
// lift, and from every lift station and every mountain restaurant / après bar to every other one in the
// same area, with red as the maximum. Writes docs/route-check.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { accessPoints, findRoute, type RouteResult } from '../src/features/nav/route';
import { AREAS } from '../src/features/nav/areas';
import type { Place, SkiGraph } from '../src/features/nav/types';

const graph = JSON.parse(readFileSync('public/data/ski-graph.json', 'utf8')) as SkiGraph;
const places = JSON.parse(readFileSync('public/data/places.json', 'utf8')) as Place[];
const opts = { maxDifficulty: 'intermediate' as const, closedStatusIds: new Set<string>() };
const at = (p: Place) => accessPoints(graph, p.lat, p.lng);
const why = (r: RouteResult) => (r.ok ? '' : r.reason === 'difficulty' && r.needs ? `alleen op ${r.needs}` : r.reason);

const lines: string[] = ['# Route-check', '', `Graaf ${graph.version}: ${graph.nodes.length} knopen, ${graph.edges.length} verbindingen.`, ''];

const house = places.find((p) => p.kind === 'house');
lines.push('## Vanaf het huis', '');
for (const n of graph.nodes.filter((x) => x.label?.endsWith('(dal)') && x.area === 'graukogel')) {
  if (!house) break;
  const r = findRoute(graph, at(house), n.id, opts);
  lines.push(`- ${n.label}: ${r.ok ? `${r.minutes} min` : why(r)}`);
}

const failures: string[] = [];
const longWalks: string[] = [];
let ok = 0;
for (const area of AREAS) {
  const targets = places.filter((p) => (p.kind === 'restaurant' || p.kind === 'apres') && p.nodeId && p.area === area.key);
  const sources = [
    ...graph.nodes.filter((n) => n.label && n.area === area.key).map((n) => ({ name: n.label!, from: n.id as string | ReturnType<typeof at> })),
    ...targets.map((p) => ({ name: p.name, from: at(p) })),
  ];
  for (const s of sources) {
    for (const t of targets) {
      if (s.name === t.name) continue;
      const r = findRoute(graph, s.from, at(t), opts);
      if (!r.ok) {
        failures.push(`- ${area.label}: ${s.name} → ${t.name}: ${why(r)}`);
        continue;
      }
      ok++;
      const walk = Math.max(r.startWalkM, r.endWalkM, ...r.edges.filter((e) => e.kind === 'link').map((e) => e.lengthM));
      if (walk > 150) longWalks.push(`- ${area.label}: ${s.name} → ${t.name}: ${Math.round(walk)} m lopen`);
    }
  }
}

lines.push('', `## Lift/plek → plek (rood als maximum): ${ok} ok, ${failures.length} mislukt`, '', ...failures.slice(0, 300));
lines.push('', `## Lange loopstukken, meer dan 150 m (${longWalks.length})`, '', ...longWalks.slice(0, 100));
writeFileSync('docs/route-check.md', lines.join('\n') + '\n');
console.log(`ok ${ok}, failed ${failures.length}, long walks ${longWalks.length}`);
