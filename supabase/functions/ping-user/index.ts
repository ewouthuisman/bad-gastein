// "Waar ben je?": asks another group member to open the app so their location refreshes.
import { adminClient, callerId, corsHeaders, json } from '../_shared/supabase.ts';
import { sendPush } from '../_shared/push.ts';

const COOLDOWN_MS = 5 * 60_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sender = await callerId(req);
  if (!sender) return json({ error: 'unauthorized' }, 401);
  const { targetUserId } = (await req.json()) as { targetUserId?: string };
  if (!targetUserId || targetUserId === sender) return json({ error: 'invalid target' }, 400);

  const db = adminClient();
  const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { count } = await db
    .from('pings')
    .select('id', { count: 'exact', head: true })
    .eq('sender', sender)
    .eq('target', targetUserId)
    .gte('created_at', since);
  if ((count ?? 0) > 0) return json({ error: 'Je hebt het net al gevraagd. Even geduld.' }, 429);

  const { data: me } = await db.from('profiles').select('display_name').eq('id', sender).single();
  await db.from('pings').insert({ sender, target: targetUserId });
  const result = await sendPush(db, [targetUserId], {
    title: '📍 Waar ben je?',
    body: `${me?.display_name ?? 'Iemand'} vraagt waar je bent. Tik om je locatie te delen.`,
    url: './#/kaart?share=1',
  });
  return json(result);
});
