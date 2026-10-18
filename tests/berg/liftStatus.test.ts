import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findReportUrl, parseLiftStatus } from '../../supabase/functions/lift-status/parse.ts';

describe('parseLiftStatus', () => {
  const summer = parseLiftStatus(readFileSync('tests/fixtures/intermaps-summer.html', 'utf8'));

  it('reads every lift in the Intermaps report', () => {
    expect(summer).toHaveLength(11);
  });

  it('maps the open/closed icons', () => {
    expect(summer.find((l) => l.name === 'Schlossalmbahn I')).toEqual({ id: 'schlossalm i', name: 'Schlossalmbahn I', kind: 'lift', isOpen: true });
    expect(summer.find((l) => l.name === 'Stubnerkogelbahn II')?.isOpen).toBe(false);
  });

  it('treats a slopes section as pistes keyed by their number', () => {
    const winter = parseLiftStatus(readFileSync('tests/fixtures/intermaps-winter-sample.html', 'utf8'));
    expect(winter.filter((s) => s.kind === 'lift')).toHaveLength(2);
    expect(winter.find((s) => s.kind === 'piste' && s.id === '27')).toMatchObject({ name: 'Jungeralm-Abfahrt', isOpen: true });
    expect(winter.find((s) => s.id === '5a')).toMatchObject({ kind: 'piste', isOpen: false });
  });
});

describe('findReportUrl', () => {
  it('finds the current Intermaps report link on the Skigastein site', () => {
    const html = '<a href="https://srm-reports.intermaps.com/gastein_winter?lang=en">INFO daily</a>';
    expect(findReportUrl(html)).toBe('https://srm-reports.intermaps.com/gastein_winter?lang=en');
  });
  it('returns null without a link', () => expect(findReportUrl('<p>nope</p>')).toBeNull());
});
