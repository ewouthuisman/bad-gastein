// Internal endpoint: database triggers and scheduled jobs send notifications through here.
import { adminClient, corsHeaders, isInternal, json } from '../_shared/supabase.ts';
import { sendPush, type PushPayload } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!(await isInternal(req))) return json({ error: 'forbidden' }, 403);
  const { userIds, title, body, url } = (await req.json()) as { userIds: string[] | 'all' } & PushPayload;
  if (!title || !body) return json({ error: 'title and body required' }, 400);
  const result = await sendPush(adminClient(), userIds ?? 'all', { title, body, url: url ?? './' });
  return json(result);
});
