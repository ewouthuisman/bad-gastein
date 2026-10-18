import { useState } from 'react';
import { InstallGuide } from './InstallGuide';
import { isStandalone } from './subscribe';

const KEY = 'install-banner-dismissed';

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** First-launch hint for people who opened the shared link in the browser instead of the installed app. */
export function InstallBanner() {
  const [hidden, setHidden] = useState(() => isStandalone() || dismissed());
  if (hidden) return null;
  function close() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* private mode: the banner simply shows again next time */
    }
    setHidden(true);
  }
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="card" role="dialog" aria-label="Installeren">
        <InstallGuide />
        <p className="muted">Geïnstalleerd werkt alles beter: meldingen, volledig scherm en offline kaarten.</p>
        <button type="button" className="btn" onClick={close}>Later</button>
      </div>
    </div>
  );
}
