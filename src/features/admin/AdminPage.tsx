import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useNavData } from '../nav/useNavData';
import { usePlaces } from '../map/places';
import { NavOverrides, type OverrideRow, type StoredOverride } from './NavOverrides';

function ConfigField({ k, label, hint }: { k: string; label: string; hint: string }) {
  const [value, setValue] = useState('');
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from('app_config').select('value').eq('key', k).maybeSingle().then(({ data }) => setValue((data?.value as string) ?? ''));
  }, [k]);
  async function save() {
    const { error } = await supabase.from('app_config').update({ value: value.trim() }).eq('key', k);
    setState(error ? 'Opslaan mislukt' : 'Opgeslagen ✅');
  }
  return (
    <div className="field">
      <label className="field">{label}<input value={value} onChange={(e) => setValue(e.target.value)} /></label>
      <p className="muted">{hint}</p>
      <div className="row">
        <button type="button" className="btn small primary" onClick={() => void save()}>Opslaan</button>
        {state && <span className="muted">{state}</span>}
      </div>
    </div>
  );
}

export function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const { base } = useNavData();
  const places = usePlaces();
  const [overrides, setOverrides] = useState<StoredOverride[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('nav_overrides').select('id, op, payload').order('created_at');
    setOverrides((data as StoredOverride[]) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/kaart" replace />;

  async function insert(rows: OverrideRow[]) {
    await supabase.from('nav_overrides').insert(rows);
    await load();
  }
  async function remove(id: string) {
    await supabase.from('nav_overrides').delete().eq('id', id);
    await load();
  }

  return (
    <section className="page">
      <h1>Beheer</h1>
      <p><Link to="/kaart">← Terug</Link></p>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Instellingen</h2>
        <ConfigField k="group_code" label="Groepscode" hint="Nodig om een account te maken. Deel hem alleen met de groep." />
        <ConfigField k="piste_map_url" label="Link naar officiële pistekaart (PDF)" hint="Plak hier de PDF-link zodra Skigastein de winterkaart publiceert." />
      </div>
      {base ? (
        <NavOverrides graph={base} places={places} overrides={overrides} onInsert={insert} onDelete={remove} />
      ) : (
        <p className="muted">Pistenetwerk laden…</p>
      )}
    </section>
  );
}
