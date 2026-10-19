import { useEffect, useMemo, useState } from 'react';
import { describeRoute } from './describe';
import { stopNode, withBus, type BusData } from './bus';
import { withWalks } from './walk';
import { accessPoints, findRoute, type Access } from './route';
import type { GEdge, SkiGraph } from './types';
import type { AppPlace } from '../map/places';
import type { MapPerson } from '../map/layers';
import type { MyPosition } from '../location/useLocationSharing';
import type { Profile } from '../../lib/types';
import { DIFFICULTY_LABELS } from '../../auth/ProfileSheet';
import { AREAS, type AreaKey } from './areas';

export interface NavPanelProps {
  graph: SkiGraph;
  places: AppPlace[];
  people: MapPerson[];
  position: MyPosition | null;
  closedStatusIds: Set<string>;
  notes: Map<string, string>;
  maxDifficulty: Profile['max_difficulty'];
  onDifficultyChange: (d: Profile['max_difficulty']) => void;
  onRoute: (edges: GEdge[]) => void;
  initialFrom?: string;
  initialTo?: string;
  /** Ski area to start in (the one the group decided on); the user can still switch. */
  initialArea?: AreaKey | null;
  statusNote?: string;
  /** Bus network and timetable; the "met de bus" switch only shows when this is given. */
  bus?: BusData | null;
  /** The current time, for the bus wait; defaults to now. */
  now?: Date;
}

const BUS_PREF = 'nav-bus';

function savedBusPref(): boolean {
  try {
    return localStorage.getItem(BUS_PREF) === '1';
  } catch {
    return false;
  }
}

const FAR_FROM_PISTE_M = 400;

type Resolved = { points: Access[]; note?: string } | { error: string };

/** Endpoint values: 'here', 'node:<id>', 'person:<id>', or a place id. */
function resolve(value: string, p: NavPanelProps): Resolved {
  if (value === 'here') {
    if (!p.position) return { error: 'Je locatie is nog onbekend. Kies een startpunt of deel je locatie.' };
    const points = accessPoints(p.graph, p.position.lat, p.position.lng);
    return points[0].walkM > FAR_FROM_PISTE_M
      ? { points, note: `Je bent ${Math.round(points[0].walkM)} m van de piste; de route begint bij het dichtstbijzijnde punt.` }
      : { points };
  }
  if (value.startsWith('node:')) {
    const id = value.slice(5);
    // Standing at a stop you can board there, or walk off from it.
    return { points: id.startsWith(stopNode('')) ? [{ nodeId: id, walkM: 0 }, { nodeId: `off:${id.slice(4)}`, walkM: 0 }] : [{ nodeId: id, walkM: 0 }] };
  }
  if (value.startsWith('person:')) {
    const person = p.people.find((x) => x.id === value.slice(7));
    if (!person || person.lat == null || person.lng == null) return { error: 'Van die persoon is geen locatie bekend.' };
    return { points: accessPoints(p.graph, person.lat, person.lng) };
  }
  const place = p.places.find((x) => x.id === value);
  if (!place) return { error: 'Kies een bestemming.' };
  if (!place.nodeId) return { error: `${place.name} ligt niet aan de piste — loop of neem de bus.` };
  // Every piste point beside the place counts: the nearest one may sit on a piste that only goes the wrong way.
  return { points: accessPoints(p.graph, place.lat, place.lng) };
}

const REASON: Record<'no-route' | 'difficulty' | 'closed', string> = {
  difficulty: 'Geen route op dit niveau — probeer een hoger niveau of neem een lift naar beneden.',
  'no-route': 'Geen route over de piste. Misschien is de skibus nodig.',
  closed: 'Geen route: er is een lift of piste dicht op de weg.',
};

