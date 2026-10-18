import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { DrinkKind } from './score';

const DRINKS: { kind: DrinkKind; label: string; icon: string }[] = [
  { kind: 'beer_03', label: 'Bier 0,3', icon: '🍺' },
  { kind: 'beer_05', label: 'Bier 0,5', icon: '🍻' },
  { kind: 'jager', label: 'Jägermeister', icon: '🦌' },
  { kind: 'wine', label: 'Wijn', icon: '🍷' },
  { kind: 'shot', label: 'Shot', icon: '🥃' },
  { kind: 'gluhwein', label: 'Glühwein', icon: '♨️' },
];

export function DrinkButtons() {
  const [last, setLast] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 10_000);
    return () => clearTimeout(t);
  }, [last]);

  async function log(kind: DrinkKind, label: string) {
    const { data, error: err } = await supabase.from('drinks').insert({ kind }).select('id').single();
    if (err || !data) {
      setError('Niet gelukt, probeer opnieuw');
      return;
    }
    setError(null);
    setLast({ id: data.id as string, label });
    navigator.vibrate?.(30);
  }

  async function undo() {
    if (!last) return;
    await supabase.from('drinks').delete().eq('id', last.id);
    setLast(null);
  }

  return (
    <div>
      <div className="drink-grid">
        {DRINKS.map((d) => (
          <button key={d.kind} type="button" className="btn drink-btn" onClick={() => void log(d.kind, d.label)}>
            <span className="drink-icon" aria-hidden="true">{d.icon}</span>
            {d.label}
          </button>
        ))}
      </div>
      {last && (
        <div className="toast row">
          <span>{last.label} gelogd. Proost!</span>
          <button type="button" className="btn small" onClick={() => void undo()}>Ongedaan maken</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
