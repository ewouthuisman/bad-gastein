// Called by a database trigger when an admin decides a poll: tells the whole group.
import { adminClient, isInternal, json } from '../_shared/supabase.ts';
import { sendPush } from '../_shared/push.ts';
import { tripDays } from '../_shared/time.ts';

const KIND_LABEL: Record<string, string> = {
  ski_area: 'Skiberg',
  ski_time: 'Skitijd',
  lunch_place: 'Lunch',
  lunch_time: 'Lunchtijd',
  apres_place: 'Après-ski',
  apres_or_spa: 'Après of spa',
  dinner_place: 'Avondeten',
};

Deno.serve(async (req) => {
  if (!(await isInternal(req))) return json({ error: 'forbidden' }, 403);
  const { pollId } = (await req.json()) as { pollId: string };
  const db = adminClient();
  const { data: poll } = await db.from('polls').select('id, day, kind, decided_option_id').eq('id', pollId).single();
  if (!poll?.decided_option_id) return json({ skipped: 'not decided' });
  // Lunch is one decision: the place's notification already carries the time.
  if (poll.kind === 'lunch_time') return json({ skipped: 'part of lunch' });
  const { data: option } = await db.from('poll_options').select('label').eq('id', poll.decided_option_id).single();

  let body = option?.label ?? '';
  if (poll.kind === 'lunch_place') {
    const { data: timePoll } = await db.from('polls').select('decided_option_id').eq('day', poll.day).eq('kind', 'lunch_time').maybeSingle();
    if (timePoll?.decided_option_id) {
      const { data: t } = await db.from('poll_options').select('label').eq('id', timePoll.decided_option_id).single();
      if (t) body += `, ${t.label}`;
    }
  }
  const dayLabel = tripDays().find((d) => d.date === poll.day)?.label ?? poll.day;
  const result = await sendPush(db, 'all', {
    title: `Besloten: ${KIND_LABEL[poll.kind] ?? poll.kind} ${dayLabel}`,
    body,
    url: './#/planning',
  });
  return json(result);
});
