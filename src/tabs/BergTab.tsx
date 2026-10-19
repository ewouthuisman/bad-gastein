import { useCallback, useEffect, useMemo, useState } from 'react';
import { closedStatus } from '../features/nav/closedStatus';
import { useSearchParams } from 'react-router-dom';
import { MapView } from '../features/map/MapView';
import { usePlaces } from '../features/map/places';
import { usePeople } from '../features/location/usePeople';
import { useMyLocation } from '../features/location/LocationProvider';
import { NavPanel } from '../features/nav/NavPanel';
import { useNavData } from '../features/nav/useNavData';
import { loadBus } from '../lib/busData';
import type { BusData } from '../features/nav/bus';
import { LiftStatus } from '../features/berg/LiftStatus';
import { WeatherCard } from '../features/berg/WeatherCard';
import { PisteMaps } from '../features/berg/PisteMaps';
import { useDecidedArea } from '../features/planning/useTodayArea';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { GEdge } from '../features/nav/types';
import type { Profile } from '../lib/types';

export function BergTab() {
  const [params] = useSearchParams();
  const { profile, refreshProfile } = useAuth();
  const { position } = useMyLocation();
  const places = usePlaces();
  const todayArea = useDecidedArea();
  const people = usePeople();
  const { graph, notes, status } = useNavData();
  const [bus, setBus] = useState<BusData | null>(null);
  const [route, setRoute] = useState<GEdge[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [difficulty, setDifficulty] = useState<Profile['max_difficulty']>(profile?.max_difficulty ?? 'intermediate');

  useEffect(() => {
    if (profile) setDifficulty(profile.max_difficulty);
  }, [profile]);
  useEffect(() => {
    void loadBus().then(setBus);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { closed, stale } = useMemo(() => closedStatus(status, now), [status, now]);
  const onRoute = useCallback((edges: GEdge[]) => setRoute(edges), []);
  const to = params.get('to') ?? (params.get('toPerson') ? `person:${params.get('toPerson')}` : undefined);

  async function changeDifficulty(d: Profile['max_difficulty']) {
    setDifficulty(d);
    if (profile) {
      await supabase.from('profiles').update({ max_difficulty: d }).eq('id', profile.id);
      await refreshProfile();
    }
  }

  return (
    <section className="page">
      <h1>Berg</h1>
      <div className="berg-map">
        <MapView graph={graph} places={places} people={people} route={route} />
      </div>
      {graph ? (
        <NavPanel
          graph={graph}
          places={places}
          people={people}
          position={position}
          closedStatusIds={closed}
          notes={notes}
          maxDifficulty={difficulty}
          onDifficultyChange={(d) => void changeDifficulty(d)}
          onRoute={onRoute}
          initialTo={to}
          initialArea={todayArea}
          bus={bus}
          now={now}
          statusNote={stale ? 'Liftstatus is verouderd; de route houdt geen rekening met dichte liften.' : undefined}
        />
      ) : (
        <div className="card muted">Pistenetwerk laden…</div>
      )}
      <LiftStatus items={status} now={now} />
      <WeatherCard />
      <PisteMaps />
    </section>
  );
}
