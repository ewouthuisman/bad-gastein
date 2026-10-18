import { useState } from 'react';
import { platform, subscribePush } from './subscribe';

export function InstallGuide({ platformOverride }: { platformOverride?: 'ios' | 'android' | 'other' }) {
  const p = platformOverride ?? platform();
  return (
    <div>
      <h2>Installeren op je telefoon</h2>
      {p === 'ios' && (
        <ol>
          <li>Open deze pagina in <strong>Safari</strong>.</li>
          <li>Tik op het deel-icoon (vierkant met pijltje omhoog).</li>
          <li>Kies <strong>Zet op beginscherm</strong> en tik op Voeg toe.</li>
          <li>Open de app vanaf je beginscherm en zet daarna meldingen aan.</li>
        </ol>
      )}
      {p === 'android' && (
        <ol>
          <li>Open deze pagina in <strong>Chrome</strong>.</li>
          <li>Tik op het menu (drie puntjes rechtsboven).</li>
          <li>Kies <strong>App installeren</strong> (of Toevoegen aan startscherm).</li>
        </ol>
      )}
      {p === 'other' && <p>Open deze link op je telefoon en zet de app op je beginscherm.</p>}
    </div>
  );
}

export function NotificationsCard() {
  const [state, setState] = useState<'idle' | 'busy' | 'on' | 'unsupported' | 'denied' | 'error'>('idle');

  async function enable() {
    setState('busy');
    const r = await subscribePush();
    setState(r.ok ? 'on' : r.reason);
  }

  return (
    <div>
      <h2>Meldingen</h2>
      <p className="muted">Voor besluiten, stemherinneringen en als iemand vraagt waar je bent.</p>
      {state === 'on' ? (
        <p>Meldingen staan aan ✅</p>
      ) : (
        <button type="button" className="btn primary" onClick={enable} disabled={state === 'busy'}>Meldingen aanzetten</button>
      )}
      {state === 'unsupported' && (
        <>
          <p className="error">Installeer de app eerst op je beginscherm; daarna kunnen meldingen aan.</p>
          <InstallGuide />
        </>
      )}
      {state === 'denied' && <p className="error">Meldingen zijn geweigerd. Zet ze aan via de instellingen van je telefoon voor deze app.</p>}
      {state === 'error' && <p className="error">Er ging iets mis. Probeer het later nog eens.</p>}
    </div>
  );
}
