import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { HouseInfo, type HouseSection } from '../features/huis/HouseInfo';

const CACHE_KEY = 'house-info';

function cached(): HouseSection[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as HouseSection[];
  } catch {
    return [];
  }
}

export function HuisTab() {
  const { isAdmin } = useAuth();
  const [sections, setSections] = useState<HouseSection[]>(cached);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('house_info').select('section, title, markdown, sort').order('sort');
    if (!data) return;
    setSections(data as HouseSection[]);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* offline copy unavailable */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(section: string, markdown: string) {
    const { error: err } = await supabase.from('house_info').update({ markdown, updated_at: new Date().toISOString() }).eq('section', section);
    setError(err ? 'Opslaan mislukt' : null);
    await load();
  }

  return (
    <section className="page">
      <h1>Huis</h1>
      {error && <p className="error">{error}</p>}
      {!sections.length && <p className="muted">Laden…</p>}
      <HouseInfo sections={sections} isAdmin={isAdmin} onSave={save} />
    </section>
  );
}
