// Reads a Salzburg Verkehr / Postbus timetable PDF (as `pdftotext -bbox` HTML) into trips per stop.
// The PDF lists stops down the left and one column per trip; a column's header gives the line (550/553)
// and the restriction row gives codes such as S, F, SA, SoF, 05, 07.

export interface Word {
  x0: number;
  x1: number;
  y: number;
  text: string;
}

export interface ParsedTrip {
  line: string;
  codes: string[];
  /** Minutes after midnight by stop name; the departure (ab) where a stop has both an and ab. */
  times: Map<string, number>;
  /** Arrival minutes where a stop lists both an and ab (a layover in between). */
  arrivals: Map<string, number>;
}

export interface ParsedPage {
  weekend: boolean;
  /** Stop names in the order the page lists them (555 rows skipped). */
  stops: string[];
  trips: ParsedTrip[];
}

const TIME = /^[ht]?(\d{1,2})\.(\d{2})$/;
const LABEL_MAX_X = 200;
const ROW_TOLERANCE = 2;

export function parseWords(html: string): Word[][] {
  const pages: Word[][] = [];
  for (const page of html.split('<page ').slice(1)) {
    const words: Word[] = [];
    for (const m of page.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)<\/word>/g)) {
      words.push({ x0: +m[1], y: +m[2], x1: +m[3], text: m[4].replace(/&amp;/g, '&') });
    }
    pages.push(words);
  }
  return pages;
}

function rowsOf(words: Word[]): Word[][] {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const rows: Word[][] = [];
  for (const w of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - w.y) <= ROW_TOLERANCE) last.push(w);
    else rows.push([w]);
  }
  return rows.map((r) => r.sort((a, b) => a.x0 - b.x0));
}

const centre = (w: Word) => (w.x0 + w.x1) / 2;
const nearest = (cols: { x: number }[], w: Word) => cols.reduce((b, c, i) => (Math.abs(c.x - centre(w)) < Math.abs(cols[b].x - centre(w)) ? i : b), 0);
const minutes = (t: string) => {
  const m = TIME.exec(t)!;
  return +m[1] * 60 + +m[2];
};

export function parsePage(words: Word[]): ParsedPage | null {
  const rows = rowsOf(words);
  const linie = rows.findIndex((r) => r.some((w) => w.text === 'Linie'));
  if (linie < 0) return null;
  const weekend = rows.some((r) => r.some((w) => /^Samstag/.test(w.text)));
  const cols = rows[linie].filter((w) => /^55\d$/.test(w.text) && w.x0 > LABEL_MAX_X).map((w) => ({ x: centre(w), line: w.text, codes: [] as string[] }));

  // The restriction row sits between the header and the stop rows.
  const stopStart = rows.findIndex((r, i) => i > linie && r.some((w) => w.text === 'Hinweise'));
  for (let i = linie + 1; i < stopStart; i++) {
    for (const w of rows[i]) if (w.x0 > LABEL_MAX_X && /^(S|F|SA|SoF|\d\d)$/.test(w.text)) cols[nearest(cols, w)].codes.push(w.text);
  }

  const trips: ParsedTrip[] = cols.map((c) => ({ line: c.line, codes: c.codes, times: new Map(), arrivals: new Map() }));
  const stops: string[] = [];
  for (const row of rows.slice(stopStart + 1)) {
    // 'h' and 't' are footnote marks printed before a time, not part of the stop name.
    const label = row.filter((w) => w.x0 <= LABEL_MAX_X + 30 && !TIME.test(w.text) && !/^[ht]$/.test(w.text));
    const joined = label.map((w) => w.text).join(' ');
    const text = joined.replace(/\s+(an|ab)$/, '');
    const role = /\s(an|ab)$/.exec(joined)?.[1];
    if (/^Österr\./.test(text)) break;
    if (!text || /^555\b/.test(text)) continue;
    if (stops[stops.length - 1] !== text) stops.push(text);
    for (const w of row) {
      if (w.x0 <= LABEL_MAX_X + 30 || !TIME.test(w.text)) continue;
      const trip = trips[nearest(cols, w)];
      // Keep the departure when a stop is listed twice (an, then ab).
      if (role === 'an') trip.arrivals.set(text, minutes(w.text));
      if (role === 'an' && trip.times.has(text)) continue;
      trip.times.set(text, minutes(w.text));
    }
  }
  return { weekend, stops, trips: trips.filter((t) => t.times.size > 1) };
}
