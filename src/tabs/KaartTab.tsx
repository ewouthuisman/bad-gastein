import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapView, type MapFilter } from '../features/map/MapView';
import { usePlaces } from '../features/map/places';
import { usePeople } from '../features/location/usePeople';
import { useMyLocation } from '../features/location/LocationProvider';
import { formatAgo, locationFreshness } from '../features/location/freshness';
import { loadGraph } from '../lib/staticData';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import type { SkiGraph } from '../features/nav/types';
import { PlaceDetails } from '../features/map/PlaceDetails';

const FILTERS: { key: MapFilter; label: string }[] = [
  { key: 'people', label: 'Mensen' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'apres', label: 'Après' },
  { key: 'lifts', label: 'Liften' },
];

export function KaartTab() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { shareNow } = useMyLocation();
  const places = usePlaces();
  const people = usePeople();
  const [graph, setGraph] = useState<SkiGraph | null>(null);
  const [filters, setFilters] = useState<Set<MapFilter>>(new Set(['people', 'restaurant', 'apres', 'lifts']));
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [pingState, setPingState] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void loadGraph().then(setGraph);
    const t = setInterval(() => setNow(new Date()), 30_000);
    // Opened from a "waar ben je?" notification: share straight away.
    if (window.location.hash.includes('share=1')) void shareNow();
    return () => clearInterval(t);
  }, [shareNow]);

  const place = places.find((p) => p.id === placeId);
  const person = people.find((p) => p.id === personId);
  const others = useMemo(() => people.filter((p) => p.id !== session?.user.id), [people, session]);

  function toggle(f: MapFilter) {
    const next = new Set(filters);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    setFilters(next);
  }

  async function ping(targetUserId: string) {
    setPingState('Versturen…');
    const { data, error: err } = await supabase.functions.invoke('ping-user', { body: { targetUserId } });
    if (err) setPingState('Kon geen melding sturen (misschien vroeg je het net al).');
    else if (!data?.sent) setPingState('Die persoon heeft meldingen nog niet aangezet.');
    else setPingState('Gevraagd! Je ziet de locatie zodra die persoon de app opent.');
  }

  return (
    <section className="page full">
      <h1 className="visually-hidden">Kaart</h1>
      <MapView
        graph={graph}
        places={places}
        people={people}
        filters={filters}
        onSelectPlace={(id) => { setPersonId(null); setPlaceId(id); }}
        onSelectPerson={(id) => { setPlaceId(null); setPingState(null); setPersonId(id); }}
      />
      <div className="map-top">
        <div className="row">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`chip ${filters.has(f.key) ? 'on' : ''}`} onClick={() => toggle(f.key)}>{f.label}</button>
          ))}
        </div>
        <div className="row people-row">
          {others.map((p) => {
            const fresh = p.updatedAt ? locationFreshness(p.updatedAt, now) : 'hidden';
            return (
              <button key={p.id} type="button" className="chip person-chip" style={{ borderColor: p.color, opacity: fresh === 'fresh' ? 1 : 0.55 }}
                onClick={() => { setPlaceId(null); setPingState(null); setPersonId(p.id); }}>
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {person && (
        <div className="sheet" role="dialog" aria-label={person.name}>
          <button type="button" className="sheet-close" aria-label="Sluiten" onClick={() => setPersonId(null)}>×</button>
          <h2 style={{ marginTop: 0 }}><span className="dot" style={{ background: person.color }} /> {person.name}</h2>
          <p className="muted">
            {person.updatedAt ? `Laatst gezien ${formatAgo(person.updatedAt, now)}` : 'Nog geen locatie gedeeld'}
          </p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => void ping(person.id)}>Waar ben je?</button>
            {person.lat != null && (
              <button type="button" className="btn" onClick={() => navigate(`/berg?toPerson=${person.id}`)}>Route naar {person.name}</button>
            )}
          </div>
          {pingState && <p className="muted">{pingState}</p>}
        </div>
      )}

      {place && (
        <div className="sheet" role="dialog" aria-label={place.name}>
          <button type="button" className="sheet-close" aria-label="Sluiten" onClick={() => setPlaceId(null)}>×</button>
          <PlaceDetails place={place} />
          {place.nodeId && (
            <div className="row sheet-actions">
              <button type="button" className="btn primary" onClick={() => navigate(`/berg?to=${encodeURIComponent(place.id)}`)}>Route hierheen</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
