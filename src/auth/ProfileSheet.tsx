import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import type { Profile } from '../lib/types';
import { NotificationsCard } from '../features/push/InstallGuide';

export const PALETTE = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#94d82d', '#845ef7'];

export const DIFFICULTY_LABELS: Record<Profile['max_difficulty'], string> = {
  novice: 'Alleen oefenweides',
  easy: 'Blauw',
  intermediate: 'Rood',
  advanced: 'Zwart',
};

export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { profile, isAdmin, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [color, setColor] = useState(profile?.color ?? PALETTE[0]);
  const [difficulty, setDifficulty] = useState<Profile['max_difficulty']>(profile?.max_difficulty ?? 'intermediate');
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  async function save() {
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() || profile!.display_name, color, max_difficulty: difficulty })
      .eq('id', profile!.id);
    if (err) {
      setError('Opslaan mislukt');
      return;
    }
    await refreshProfile();
    onClose();
  }

  return (
    <div className="card" role="dialog" aria-label="Profiel">
      <h2>Profiel</h2>
      <label className="field">Naam<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="field">
        Kleur
        <div className="row">
          {PALETTE.map((c) => (
            <button key={c} type="button" aria-label={`Kleur ${c}`} onClick={() => setColor(c)}
              style={{ width: 32, height: 32, borderRadius: 16, background: c, border: c === color ? '3px solid white' : '0' }} />
          ))}
        </div>
      </div>
      <label className="field">
        Max. pisteniveau
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Profile['max_difficulty'])}>
          {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <NotificationsCard />
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary" type="button" onClick={save}>Opslaan</button>
        <button className="btn" type="button" onClick={onClose}>Sluiten</button>
        {isAdmin && <Link className="btn" to="/admin">Beheer</Link>}
        <button className="btn" type="button" onClick={() => supabase.auth.signOut()}>Uitloggen</button>
      </div>
    </div>
  );
}
