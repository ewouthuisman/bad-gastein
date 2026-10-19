import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { defaultTripDay, tripDays } from '../lib/time';
import { usePlanning } from '../features/planning/usePlanning';
import { PollCard, type Poll, type PollKind } from '../features/planning/PollCard';
import { usePlaces } from '../features/map/places';
import { supabase } from '../lib/supabase';

const BLOCKS: { title: string; icon: string; kinds: PollKind[] }[] = [
  { title: 'Vroeg skiën', icon: '🌅', kinds: ['early_ski'] },
  { title: 'Lunch op de berg', icon: '🍲', kinds: ['lunch_place', 'lunch_time'] },
  { title: 'Après-ski', icon: '🍻', kinds: ['apres_or_spa', 'apres_place'] },
  { title: 'Avondeten', icon: '🍝', kinds: ['dinner_place'] },
];

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
        onVote={(o) => void planning.vote(userId, poll.id, o)}
        onDecide={(o) => void planning.decide(poll.id, o)}
        onUndecide={() => void planning.undecide(poll.id)}
        onReset={() => void planning.reset(poll.id)}
        onPropose={(p) => void planning.propose(userId, poll, p)}
        onRemoveOption={(o) => void planning.removeOption(o)}
        onRoute={(placeId) => {
          const p = places.find((x) => x.dbId === placeId || x.id === placeId);
          navigate(`/berg?to=${encodeURIComponent(p?.id ?? placeId)}`);
        }}
      />
    );
  }

  async function addPoll(kind: PollKind) {
    await supabase.from('polls').insert({ day, kind });
    window.location.reload();
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

      {BLOCKS.map((b) => {
        const polls = b.kinds.map((k) => byKind.get(k)).filter(Boolean) as Poll[];
        if (!polls.length) {
          if (current.isSkiDay || !isAdmin || b.kinds[0] === 'early_ski') return null;
          return (
            <div key={b.title} className="timeline-block muted">
              <h2>{b.icon} {b.title}</h2>
              <button type="button" className="btn small" onClick={() => void addPoll(b.kinds[0])}>Stemming toevoegen</button>
            </div>
          );
        }
        return (
          <div key={b.title} className="timeline-block">
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
