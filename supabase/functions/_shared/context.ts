// Everything Soipie knows, as compact Dutch text for the system prompt.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { tripDays, viennaDate, viennaTime } from './time.ts';
import { loadSoipenRows } from './soipenData.ts';
import { computeSnapshot } from './soipenCompute.ts';

export const MAX_CONTEXT_CHARS = 24_000;
const MENU_CHARS = 600;

const POLL_TITLE: Record<string, string> = {
  ski_area: 'Skiberg',
  ski_time: 'Skitijd (ieder kiest zelf)',
  lunch_place: 'Lunchplek (samen met lunchtijd één besluit)',
  lunch_time: 'Lunchtijd',
  apres_place: 'Après-ski plek',
  apres_or_spa: 'Après-ski of spa',
  dinner_place: 'Avondeten',
};

type Row = Record<string, any>;

function ago(iso: string, now: Date): string {
  const min = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  return min < 60 ? `${min} min geleden` : `${Math.floor(min / 60)} u ${min % 60} min geleden`;
}

export async function buildContext(db: SupabaseClient, now: Date, opts: { weather?: string } = {}): Promise<string> {
  const [{ data: profiles }, { data: polls }, { data: options }, { data: votes }, { data: house }, { data: places }, { data: lifts }, { data: locations }] =
    await Promise.all([
      db.from('profiles').select('id, display_name'),
      db.from('polls').select('id, day, kind, decided_option_id').order('day'),
      db.from('poll_options').select('id, poll_id, label, place_id, value'),
      db.from('votes').select('poll_id, user_id, option_id'),
      db.from('house_info').select('section, title, markdown, sort').order('sort'),
      db.from('places').select('id, name, kind, menu_text, menu_url, lat, lng'),
      db.from('lift_status').select('id, name, kind, is_open, updated_at'),
      db.from('locations').select('user_id, lat, lng, updated_at'),
    ]);
  const name = new Map((profiles ?? []).map((p: Row) => [p.id, p.display_name]));
  const { h, m } = viennaTime(now);
  const today = viennaDate(now);

  const planning: string[] = [];
  for (const d of tripDays()) {
    const dayPolls = (polls ?? []).filter((p: Row) => p.day === d.date);
    if (!dayPolls.length) continue;
    planning.push(`${d.label}${d.date === today ? ' (vandaag)' : ''}:`);
    for (const p of dayPolls) {
      const opts = (options ?? []).filter((o: Row) => o.poll_id === p.id);
      const decided = opts.find((o: Row) => o.id === p.decided_option_id);
      if (decided) {
        planning.push(`- ${POLL_TITLE[p.kind] ?? p.kind}: BESLOTEN → ${decided.label}`);
        continue;
      }
      const tally = opts
        .map((o: Row) => {
          const who = (votes ?? []).filter((v: Row) => v.option_id === o.id).map((v: Row) => name.get(v.user_id) ?? '?');
          return `${o.label} (${who.length}${who.length ? `: ${who.join(', ')}` : ''})`;
        })
        .join('; ');
      planning.push(`- ${POLL_TITLE[p.kind] ?? p.kind}: nog open — ${tally || 'geen opties'}`);
    }
  }

  const houseText = (house ?? []).map((s: Row) => `### ${s.title}\n${s.markdown}`).join('\n\n');
  const closed = (lifts ?? []).filter((l: Row) => !l.is_open);
  const liftUpdated = (lifts ?? []).map((l: Row) => l.updated_at).sort().pop();
  const liftText = lifts?.length
    ? `Laatst bijgewerkt ${liftUpdated ? ago(liftUpdated, now) : 'onbekend'}. Dicht: ${closed.map((l: Row) => l.name).join(', ') || 'niets'}.`
    : 'Liftstatus onbekend.';

  const snap = computeSnapshot(await loadSoipenRows(db, now), now);
  const soipenText = [`Groep: ${snap.group}% (${snap.mode.label})`, ...snap.people.map((p) => `- ${p.name}: ${p.score}%, ${p.drinksToday} drankjes vandaag${p.lastBar ? `, laatst in ${p.lastBar}` : ''}`)].join('\n');

  const locText = (locations ?? [])
    .map((l: Row) => `- ${name.get(l.user_id) ?? '?'}: ${l.lat.toFixed(4)}, ${l.lng.toFixed(4)} (${ago(l.updated_at, now)})`)
    .join('\n');

  const placesText = (menuChars: number) =>
    (places ?? [])
      .map((p: Row) => {
        const menu = p.menu_text && menuChars > 0 ? `\n  Menu: ${String(p.menu_text).slice(0, menuChars)}` : p.menu_url ? ` (menu: ${p.menu_url})` : '';
        return `- ${p.name} [${p.kind}]${menu}`;
      })
      .join('\n');

  const assemble = (menuChars: number) =>
    [
      `# Nu\n${today}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} in Bad Gastein. Reis: zo 28 feb – za 6 mrt 2027, 10 personen, Panorama Spa Lodges (Das Schiller), Kötschachtaler Straße 5.`,
      `# Planning\n${planning.join('\n') || 'Nog niets gepland.'}`,
      `# Huis\n${houseText}`,
      `# Liften\n${liftText}`,
      `# Weer\n${opts.weather || 'Onbekend.'}`,
      `# Soipen-meter\n${soipenText}`,
      `# Laatst bekende locaties\n${locText || 'Niemand deelt zijn locatie.'}`,
      `# Plekken (restaurants, après, eten)\n${placesText(menuChars)}`,
    ].join('\n\n');

  for (const menuChars of [MENU_CHARS, 200, 0]) {
    const text = assemble(menuChars);
    if (text.length <= MAX_CONTEXT_CHARS) return text;
  }
  return assemble(0).slice(0, MAX_CONTEXT_CHARS);
}
