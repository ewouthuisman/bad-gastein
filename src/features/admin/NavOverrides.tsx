import { useMemo, useState } from 'react';
import { haversineM } from '../../lib/geo';
import type { Difficulty, GEdge, Place, SkiGraph } from '../nav/types';

export interface OverrideRow {
  op: 'add_edge' | 'block_edge' | 'set_attr' | 'note';
  payload: Record<string, unknown>;
}

export interface StoredOverride extends OverrideRow {
  id: string;
}

interface Props {
  graph: SkiGraph;
  places: Place[];
  overrides: StoredOverride[];
  onInsert: (rows: OverrideRow[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const COLOURS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Blauw' },
  { value: 'intermediate', label: 'Rood' },
  { value: 'advanced', label: 'Zwart' },
  { value: 'freeride', label: 'Skiroute (nooit routeren)' },
];
const COLOUR_NAME: Partial<Record<Difficulty, string>> = { novice: 'blauw', easy: 'blauw', intermediate: 'rood', advanced: 'zwart', expert: 'skiroute', freeride: 'skiroute' };

interface WayGroup {
  key: string;
  label: string;
  edges: GEdge[];
  difficulty?: Difficulty;
}

function wayGroups(g: SkiGraph): WayGroup[] {
  const byWay = new Map<string, GEdge[]>();
  for (const e of g.edges) {
    if (e.kind === 'link' || e.id.endsWith('r')) continue; // reverse copies follow their forward edge
    const k = e.osmId ?? e.id;
    byWay.set(k, [...(byWay.get(k) ?? []), e]);
  }
  return [...byWay.entries()].map(([key, edges]) => {
    const f = edges[0];
    const label =
      f.kind === 'lift'
        ? `Lift ${f.name ?? key}`
        : `Piste ${f.ref ?? f.name ?? '?'}${f.difficulty ? ` (${COLOUR_NAME[f.difficulty]})` : ''}${f.ref && f.name ? ` ${f.name}` : ''} · ${key}`;
    return { key, label, edges, difficulty: f.difficulty };
  });
}

function GroupActions({ group, onInsert }: { group: WayGroup; onInsert: Props['onInsert'] }) {
  const [colour, setColour] = useState<Difficulty>(group.difficulty ?? 'intermediate');
  const [note, setNote] = useState('');
  const ids = group.edges.map((e) => e.id);
  return (
    <div role="group" aria-label={group.label} className="override-group">
      <strong>{group.label}</strong>
      <div className="row">
        <button type="button" className="btn small" onClick={() => void onInsert(ids.map((edgeId) => ({ op: 'block_edge', payload: { edgeId } })))}>Blokkeren</button>
        {group.edges[0].kind === 'piste' && (
          <>
            <label className="row">Kleur
              <select value={colour} onChange={(e) => setColour(e.target.value as Difficulty)}>
                {COLOURS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <button type="button" className="btn small" onClick={() => void onInsert(ids.map((edgeId) => ({ op: 'set_attr', payload: { edgeId, attrs: { difficulty: colour } } })))}>Kleur opslaan</button>
          </>
        )}
      </div>
      <div className="row">
        <label className="row">Notitie<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button type="button" className="btn small" disabled={!note.trim()}
          onClick={() => void onInsert(ids.map((edgeId) => ({ op: 'note', payload: { edgeId, text: note.trim() } })))}>Notitie opslaan</button>
      </div>
    </div>
  );
}

/** Admin tool to correct the piste network: block, recolour, annotate, or connect points. */
export function NavOverrides({ graph, places, overrides, onInsert, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const groups = useMemo(() => wayGroups(graph), [graph]);
  const q = query.trim().toLowerCase();
  const hits = q
    ? groups.filter((g) => {
        const f = g.edges[0];
        return f.ref?.toLowerCase() === q || f.ref?.toLowerCase().startsWith(q) || f.name?.toLowerCase().includes(q) || g.key.includes(q);
      }).slice(0, 20)
    : [];
  const points = [
    ...graph.nodes.filter((n) => n.label).map((n) => ({ id: n.id, label: n.label!, lat: n.lat, lng: n.lng })),
    ...places.filter((p) => p.nodeId).map((p) => {
      const n = graph.nodes.find((x) => x.id === p.nodeId)!;
      return { id: p.nodeId!, label: p.name, lat: n?.lat ?? p.lat, lng: n?.lng ?? p.lng };
    }),
  ].sort((a, b) => a.label.localeCompare(b.label, 'nl'));

  function connect() {
    const a = points.find((p) => p.id === from);
    const b = points.find((p) => p.id === to);
    if (!a || !b || a.id === b.id) return;
    const lengthM = Math.round(haversineM(a, b));
    const edge = (x: typeof a, y: typeof a): GEdge => ({
      id: `manual:${x.id}:${y.id}`, from: x.id, to: y.id, kind: 'link', lengthM, geometry: [[x.lat, x.lng], [y.lat, y.lng]],
    });
    void onInsert([
      { op: 'add_edge', payload: { edge: edge(a, b) } },
      { op: 'add_edge', payload: { edge: edge(b, a) } },
    ]);
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Piste of lift aanpassen</h2>
        <label className="field">Zoek piste of lift<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="bijv. 27 of Jungeralm" /></label>
        {hits.map((g) => <GroupActions key={g.key} group={g} onInsert={onInsert} />)}
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Verbinding toevoegen</h2>
        <p className="muted">Voor stukjes lopen/schaatsen die in de kaartdata ontbreken.</p>
        <label className="field">Verbinding van
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Kies…</option>
            {points.map((p) => <option key={`f${p.id}${p.label}`} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="field">Verbinding naar
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Kies…</option>
            {points.map((p) => <option key={`t${p.id}${p.label}`} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn primary" disabled={!from || !to || from === to} onClick={connect}>Verbinding toevoegen</button>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Bestaande correcties ({overrides.length})</h2>
        <ul className="override-list">
          {overrides.map((o) => (
            <li key={o.id} className="row">
              <span>{o.op} · {String(o.payload.edgeId ?? (o.payload.edge as GEdge | undefined)?.id ?? '')}{o.payload.text ? ` · “${String(o.payload.text)}”` : ''}</span>
              <button type="button" className="btn small" onClick={() => void onDelete(o.id)}>Verwijderen</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
