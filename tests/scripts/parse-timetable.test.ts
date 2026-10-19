import { describe, expect, it } from 'vitest';
import { parsePage, parseWords } from '../../scripts/lib/parse-timetable';

let y = 0;
const w = (x0: number, text: string, row: number) => `<word xMin="${x0}" yMin="${row}" xMax="${x0 + 20}" yMax="${row + 7}">${text}</word>`;

// Build a page: every row shares one y so the cells line up like in the PDF.
function line(cells: [number, string][]) {
  y += 10;
  return cells.map(([x, t]) => w(x, t, y)).join('');
}

const page = `<page width="1169" height="826">
${line([[10, 'Samstag,Sonn-/Feiertag']])}
${line([[205, 'Linie'], [240, '550'], [280, '553']])}
${line([[160, 'Verkehrsbeschränkung'], [240, 'SA'], [280, '07']])}
${line([[200, 'Hinweise']])}
${line([[21, 'Dorf'], [51, 'Nord'], [240, '5.50'], [280, '9.05']])}
${line([[21, 'Stadt'], [51, 'Busterminal'], [215, 'an'], [240, '6.00'], [280, '9.15']])}
${line([[21, 'Stadt'], [51, 'Busterminal'], [215, 'ab'], [240, '6.05'], [280, '9.20']])}
${line([[21, '555'], [51, 'Nebenlinie'], [240, '7.00']])}
${line([[21, 'Berg'], [51, 'Süd'], [236, 't6.30'], [280, '9.40']])}
${line([[21, 'Österr.'], [51, 'Postbus']])}
</page>`;

describe('parsePage', () => {
  const parsed = parsePage(parseWords(page)[0])!;

  it('reads the day type, stops and skips other lines', () => {
    expect(parsed.weekend).toBe(true);
    expect(parsed.stops).toEqual(['Dorf Nord', 'Stadt Busterminal', 'Berg Süd']);
  });

  it('reads a column per trip with its line and restriction', () => {
    expect(parsed.trips.map((t) => [t.line, t.codes])).toEqual([['550', ['SA']], ['553', ['07']]]);
  });

  it('keeps the departure for a stop listed with an and ab, and the arrival separately', () => {
    const [first] = parsed.trips;
    expect(first.times.get('Stadt Busterminal')).toBe(6 * 60 + 5);
    expect(first.arrivals.get('Stadt Busterminal')).toBe(6 * 60);
    expect(first.times.get('Berg Süd')).toBe(6 * 60 + 30);
  });
});