export function NavPanel(props: NavPanelProps) {
  const { places, people, onRoute } = props;
  const [from, setFrom] = useState(props.initialFrom ?? 'here');
  const [to, setTo] = useState(props.initialTo ?? '');
  useEffect(() => {
    if (props.initialTo) setTo(props.initialTo);
  }, [props.initialTo]);
  const [byBus, setByBus] = useState(savedBusPref);
  const useBus = byBus && !!props.bus;
  const minute = Math.floor((props.now ?? new Date()).getTime() / 60_000);
  // With the bus switched on, its stops and rides join the graph; the router then picks bus or walking by time.
  const walkable = useMemo(() => withWalks(props.graph), [props.graph]);
  const graph = useMemo(
    () => (useBus ? withBus(walkable, props.bus!, new Date(minute * 60_000)) : walkable),
    [useBus, walkable, props.bus, minute],
  );
  const [area, setArea] = useState<AreaKey | ''>(props.initialArea ?? '');
  useEffect(() => {
    setArea(props.initialArea ?? '');
  }, [props.initialArea]);

  const stops = useMemo(() => graph.nodes.filter((n) => n.stop).sort((a, b) => a.label!.localeCompare(b.label!, 'nl')), [graph]);
  const lifts = useMemo(() => graph.nodes.filter((n) => n.label && !n.stop && (!area || n.area === area)).sort((a, b) => a.label!.localeCompare(b.label!, 'nl')), [graph, area]);
  const mountainPlaces = places
    .filter((p) => p.kind === 'restaurant' || p.kind === 'apres')
    .filter((p) => !area || !p.area || p.area === area || p.id === to).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const house = places.find((p) => p.kind === 'house');
  const located = people.filter((p) => p.lat != null);

  const result = useMemo(() => {
    if (!to) return null;
    const withGraph = { ...props, graph };
    const a = resolve(from, withGraph);
    if ('error' in a) return { error: a.error };
    const b = resolve(to, withGraph);
    if ('error' in b) return { error: b.error };
    const r = findRoute(graph, a.points, b.points, { maxDifficulty: props.maxDifficulty, closedStatusIds: props.closedStatusIds });
    if (!r.ok) {
      const needs = r.reason === 'difficulty' && r.needs ? DIFFICULTY_LABELS[r.needs as Profile['max_difficulty']] : null;
      if (r.reason === 'no-route' && useBus) return { error: 'Geen route over de piste of met de bus.' };
      return { error: needs ? `Geen route op dit niveau — wel op ${needs.toLowerCase()}. Of neem een lift naar beneden.` : REASON[r.reason] };
    }
    const destination = places.find((p) => p.id === to);
    const usesBus = r.edges.some((x) => x.kind === 'bus');
    return { route: r, usesBus, steps: describeRoute(r.edges, { graph, destination, notes: props.notes, startWalkM: r.startWalkM, endWalkM: r.endWalkM }), note: a.note };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, graph, useBus, props.maxDifficulty, props.closedStatusIds, props.position, places, people, props.notes]);

  useEffect(() => {
    onRoute(result && 'route' in result && result.route ? result.route.edges : []);
  }, [result, onRoute]);

  const options = (includeHere: boolean) => (
    <>
      {includeHere && <option value="here">📍 Hier</option>}
      {!includeHere && <option value="">Kies een bestemming…</option>}
      {house && <option value={house.id}>🏠 Huis</option>}
      <optgroup label="Liften">
        {lifts.map((n) => <option key={n.id} value={`node:${n.id}`}>{n.label}</option>)}
      </optgroup>
      {stops.length > 0 && (
        <optgroup label="Bushaltes">
          {stops.map((n) => <option key={n.id} value={`node:${n.id}`}>{n.label!.replace(/^Halte /, '')}</option>)}
        </optgroup>
      )}
      <optgroup label="Restaurants & après">
        {mountainPlaces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </optgroup>
      {located.length > 0 && (
        <optgroup label="Mensen">
          {located.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.name}</option>)}
        </optgroup>
      )}
    </>
  );

  return (
    <div className="card nav">
      <h2 style={{ marginTop: 0 }}>Navigatie</h2>
      <label className="field">
        Berg
        <select value={area} onChange={(e) => setArea(e.target.value as AreaKey | '')}>
          <option value="">Alle bergen</option>
          {AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
      </label>
      <label className="field">Van<select value={from} onChange={(e) => setFrom(e.target.value)}>{options(true)}</select></label>
      <label className="field">Naar<select value={to} onChange={(e) => setTo(e.target.value)}>{options(false)}</select></label>
      <label className="field">
        Max. niveau
        <select value={props.maxDifficulty} onChange={(e) => props.onDifficultyChange(e.target.value as Profile['max_difficulty'])}>
          {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {props.bus && (
        <label className="switch">
          <input
            type="checkbox"
            checked={byBus}
            onChange={(e) => {
              setByBus(e.target.checked);
              try {
                localStorage.setItem(BUS_PREF, e.target.checked ? '1' : '0');
              } catch {
                /* preference not saved */
              }
            }}
          />
          🚌 Met de bus in plaats van lopen
        </label>
      )}
      {props.statusNote && <p className="muted">{props.statusNote}</p>}
      {result && 'error' in result && result.error && <p className="error">{result.error}</p>}
      {result && 'route' in result && result.route && (
        <>
          {result.note && <p className="muted">{result.note}</p>}
          {result.usesBus && props.bus && (
            <p className="muted">🚌 {props.bus.source}. De wachttijd is een schatting; de haltes liggen bij benadering.</p>
          )}
          <p className="muted">± {result.route.minutes} min · {(result.route.totalM / 1000).toFixed(1)} km</p>
          <ol className="steps" aria-label="Route">
            {result.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}
    </div>
  );
}
