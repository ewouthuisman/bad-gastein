import { useState } from 'react';
import { useMyLocation } from './LocationProvider';
import { formatAgo } from './freshness';

export function ShareLocationCard() {
  const { shareNow, lastSent, error } = useMyLocation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function share() {
    setBusy(true);
    setDone(false);
    setDone(await shareNow());
    setBusy(false);
  }

  return (
    <div>
      <h2>Locatie</h2>
      <p className="muted">Je locatie wordt gedeeld zolang de app open is. Hier deel je hem direct.</p>
      <button type="button" className="btn primary" onClick={() => void share()} disabled={busy}>
        {busy ? 'Locatie zoeken…' : '📍 Deel mijn locatie'}
      </button>
      {done && !error && <p className="muted">Gedeeld ✅</p>}
      {!done && lastSent && !error && <p className="muted">Laatst gedeeld {formatAgo(lastSent, new Date())}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
