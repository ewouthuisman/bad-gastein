// Writes Soipie's one-liners for the Soipen-meter (group + per person).
// Triggered by pg_cron every 30 minutes and on demand from the app (at most once per 10 minutes).
import { adminClient, callerId, corsHeaders, isInternal, json } from '../_shared/supabase.ts';
import { complete } from '../_shared/llm.ts';
import { fallbackLine } from '../_shared/fallbackLines.ts';
import { soipenMode } from '../_shared/score.ts';
import { soipenSnapshot } from '../_shared/soipenData.ts';
import { viennaTime } from '../_shared/time.ts';

const MIN_INTERVAL_MS = 10 * 60_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const internal = await isInternal(req);
  if (!internal && !(await callerId(req))) return json({ error: 'unauthorized' }, 401);

  const now = new Date();
  const { h } = viennaTime(now);
  if (internal && h >= 2 && h < 10) return json({ skipped: 'night' });

  const db = adminClient();
  const { data: last } = await db.from('soipen_comments').select('created_at').eq('scope', 'group').maybeSingle();
  if (last && now.getTime() - new Date(last.created_at).getTime() < MIN_INTERVAL_MS) return json({ skipped: 'recent' });

  const snap = await soipenSnapshot(db, now);
  let lines: { group: string; people: Record<string, string> } | null = null;
  try {
    const facts = snap.people
      .map((p) => `- ${p.name}: ${p.score}% (${p.drinksToday} drankjes vandaag${p.lastBar ? `, laatst gezien in ${p.lastBar}` : ''})`)
      .join('\n');
    const text = await complete(
      [
        {
          role: 'system',
          content:
            'Je bent Soipie, de droge, plagerige commentator van een Nederlandse wintersportgroep in Bad Gastein. ' +
            'Schrijf satirisch commentaar bij de "Soipen-meter". Gebruik alleen de gegeven cijfers en namen. Geen echte medische claims; ' +
            'hoogstens "drink water". Antwoord ALLEEN met JSON: {"group": "één zin", "people": {"<naam>": "één korte zin"}}.',
        },
        { role: 'user', content: `Groep: ${snap.group}% (${snap.mode.label}).\nPer persoon:\n${facts}` },
      ],
      { maxTokens: 700 },
    );
    const match = text.match(/\{[\s\S]*\}/);
    lines = match ? JSON.parse(match[0]) : null;
  } catch (e) {
    console.warn('soipen commentary fell back:', (e as Error).message);
  }

  const rows = [
    { scope: 'group', text: lines?.group ?? fallbackLine(snap.mode.key), score: snap.group, created_at: now.toISOString() },
    ...snap.people.map((p) => ({
      scope: p.id,
      text: lines?.people?.[p.name] ?? fallbackLine(soipenMode(p.score).key, now.getTime() + p.name.length * 600_000),
      score: p.score,
      created_at: now.toISOString(),
    })),
  ];
  await db.from('soipen_comments').upsert(rows);
  return json({ group: snap.group, fromLlm: !!lines });
});
