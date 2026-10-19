import { tally, type TallyVote } from './tally';
import { PollCard, type Poll, type PollCardProps, type PollOption } from './PollCard';
import { safeUrl } from '../../lib/safeUrl';
import type { AppPlace } from '../map/places';
import type { AreaKey } from '../nav/areas';

/** Polls that belong together and are shown (and decided) as one block, e.g. lunch: where + what time. */
export interface PollGroupProps {
  title: string;
  icon: string;
  polls: Poll[]; // in display order
  decidable: Poll['kind'][]; // kinds that take part in the shared decision; the rest is a personal choice
  options: (PollOption & { poll_id?: string })[];
  votes: (TallyVote & { poll_id: string })[];
  names: Map<string, string>;
  myUserId: string;
  isAdmin: boolean;
  places: AppPlace[];
  area?: AreaKey | null;
  onVote: (pollId: string, optionId: string) => void;
  onDecide: (pollId: string, optionId: string) => void;
  onUndecide: (pollId: string) => void;
  onReset: (pollId: string) => void;
  onPropose: PollCardPropose;
  onRemoveOption: (optionId: string) => void;
  onRoute: (placeId: string) => void;
}

type PollCardPropose = (poll: Poll, p: Parameters<PollCardProps['onPropose']>[0]) => void;

export function PollGroup(props: PollGroupProps) {
  const { polls, decidable, options, votes, names, isAdmin, places } = props;
  const optionsOf = (p: Poll) => options.filter((o) => o.poll_id === p.id);
  const votesOf = (p: Poll) => votes.filter((v) => v.poll_id === p.id);
  const shared = polls.filter((p) => decidable.includes(p.kind));
  const decidedOf = (p: Poll) => optionsOf(p).find((o) => o.id === p.decided_option_id);
  const allDecided = shared.length > 0 && shared.every((p) => decidedOf(p));
  const leaderOf = (p: Poll) => {
    const rows = tally(optionsOf(p), votesOf(p), names);
    return rows[0]?.count ? rows[0].optionId : null;
  };
  const open = shared.filter((p) => !decidedOf(p));
  const canDecide = open.length > 0 && open.every((p) => leaderOf(p));

  const decidedPlace = shared
    .map((p) => decidedOf(p))
    .map((o) => (o?.place_id ? places.find((x) => x.dbId === o.place_id || x.id === o.place_id) : undefined))
    .find(Boolean);
  const decidedPlaceId = shared.map((p) => decidedOf(p)?.place_id).find(Boolean) ?? null;
  const summary = shared.map((p) => decidedOf(p)?.label).filter(Boolean);

  const decideAll = () => open.forEach((p) => props.onDecide(p.id, leaderOf(p)!));
  const undecideAll = () => shared.forEach((p) => decidedOf(p) && props.onUndecide(p.id));

  return (
    <div className="timeline-block">
      <h2>{props.icon} {props.title}</h2>
      <div className="card poll">
        {isAdmin && (
          <button type="button" className="reset-poll" aria-label="Stemming resetten" title="Stemming resetten"
            onClick={() => window.confirm('Alle stemmen en het besluit hier wissen en de standaardopties terugzetten?') && polls.forEach((p) => props.onReset(p.id))}>↺</button>
        )}
        {allDecided && (
          <>
            <p><strong>Besloten: {summary.join(' om ')}</strong></p>
            {decidedPlace && (decidedPlace.menuText || decidedPlace.menuUrl) && (
              <details>
                <summary>Menukaart</summary>
                {decidedPlace.menuText && <pre className="menu-text">{decidedPlace.menuText}</pre>}
                {safeUrl(decidedPlace.menuUrl) && <a href={safeUrl(decidedPlace.menuUrl)} target="_blank" rel="noreferrer">Menukaart openen</a>}
              </details>
            )}
            <div className="row">
              {decidedPlaceId && <button type="button" className="btn small primary" onClick={() => props.onRoute(decidedPlaceId)}>Route</button>}
              {isAdmin && <button type="button" className="btn small" onClick={undecideAll}>Besluit terugdraaien</button>}
            </div>
          </>
        )}
        {polls.map((p) => {
          if (allDecided && decidable.includes(p.kind)) return null;
          return (
            <PollCard
              key={p.id}
              embedded
              poll={p}
              options={optionsOf(p)}
              votes={votesOf(p)}
              names={names}
              myUserId={props.myUserId}
              isAdmin={isAdmin}
              places={places}
              area={props.area}
              onVote={(o) => props.onVote(p.id, o)}
              onDecide={(o) => props.onDecide(p.id, o)}
              onUndecide={() => props.onUndecide(p.id)}
              onReset={() => props.onReset(p.id)}
              onPropose={(x) => props.onPropose(p, x)}
              onRoute={props.onRoute}
              onRemoveOption={props.onRemoveOption}
            />
          );
        })}
        {!allDecided && isAdmin && shared.length > 0 && (
          <div className="row">
            <button type="button" className="btn small primary" disabled={!canDecide} onClick={decideAll}>Besluit</button>
          </div>
        )}
      </div>
    </div>
  );
}
