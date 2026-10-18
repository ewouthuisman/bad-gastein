export interface TallyOption {
  id: string;
  label: string;
}

export interface TallyVote {
  user_id: string;
  option_id: string;
}

export interface TallyRow {
  optionId: string;
  count: number;
  voters: string[];
}

export function tally(options: TallyOption[], votes: TallyVote[], names: Map<string, string>): TallyRow[] {
  return options
    .map((o) => {
      const voters = votes
        .filter((v) => v.option_id === o.id)
        .map((v) => names.get(v.user_id) ?? 'Onbekend')
        .sort((a, b) => a.localeCompare(b, 'nl'));
      return { optionId: o.id, count: voters.length, voters, label: o.label };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'nl'))
    .map(({ optionId, count, voters }) => ({ optionId, count, voters }));
}
