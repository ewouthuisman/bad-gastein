import type { AppPlace } from './places';

const KIND_LABEL = {
  restaurant: 'Restaurant op de berg',
  apres: 'Après-ski',
  dinner: 'Restaurant in het dal',
  house: 'Ons huis',
  other: 'Plek',
} as const;

/** Name, type and menu (text in the app, or a link) for a place. */
export function PlaceDetails({ place }: { place: AppPlace }) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{place.name}</h2>
      <p className="muted">{KIND_LABEL[place.kind]}{place.nodeId ? '' : place.kind === 'house' ? '' : ' · niet via de piste bereikbaar'}</p>
      {place.menuText && (
        <details>
          <summary>Menukaart</summary>
          <pre className="menu-text">{place.menuText}</pre>
        </details>
      )}
      <div className="row">
        {place.menuUrl && <a className="btn small" href={place.menuUrl} target="_blank" rel="noreferrer">Menukaart openen</a>}
        {place.website && <a className="btn small" href={place.website} target="_blank" rel="noreferrer">Website</a>}
        {!place.menuUrl && !place.menuText && <span className="muted">Nog geen menukaart</span>}
      </div>
    </div>
  );
}
