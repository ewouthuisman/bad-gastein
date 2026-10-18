// Runs every 15 minutes via pg_cron; at 20:00 Vienna time it nudges people who haven't voted for tomorrow.
import { adminClient, isInternal, json } from '../_shared/supabase.ts';
import { sendPush } from '../_shared/push.ts';
import { reminderDue, tripDays, viennaDate } from '../_shared/time.ts';
import { nextDay, reminderRecipients } from '../_shared/reminder.ts';

Deno.serve(async (req) => {
  if (!isInternal(req)) return json({ error: 'forbidden' }, 403);
  const now = new Date();
  const force = new URL(req.url).searchParams.get('force') === '1';
  if (!force && !reminderDue(now)) return json({ skipped: 'not due' });

  const db = adminClient();
  const today = viennaDate(now);
  const { data: marker } = await db.from('app_config').select('value').eq('key', 'last_vote_reminder').maybeSingle();
  if (!force && marker?.value === today) return json({ skipped: 'already sent' });

  const tomorrow = nextDay(today);
  if (!tripDays().some((d) => d.date === tomorrow && d.isSkiDay)) return json({ skipped: 'no ski day tomorrow' });

  const [{ data: polls }, { data: profiles }] = await Promise.all([
    db.from('polls').select('id, decided_option_id').eq('day', tomorrow),
    db.from('profiles').select('id'),
  ]);
  const pollIds = (polls ?? []).map((p) => p.id);
  const { data: votes } = await db.from('votes').select('poll_id, user_id').in('poll_id', pollIds.length ? pollIds : ['00000000-0000-0000-0000-000000000000']);
  const recipients = reminderRecipients((profiles ?? []).map((p) => p.id), polls ?? [], votes ?? []);

  await db.from('app_config').upsert({ key: 'last_vote_reminder', value: today });
  const result = await sendPush(db, recipients, {
    title: '🗳️ Nog stemmen voor morgen',
    body: 'Je hebt nog niet overal gestemd: lunch, après-ski, eten en wie er vroeg gaat.',
    url: './#/planning',
  });
  return json({ recipients: recipients.length, ...result });
});
