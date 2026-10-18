// Every 15 minutes during lift hours: fetch Skigastein's Intermaps report and store open/closed per lift and slope.
import { adminClient, isInternal, json } from '../_shared/supabase.ts';
import { viennaTime } from '../_shared/time.ts';
import { findReportUrl, parseLiftStatus } from './parse.ts';

const SITE = 'https://www.skigastein.com/en/';
const FALLBACKS = ['https://srm-reports.intermaps.com/gastein_winter?lang=en', 'https://srm-reports.intermaps.com/gastein_summer?lang=en'];

async function reportHtml(): Promise<{ url: string; html: string } | null> {
  const candidates: string[] = [];
  try {
    const site = await fetch(SITE, { headers: { 'User-Agent': 'bad-gastein-trip-app/1.0' } });
    const found = findReportUrl(await site.text());
    if (found) candidates.push(found);
  } catch {
    /* use fallbacks */
  }
  for (const url of [...candidates, ...FALLBACKS]) {
    const res = await fetch(url, { headers: { 'User-Agent': 'bad-gastein-trip-app/1.0' } });
    if (res.ok) return { url, html: await res.text() };
  }
  return null;
}

Deno.serve(async (req) => {
  if (!(await isInternal(req))) return json({ error: 'forbidden' }, 403);
  const force = new URL(req.url).searchParams.get('force') === '1';
  const { h, m } = viennaTime(new Date());
  const minutes = h * 60 + m;
  if (!force && (minutes < 7 * 60 + 30 || minutes > 17 * 60 + 30)) return json({ skipped: 'outside lift hours' });

  const report = await reportHtml();
  if (!report) return json({ error: 'no report found' }, 502);
  const items = parseLiftStatus(report.html);
  if (!items.length) return json({ error: 'report had no status items', url: report.url }, 502);

  const now = new Date().toISOString();
  const { error } = await adminClient()
    .from('lift_status')
    .upsert(items.map((i) => ({ id: `${i.kind}:${i.id}`, name: i.name, kind: i.kind, is_open: i.isOpen, updated_at: now })));
  return json({ url: report.url, items: items.length, error: error?.message ?? null });
});
