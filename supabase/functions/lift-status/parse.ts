// Parses the Intermaps "SRM report" HTML that Skigastein uses for its live lift/slope status.
import { normaliseLiftName } from '../_shared/names.ts';

export interface StatusItem {
  id: string;
  name: string;
  kind: 'lift' | 'piste';
  isOpen: boolean;
}

const OPEN_ICON = '/169.png';
const CLOSED_ICON = '/94.png';

export function parseLiftStatus(html: string): StatusItem[] {
  const items: StatusItem[] = [];
  // Split into sections at each colored heading so we know whether we are in lifts or slopes.
  const sections = html.split(/<div class="colored-heading"[^>]*>/);
  for (const section of sections) {
    const heading = section.match(/<h1>([^<]*)<\/h1>/)?.[1] ?? '';
    const kind: StatusItem['kind'] = /slope|piste|abfahrt|run/i.test(heading) ? 'piste' : 'lift';
    for (const m of section.matchAll(/<div class="status-item">([\s\S]*?)<\/div>/g)) {
      const body = m[1];
      const label = body.match(/<span>([^<]*)<\/span>/)?.[1]?.trim();
      if (!label) continue;
      const open = body.includes(OPEN_ICON);
      if (!open && !body.includes(CLOSED_ICON)) continue;
      const num = label.match(/^(\d+[a-z]?)\s+/i)?.[1];
      const name = label.replace(/^\d+[a-z]?\s+/i, '').trim();
      items.push({ id: kind === 'piste' ? (num ?? normaliseLiftName(name)) : normaliseLiftName(name), name, kind, isOpen: open });
    }
  }
  return items;
}

export function findReportUrl(html: string): string | null {
  return html.match(/https:\/\/srm-reports\.intermaps\.com\/[a-z0-9_]+(\?lang=[a-z]+)?/i)?.[0] ?? null;
}
