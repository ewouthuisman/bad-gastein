import { describe, expect, it } from 'vitest';
import { tally } from '../../src/features/planning/tally';

const options = [
  { id: 'o1', label: 'Wengeralm' },
  { id: 'o2', label: 'Aeroplanstadl' },
  { id: 'o3', label: 'Bergstadl' },
];
const names = new Map([['u1', 'Sanne'], ['u2', 'Anna'], ['u3', 'Bram']]);

describe('tally', () => {
  it('counts votes per option, most first, ties by label', () => {
    const votes = [
      { user_id: 'u1', option_id: 'o1' },
      { user_id: 'u2', option_id: 'o2' },
    ];
    expect(tally(options, votes, names).map((t) => [t.optionId, t.count])).toEqual([
      ['o2', 1],
      ['o1', 1],
      ['o3', 0],
    ]);
  });

  it('lists voters by display name, alphabetically', () => {
    const votes = [
      { user_id: 'u1', option_id: 'o3' },
      { user_id: 'u3', option_id: 'o3' },
      { user_id: 'u2', option_id: 'o3' },
    ];
    expect(tally(options, votes, names)[0].voters).toEqual(['Anna', 'Bram', 'Sanne']);
  });
});
