import { useEffect, useMemo, useState } from 'react';
import { describeRoute } from './describe';
import { findRoute, nearestNode } from './route';
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
}

const FAR_FROM_PISTE_M = 400;

type Resolved = { nodeIds: string[]; note?: string } | { error: string };

/** Endpoint values: 'here', 'node:<id>', 'person:<id>', or a place id. */
function resolve(value: string, p: NavPanelProps): Resolved {
  if (value === 'here') {
    if (!p.position) return { error: 'Je locatie is nog onbekend. Kies een startpunt of deel je locatie.' };
    const n = nearestNode(p.graph, p.position.lat, p.position.lng);
    return n.distM > FAR_FROM_PISTE_M
      ? { nodeIds: [n.nodeId], note: `Je bent ${Math.round(n.distM)} m van de piste; de route begint bij het dichtstbijzijnde punt.` }
      : { nodeIds: [n.nodeId] };
  }
  if (value.startsWith('node:')) return { nodeIds: [value.slice(5)] };
  if (value.startsWith('person:')) {
    const person = p.people.find((x) => x.id === value.slice(7));
    if (!person || person.lat == null || person.lng == null) return { error: 'Van die persoon is geen locatie bekend.' };
    return { nodeIds: [nearestNode(p.graph, person.lat, person.lng).nodeId] };
  }
  const place = p.places.find((x) => x.id === value);
  if (!place) return { error: 'Kies een bestemming.' };
  if (!place.nodeId) return { error: `${place.name} ligt niet aan de piste — loop of neem de bus.` };
  return { nodeIds: place.nodeIds?.length ? place.nodeIds : [place.nodeId] };
}

const REASON: Record<'no-route' | 'difficulty' | 'closed', string> = {
  difficulty: 'Geen route op dit niveau — probeer een hoger niveau of neem een lift naar beneden.',
  'no-route': 'Geen route over de piste. Misschien is de skibus nodig.',
  closed: 'Geen route: er is een lift of piste dicht op de weg.',
};

export function NavPanel(props: NavPanelProps) {
  const { graph, places, people, onRoute } = props;
  const [from, setFrom] = useState(props.initialFrom ?? 'here');
  const [to, setTo] = useState(props.initialTo ?? '');
  useEffect(() => {
    if (props.initialTo) setTo(props.initialTo);
  }, [props.initialTo]);
  const [area, setArea] = useState<AreaKey | ''>(props.initialArea ?? '');
  useEffect(() => {
    setArea(props.initialArea ?? '');
  }, [props.initialArea]);

  const lifts = useMemo(() => graph.nodes.filter((n) => n.label && (!area || n.area === area)).sort((a, b) => a.label!.localeCompare(b.label!, 'nl')), [graph, area]);
  const mountainPlaces = places
    .filter((p) => p.kind === 'restaurant' || p.kind === 'apres')
    .filter((p) => !area || !p.area || p.area === area || p.id === to).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const house = places.find((p) => p.kind === 'house');
  const located = people.filter((p) => p.lat != null);

  const result = useMemo(() => {
    if (!to) return null;
    const a = resolve(from, props);
    if ('error' in a) return { error: a.error };
    const b = resolve(to, props);
    if ('error' in b) return { error: b.error };
    const r = findRoute(graph, a.nodeIds[0], b.nodeIds, { maxDifficulty: props.maxDifficulty, closedStatusIds: props.closedStatusIds });
    if (!r.ok) return { error: REASON[r.reason] };
    const destination = places.find((p) => p.id === to);
    return { route: r, steps: describeRoute(r.edges, { graph, destination, notes: props.notes }), note: a.note };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, graph, props.maxDifficulty, props.closedStatusIds, props.position, places, people, props.notes]);

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
      {props.statusNote && <p className="muted">{props.statusNote}</p>}
      {result && 'error' in result && result.error && <p className="error">{result.error}</p>}
      {result && 'route' in result && result.route && (
        <>
          {result.note && <p className="muted">{result.note}</p>}
          <p className="muted">± {result.route.minutes} min · {(result.route.totalM / 1000).toFixed(1)} km</p>
          <ol className="steps" aria-label="Route">
            {result.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}
    </div>
  );
}
