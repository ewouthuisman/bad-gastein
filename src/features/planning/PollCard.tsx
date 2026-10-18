import { useState } from 'react';
import { tally, type TallyVote } from './tally';
import type { AppPlace } from '../map/places';
import type { PlaceKind } from '../nav/types';
import { safeUrl } from '../../lib/safeUrl';

export type PollKind = 'lunch_place' | 'apres_place' | 'dinner_place' | 'early_ski' | 'lunch_time' | 'apres_or_spa';

export interface Poll {
  id: string;
  day: string;
  kind: PollKind;
  decided_option_id: string | null;
}

export interface PollOption {
  id: string;
  label: string;
  place_id: string | null;
  created_by: string | null;
}

export type Proposal = { place: AppPlace } | { newName: string; link: string };

export interface PollCardProps {
  poll: Poll;
  options: PollOption[];
  votes: TallyVote[];
  names: Map<string, string>;
  myUserId: string;
  isAdmin: boolean;
  places: AppPlace[];
  onVote: (optionId: string) => void;
  onDecide: (optionId: string) => void;
  onUndecide: () => void;
  onPropose: (p: Proposal) => void;
  onRoute: (placeId: string) => void;
  onRemoveOption: (optionId: string) => void;
}

export const POLL_TITLE: Record<PollKind, string> = {
  early_ski: 'Vroeg skiën of uitslapen?',
  lunch_place: 'Waar lunchen we?',
  lunch_time: 'Hoe laat lunch?',
  apres_place: 'Welke après-ski?',
  apres_or_spa: 'Après-ski of spa/zwembad?',
  dinner_place: 'Waar eten we vanavond?',
};

const PLACE_KIND: Partial<Record<PollKind, PlaceKind>> = {
  lunch_place: 'restaurant',
  apres_place: 'apres',
  dinner_place: 'dinner',
};

export function PollCard(props: PollCardProps) {
  const { poll, options, votes, names, myUserId, isAdmin, places } = props;
  const [picking, setPicking] = useState(false);
  const [newName, setNewName] = useState('');
  const [link, setLink] = useState('');
  const [query, setQuery] = useState('');
  const placeKind = PLACE_KIND[poll.kind];
  const rows = tally(options, votes, names);
  const mine = votes.find((v) => v.user_id === myUserId)?.option_id;
  const decided = options.find((o) => o.id === poll.decided_option_id);
  const leader = rows[0]?.count ? rows[0].optionId : null;
  const byId = new Map(options.map((o) => [o.id, o]));
  const candidates = placeKind
    ? places
        .filter((p) => p.kind === placeKind || (placeKind === 'dinner' && p.kind === 'restaurant' && !p.nodeId))
        .filter((p) => !options.some((o) => o.label === p.name))
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 40)
    : [];
  const placeOf = (o: PollOption) => places.find((p) => p.dbId === o.place_id || p.id === o.place_id);

  if (decided) {
    const place = placeOf(decided);
    return (
      <div className="card poll decided">
        <h3>{POLL_TITLE[poll.kind]}</h3>
        <p><strong>Besloten: {decided.label}</strong></p>
        {place && (place.menuText || place.menuUrl) && (
          <details>
            <summary>Menukaart</summary>
            {place.menuText && <pre className="menu-text">{place.menuText}</pre>}
            {safeUrl(place.menuUrl) && <a href={safeUrl(place.menuUrl)} target="_blank" rel="noreferrer">Menukaart openen</a>}
          </details>
        )}
        <div className="row">
          {decided.place_id && <button type="button" className="btn small primary" onClick={() => props.onRoute(decided.place_id!)}>Route</button>}
          {isAdmin && <button type="button" className="btn small" onClick={props.onUndecide}>Besluit terugdraaien</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="card poll">
      <h3>{POLL_TITLE[poll.kind]}</h3>
      <div className="options">
        {rows.map((r) => {
          const o = byId.get(r.optionId)!;
          return (
            <div key={o.id} className="option">
              <button type="button" className={`btn option-btn ${mine === o.id ? 'primary' : ''}`} onClick={() => props.onVote(o.id)}>
                {o.label} <span className="count">{r.count}</span>
              </button>
              {(isAdmin || o.created_by === myUserId) && (
                <button type="button" className="remove-option" aria-label={`Verwijder ${o.label}`} onClick={() => props.onRemoveOption(o.id)}>✕</button>
              )}
              {r.voters.length > 0 && <div className="voters muted">{r.voters.join(', ')}</div>}
            </div>
          );
        })}
        {!options.length && <p className="muted">Nog geen opties. Stel een plek voor!</p>}
      </div>
      <div className="row">
        {placeKind && <button type="button" className="btn small" onClick={() => setPicking(true)}>Plek voorstellen</button>}
        {isAdmin && (
          <button type="button" className="btn small primary" disabled={!leader} onClick={() => leader && props.onDecide(leader)}>Besluit</button>
        )}
      </div>

      {picking && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setPicking(false)}>
          <div className="card" role="dialog" aria-label="Plek voorstellen">
            <h2>Plek voorstellen</h2>
            <input className="search" placeholder="Zoeken…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Zoeken" />
            <div className="pick-list">
              {candidates.map((p) => (
                <button key={p.id} type="button" className="btn small" onClick={() => { props.onPropose({ place: p }); setPicking(false); }}>
                  {p.name}
                </button>
              ))}
            </div>
            <label className="field">Nieuwe plek<input value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
            <label className="field">Link (optioneel)<input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" /></label>
            <div className="row">
              <button type="button" className="btn primary" disabled={!newName.trim()}
                onClick={() => { props.onPropose({ newName: newName.trim(), link: safeUrl(link) ?? '' }); setPicking(false); }}>
                Toevoegen
              </button>
              <button type="button" className="btn" onClick={() => setPicking(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
