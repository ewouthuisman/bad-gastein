// Soipie: the group's chatbot, answering from everything the app knows.
import { adminClient, callerId, corsHeaders, json } from '../_shared/supabase.ts';
import { complete, type ChatMessage } from '../_shared/llm.ts';
import { buildContext } from '../_shared/context.ts';
import { fetchWeather, weatherSummary } from '../_shared/weather.ts';
import { viennaDate } from '../_shared/time.ts';

const PER_USER_PER_DAY = 25;
const GROUP_PER_DAY = 150;
const LIMIT_MESSAGE = 'Soipie heeft even genoeg gehad. Morgen weer.';

const SYSTEM = `Je bent Soipie, de chatbot van een Nederlandse vriendengroep (10 personen) op wintersport in Bad Gastein.
Toon: droog, plagerig, kort (meestal 1-4 zinnen), in het Nederlands. Je mag mensen met hun Soipen-score plagen.
Gebruik ALLEEN de feiten uit de context hieronder. Weet je iets niet, of staat er [PLACEHOLDER], zeg dan eerlijk dat je het niet weet.
Verzin geen openingstijden, prijzen of routes. Voor routes verwijs je naar de navigatie in de Berg-tab.
Geef geen medisch of alcohol-advies behalve "drink water".`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const userId = await callerId(req);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const { message } = (await req.json()) as { message?: string };
  const text = message?.trim().slice(0, 1000);
  if (!text) return json({ error: 'empty message' }, 400);

  const db = adminClient();
  const now = new Date();
  const today = viennaDate(now);
  const { data: recent } = await db
    .from('chat_messages')
    .select('user_id, created_at')
    .eq('role', 'user')
    .gte('created_at', new Date(now.getTime() - 26 * 3_600_000).toISOString());
  const todays = (recent ?? []).filter((m) => viennaDate(new Date(m.created_at)) === today);
  if (todays.length >= GROUP_PER_DAY || todays.filter((m) => m.user_id === userId).length >= PER_USER_PER_DAY) {
    return json({ error: LIMIT_MESSAGE }, 429);
  }

  const [{ data: history }, { data: me }, weather] = await Promise.all([
    db.from('chat_messages').select('role, content').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    db.from('profiles').select('display_name').eq('id', userId).single(),
    fetchWeather().then(weatherSummary).catch(() => ''),
  ]);
  const context = await buildContext(db, now, { weather });

  await db.from('chat_messages').insert({ user_id: userId, role: 'user', content: text });
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM}\n\nJe praat nu met ${me?.display_name ?? 'iemand uit de groep'}.\n\n${context}` },
    ...((history ?? []).reverse() as ChatMessage[]),
    { role: 'user', content: text },
  ];

  let reply: string;
  try {
    reply = await complete(messages, { maxTokens: 500 });
  } catch (e) {
    console.error('soipie llm failed', (e as Error).message);
    return json({ error: 'Soipie is even van de kaart (AI niet bereikbaar). Probeer het zo nog eens.' }, 503);
  }
  await db.from('chat_messages').insert({ user_id: userId, role: 'assistant', content: reply });
  return json({ reply });
});
