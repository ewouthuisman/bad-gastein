import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { defaultTripDay, tripDays } from '../lib/time';
import { usePlanning } from '../features/planning/usePlanning';
import { PollCard, type Poll, type PollKind } from '../features/planning/PollCard';
import { PollGroup } from '../features/planning/PollGroup';
import { isAreaKey } from '../features/nav/areas';
import { usePlaces } from '../features/map/places';

interface Block {
  key: string;
  title: string;
  icon: string;
  kinds: PollKind[];
  /** Kinds that are decided together as one thing; shown as one block. Omit for separate cards. */
  group?: { decidable: PollKind[] };
}

const BLOCKS: Block[] = [
  { key: 'ski', title: 'Skiën', icon: '⛷️', kinds: ['ski_area', 'ski_time'], group: { decidable: ['ski_area'] } },
  { key: 'lunch', title: 'Lunch op de berg', icon: '🍲', kinds: ['lunch_place', 'lunch_time'], group: { decidable: ['lunch_place', 'lunch_time'] } },
  { key: 'apres', title: 'Après-ski', icon: '🍻', kinds: ['apres_or_spa', 'apres_place'] },
  { key: 'dinner', title: 'Avondeten', icon: '🍝', kinds: ['dinner_place'] },
];

/** Blocks an admin may add on the non-ski days; no ski, so no lunch on the mountain. */
const QUIET_BLOCKS: Record<string, string[]> = {
  '2027-02-28': ['apres', 'dinner'],
  '2027-03-06': [],
};

const QUIET_DAY: Record<string, string> = {
  '2027-02-28': 'Aankomst in Bad Gastein. Inchecken: [PLACEHOLDER]. Boodschappen, uitpakken, eerste bier.',
  '2027-03-06': 'Uitchecken: [PLACEHOLDER]. Opruimen, inpakken en terugreis.',
};

export function PlanningTab() {
  const navigate = useNavigate();
  const { session, isAdmin } = useAuth();
  const userId = session?.user.id ?? '';
  const days = tripDays();
  const [day, setDay] = useState(() => defaultTripDay(new Date()));
  const current = days.find((d) => d.date === day)!;
  const planning = usePlanning(day);
  const places = usePlaces();
  const byKind = new Map(planning.polls.map((p) => [p.kind, p]));

  const areaPoll = byKind.get('ski_area');
  const areaValue = planning.options.find((o) => o.id === areaPoll?.decided_option_id)?.value;
  const area = isAreaKey(areaValue) ? areaValue : null;

  const allowed = (b: Block) => current.isSkiDay || (QUIET_BLOCKS[day] ?? []).includes(b.key);
  const onRoute = (placeId: string) => {
    const p = places.find((x) => x.dbId === placeId || x.id === placeId);
    navigate(`/berg?to=${encodeURIComponent(p?.id ?? placeId)}`);
  };

  function card(poll: Poll) {
    return (
      <PollCard
        key={poll.id}
        poll={poll}
        options={planning.options.filter((o) => (o as { poll_id?: string }).poll_id === poll.id)}
        votes={planning.votes.filter((v) => v.poll_id === poll.id)}
        names={planning.names}
        myUserId={userId}
        isAdmin={isAdmin}
        places={places}
        area={area}
        onVote={(o) => void planning.vote(userId, poll.id, o)}
        onDecide={(o) => void planning.decide(poll.id, o)}
        onUndecide={() => void planning.undecide(poll.id)}
        onReset={() => void planning.reset(poll.id)}
        onPropose={(p) => void planning.propose(userId, poll, p)}
        onRemoveOption={(o) => void planning.removeOption(o)}
        onRoute={onRoute}
      />
    );
  }

  return (
    <section className="page">
      <h1>Planning</h1>
      <div className="day-strip" role="tablist" aria-label="Dagen">
        {days.map((d) => (
          <button key={d.date} type="button" role="tab" aria-selected={d.date === day} className={`chip ${d.date === day ? 'on' : ''}`} onClick={() => setDay(d.date)}>
            {d.label}
          </button>
        ))}
      </div>
      {planning.error && <p className="error">{planning.error}</p>}

      {!current.isSkiDay && (
        <div className="card">
          <p>{renderPlaceholders(QUIET_DAY[day] ?? '')}</p>
        </div>
      )}

      {BLOCKS.filter(allowed).map((b) => {
        const polls = b.kinds.map((k) => byKind.get(k)).filter(Boolean) as Poll[];
        if (!polls.length) {
          if (current.isSkiDay || !isAdmin) return null;
          return (
            <div key={b.key} className="timeline-block muted">
              <h2>{b.icon} {b.title}</h2>
              <button type="button" className="btn small" onClick={() => b.kinds.forEach((k) => void planning.addPoll(day, k))}>Stemming toevoegen</button>
            </div>
          );
        }
        if (b.group) {
          return (
            <PollGroup
              key={b.key}
              title={b.title}
              icon={b.icon}
              polls={polls}
              decidable={b.group.decidable}
              options={planning.options}
              votes={planning.votes}
              names={planning.names}
              myUserId={userId}
              isAdmin={isAdmin}
              places={places}
              area={area}
              onVote={(pollId, o) => void planning.vote(userId, pollId, o)}
              onDecide={(pollId, o) => void planning.decide(pollId, o)}
              onUndecide={(pollId) => void planning.undecide(pollId)}
              onReset={(pollId) => void planning.reset(pollId)}
              onPropose={(poll, p) => void planning.propose(userId, poll, p)}
              onRemoveOption={(o) => void planning.removeOption(o)}
              onRoute={onRoute}
            />
          );
        }
        return (
          <div key={b.key} className="timeline-block">
            <h2>{b.icon} {b.title}</h2>
            {polls.map(card)}
          </div>
        );
      })}
      {current.isSkiDay && (
        <div className="timeline-block muted">
          <h2>😴 Slapen</h2>
        </div>
      )}
    </section>
  );
}

function renderPlaceholders(text: string) {
  return text.split(/(\[PLACEHOLDER\])/).map((part, i) => (part === '[PLACEHOLDER]' ? <span key={i} className="placeholder">{part}</span> : part));
}
