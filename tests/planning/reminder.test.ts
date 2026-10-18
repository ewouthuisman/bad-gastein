import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nextDay, reminderRecipients } from '../../supabase/functions/_shared/reminder.ts';

describe('reminderRecipients', () => {
  const users = ['a', 'b', 'c'];
  const polls = [
    { id: 'p1', decided_option_id: null },
    { id: 'p2', decided_option_id: null },
    { id: 'p3', decided_option_id: 'x' },
  ];

  it('reminds people missing a vote on any undecided poll', () => {
    const votes = [
      { poll_id: 'p1', user_id: 'a' },
      { poll_id: 'p2', user_id: 'a' },
      { poll_id: 'p1', user_id: 'b' },
    ];
    expect(reminderRecipients(users, polls, votes)).toEqual(['b', 'c']);
  });

  it('ignores decided polls', () => {
    const votes = [
      { poll_id: 'p1', user_id: 'a' },
      { poll_id: 'p2', user_id: 'a' },
    ];
    expect(reminderRecipients(['a'], polls, votes)).toEqual([]);
  });
});

describe('nextDay', () => {
  it('crosses month ends', () => expect(nextDay('2027-02-28')).toBe('2027-03-01'));
});

describe('shared time module', () => {
  it('is identical for the app and the edge functions', () => {
    expect(readFileSync('supabase/functions/_shared/time.ts', 'utf8')).toBe(readFileSync('src/lib/time.ts', 'utf8'));
  });
});
