import type { AppPlace } from './places';
import { safeUrl } from '../../lib/safeUrl';

const KIND_LABEL = {
  restaurant: 'Restaurant op de berg',
  apres: 'Après-ski',
  dinner: 'Restaurant in het dal',
  house: 'Ons huis',
  other: 'Plek',
} as const;

const stars = (n: number) => n.toFixed(1).replace('.', ',');

/** Tags that say nothing useful here (nearly every place has them). */
const HIDDEN_TAGS = new Set(['bier', 'kindermenu', 'honden welkom']);
const visibleTags = (tags: string[]) => tags.filter((t) => !HIDDEN_TAGS.has(t.toLowerCase()));

/** Name, type and menu (text in the app, or a link) for a place. */
export function PlaceDetails({ place }: { place: AppPlace }) {
  const menuUrl = safeUrl(place.menuUrl);
  const website = safeUrl(place.website);
  const g = place.google;
  const mapsUrl = safeUrl(g?.mapsUri);
  const tags = visibleTags(g?.tags ?? []);
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{place.name}</h2>
      <p className="muted">{KIND_LABEL[place.kind]}{place.nodeId ? '' : place.kind === 'house' ? '' : ' · niet via de piste bereikbaar'}</p>
      {g && (
        <div className="google-info">
          {g.permanentlyClosed && <p><strong>Volgens Google definitief gesloten</strong></p>}
          {g.rating != null && (
            <p className="google-rating">
              <strong>★ {stars(g.rating)}</strong>
              {g.ratingCount != null && <span className="muted"> · {g.ratingCount} recensies op Google</span>}
              {g.priceLevel != null && <span className="muted"> · {'€'.repeat(g.priceLevel)}</span>}
            </p>
          )}
          {g.summary && <p className="muted">{g.summary}</p>}
          {tags.length > 0 && <p className="row">{tags.map((t) => <span key={t} className="chip">{t}</span>)}</p>}
          {g.hours && g.hours.length > 0 && (
            <details>
              <summary>Openingstijden</summary>
              <ul className="muted">{g.hours.map((h) => <li key={h}>{h}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      {place.menuText && (
        <details>
          <summary>Menukaart</summary>
          <pre className="menu-text">{place.menuText}</pre>
        </details>
      )}
      <div className="row place-links">
        {menuUrl && <a className="btn small" href={menuUrl} target="_blank" rel="noreferrer">Menukaart openen</a>}
        {mapsUrl && <a className="btn small" href={mapsUrl} target="_blank" rel="noreferrer">Google Maps</a>}
        {g?.phone && <a className="btn small" href={`tel:${g.phone.replace(/[^+\d]/g, '')}`}>Bel</a>}
        {website && <a className="btn small" href={website} target="_blank" rel="noreferrer">Website</a>}
        {!menuUrl && !place.menuText && <span className="muted">Nog geen menukaart</span>}
      </div>
    </div>
  );
}
