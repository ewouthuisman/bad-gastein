import { describe, expect, it } from 'vitest';
import { computeSnapshot } from '../../supabase/functions/_shared/soipenCompute.ts';

const now = new Date('2027-03-02T17:00:00Z');

describe('computeSnapshot', () => {
  const snap = computeSnapshot(
    {
      profiles: [{ id: 'a', display_name: 'Anna' }, { id: 'b', display_name: 'Bram' }],
      drinks: [
        { user_id: 'a', kind: 'beer_05', created_at: '2027-03-02T16:30:00Z' },
        { user_id: 'a', kind: 'jager', created_at: '2027-03-02T16:45:00Z' },
        { user_id: 'a', kind: 'beer_05', created_at: '2027-03-01T20:00:00Z' },
      ],
      visits: [{ user_id: 'b', started_at: '2027-03-02T15:00:00Z', ended_at: '2027-03-02T16:00:00Z', places: { name: 'Hirschenhütte' } }],
      polls: [{ id: 'p1', kind: 'apres_or_spa' }],
      votes: [{ poll_id: 'p1', option_id: 'o1' }, { poll_id: 'p1', option_id: 'o1' }],
      options: [{ id: 'o1', value: 'apres' }, { id: 'o2', value: 'spa' }],
    },
    now,
  );

  it('counts only today\'s drinks per person', () => {
    expect(snap.people.find((p) => p.id === 'a')?.drinksToday).toBe(2);
  });

  it('remembers the last bar', () => {
    expect(snap.people.find((p) => p.id === 'b')?.lastBar).toBe('Hirschenhütte');
  });

  it('ranks people from most to least soipen', () => {
    expect(snap.people.map((p) => p.name)).toEqual(['Anna', 'Bram']);
  });

  it('adds the après vote bonus to the group score', () => {
    const mean = Math.round((snap.people[0].score + snap.people[1].score) / 2);
    expect(snap.group).toBeGreaterThanOrEqual(mean + 9);
    expect(snap.mode.label).toBeTruthy();
  });
});

describe('computeSnapshot day boundary', () => {
  it('ignores yesterday\'s drinks and bar visits in today\'s score', () => {
    const snap = computeSnapshot(
      {
        profiles: [{ id: 'a', display_name: 'Anna' }],
        drinks: Array.from({ length: 6 }, () => ({ user_id: 'a', kind: 'beer_05', created_at: '2027-03-01T21:00:00Z' })),
        visits: [{ user_id: 'a', started_at: '2027-03-01T19:00:00Z', ended_at: '2027-03-01T22:00:00Z', places: { name: 'Salettl' } }],
        polls: [],
        votes: [],
        options: [],
      },
      new Date('2027-03-02T08:00:00Z'),
    );
    expect(snap.people[0].score).toBe(0);
    expect(snap.people[0].lastBar).toBeNull();
  });
});
