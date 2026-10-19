// Builds public/data/bus.json from the Postbus line 550/553 timetable PDF (needs `pdftotext`, from poppler).
// Usage: tsx scripts/build-bus.ts [pdf]   (defaults to data/linie-550-sommer-2026.pdf)
//
// The PDF has no coordinates. Stops that sit at a lift station take that station's position from the ski
// graph; every other stop is placed between the nearest anchors, in proportion to the bus time along the
// route. They are approximations: good enough for "walk from here to the stop", not for surveying.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parsePage, parseWords, type ParsedTrip } from './lib/parse-timetable';
import type { SkiGraph } from '../src/features/nav/types';
import type { BusData, BusDirection, BusStop, BusTrip } from '../src/features/nav/bus';

const pdf = process.argv[2] ?? 'data/linie-550-sommer-2026.pdf';
const graph = JSON.parse(readFileSync('public/data/ski-graph.json', 'utf8')) as SkiGraph;
const liftNode = (label: string) => {
  const n = graph.nodes.find((x) => x.label === label);
  if (!n) throw new Error(`lift station ${label} not in the ski graph`);
  return { lat: n.lat, lng: n.lng };
};

// North-to-south along the valley. The first stop is where this network starts; earlier ones are dropped.
const ANCHORS: Record<string, { lat: number; lng: number }> = {
  'Dorfgastein Gipfelbahn Fulseck Talstation': liftNode('Gipfelexpress Fulseck (dal)'),
  'Bad Hofgastein Busterminal/Schlossalmbahn': liftNode('Schlossalmbahn I (dal)'),
  'Bad Gastein Bahnhof': { lat: 47.11625, lng: 13.13365 },
  'Böckstein Ortsmitte': { lat: 47.088, lng: 13.096 },
  'Sportgastein Goldbergbahn': liftNode('Goldbergbahn I (dal)'),
};

const html = execFileSync('pdftotext', ['-bbox', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const pages = parseWords(html).map(parsePage).filter((p) => p !== null);

const isUp = (stops: string[]) => stops.indexOf('Bad Hofgastein Busterminal/Schlossalmbahn') < stops.indexOf('Bad Gastein Bahnhof');

/**
 * Merge the stop lists of several pages (each a subsequence of the full route) into one order. The base is
 * the longest page that names no stop twice; pages with detours list some stops again, out of order.
 */
function mergeOrder(lists: string[][]): string[] {
  const unique = lists.filter((l) => new Set(l).size === l.length);
  const out = [...(unique.length ? unique : lists).reduce((a, b) => (b.length > a.length ? b : a))];
  for (const list of lists) {
    let prev: string | null = null;
    for (const name of list) {
      if (!out.includes(name)) out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, name);
      prev = name;
    }
  }
  return out;
}

// Footnotes: 05 only until 11.10.2026, 07 only until 20.09.2026, SA only Saturday, SoF only Sunday and holidays.
const UNTIL: Record<string, string> = { '05': '2026-10-11', '07': '2026-09-20' };
const DAYS: Record<string, 'sa' | 'su'> = { SA: 'sa', SoF: 'su' };

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : undefined);

const toTrip = (t: ParsedTrip, weekend: boolean, index: Map<string, number>): BusTrip => {
  const until = t.codes.map((c) => UNTIL[c]).filter(Boolean).sort()[0];
  const days = t.codes.map((c) => DAYS[c]).find(Boolean);
  const times: Record<number, number> = {};
  for (const [name, min] of t.times) if (index.has(name)) times[index.get(name)!] = min;
  // Two columns close together can swap a cell; drop a time that comes later than the stop after it.
  let latest = Infinity;
  for (const i of Object.keys(times).map(Number).sort((a, b) => b - a)) {
    if (times[i] > latest) delete times[i];
    else latest = times[i];
  }
  return { line: t.line, we: weekend, ...(until && { until }), ...(days && { days }), t: times };
};

const directions: BusDirection[] = [];
const names = new Map<string, string[]>();
for (const dir of ['up', 'down'] as const) {
  const mine = pages.filter((p) => isUp(p.stops) === (dir === 'up'));
  const order = mergeOrder(mine.map((p) => p.stops));
  const trips = mine.flatMap((p) => p.trips.map((t) => ({ t, weekend: p.weekend })));
  // Keep the stops from the first anchor onwards that enough trips call at (drops one-off detours).
  const calls = (n: string) => trips.filter(({ t }) => t.times.has(n)).length;
  const firstAnchor = order.findIndex((n) => n in ANCHORS);
  const lastAnchor = order.length - 1 - [...order].reverse().findIndex((n) => n in ANCHORS);
  const kept = order.filter((n, i) => i >= firstAnchor && i <= lastAnchor && calls(n) >= trips.length * 0.1);
  const index = new Map(kept.map((n, i) => [n, i]));
  const ride = kept.slice(1).map((n, i) => {
    // Arrive, not depart: at a terminal the bus may wait before it goes on.
    const diffs = trips.flatMap(({ t }) => {
      const arrive = t.arrivals.get(n) ?? t.times.get(n);
      return arrive !== undefined && t.times.has(kept[i]) ? [arrive - t.times.get(kept[i])!] : [];
    });
    return Math.max(1, median(diffs) ?? 1);
  });
  names.set(dir, kept);
  directions.push({ id: dir, stops: kept.map(slug), ride, trips: trips.map(({ t, weekend }) => toTrip(t, weekend, index)).filter((t) => Object.keys(t.t).length > 1) });
}

// Position every stop: anchors as given, the rest in proportion to the bus time between the anchors around it.
const coords = new Map<string, { lat: number; lng: number; approx: boolean }>();
for (const dir of ['up', 'down'] as const) {
  const kept = names.get(dir)!;
  const ride = directions.find((d) => d.id === dir)!.ride;
  const at = [0];
  ride.forEach((r, i) => at.push(at[i] + r));
  const anchored = kept.flatMap((n, i) => (n in ANCHORS ? [i] : []));
  kept.forEach((n, i) => {
    if (coords.has(n)) return;
    if (n in ANCHORS) return void coords.set(n, { ...ANCHORS[n], approx: false });
    const a = [...anchored].reverse().find((x) => x < i)!;
    const b = anchored.find((x) => x > i)!;
    const f = (at[i] - at[a]) / (at[b] - at[a] || 1);
    const A = ANCHORS[kept[a]];
    const B = ANCHORS[kept[b]];
    coords.set(n, { lat: A.lat + (B.lat - A.lat) * f, lng: A.lng + (B.lng - A.lng) * f, approx: true });
  });
}

const stops: BusStop[] = [...coords].map(([name, c]) => ({
  id: slug(name),
  name,
  lat: +c.lat.toFixed(5),
  lng: +c.lng.toFixed(5),
  ...(c.approx && { approx: true }),
}));

const data: BusData = {
  version: new Date().toISOString().slice(0, 10),
  source: 'Postbus lijn 550/553, zomerdienstregeling vanaf 23-05-2026 (geen skibus, betaald tarief)',
  stops,
  directions,
};
writeFileSync('public/data/bus.json', JSON.stringify(data));
for (const d of directions) {
  console.log(`${d.id}: ${d.stops.length} stops, ${d.trips.length} trips (${d.trips.filter((t) => t.we).length} weekend)`);
}
console.log(`stops ${stops.length}, ${stops.filter((s) => s.approx).length} approximate`);
