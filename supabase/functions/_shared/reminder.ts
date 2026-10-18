// Pure helpers for the evening vote reminder (shared with the app's unit tests).

export interface ReminderPoll {
  id: string;
  decided_option_id: string | null;
}

export interface ReminderVote {
  poll_id: string;
  user_id: string;
}

/** Users who have not voted on at least one of the undecided polls. */
export function reminderRecipients(userIds: string[], polls: ReminderPoll[], votes: ReminderVote[]): string[] {
  const open = polls.filter((p) => !p.decided_option_id).map((p) => p.id);
  if (!open.length) return [];
  const voted = new Set(votes.map((v) => `${v.poll_id}|${v.user_id}`));
  return userIds.filter((u) => open.some((p) => !voted.has(`${p}|${u}`)));
}

export function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
