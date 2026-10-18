import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { safeUrl } from '../../lib/safeUrl';

const DOWNLOADS = 'https://www.skigastein.com/en/press-portal/downloads/';
const SKI_AMADE = 'https://www.skiamade.com/en/winter/piste-map';

/** Official piste maps: a PDF link an admin can set once Skigastein publishes the winter map, plus fallbacks. */
export function PisteMaps() {
  const [pdf, setPdf] = useState<string | null>(null);
  useEffect(() => {
    void supabase
      .from('app_config')
      .select('value')
      .eq('key', 'piste_map_url')
      .maybeSingle()
      .then(({ data }) => setPdf(safeUrl(data?.value as string | undefined) ?? null));
  }, []);
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Pistekaarten</h2>
      <p className="muted">De kaart hierboven (uit OpenStreetMap) werkt ook zonder bereik.</p>
      <div className="row">
        {pdf && <a className="btn small primary" href={pdf} target="_blank" rel="noreferrer">Officiële pistekaart (PDF)</a>}
        <a className="btn small" href={DOWNLOADS} target="_blank" rel="noreferrer">Skigastein downloads</a>
        <a className="btn small" href={SKI_AMADE} target="_blank" rel="noreferrer">Ski amadé kaart</a>
      </div>
    </div>
  );
}
