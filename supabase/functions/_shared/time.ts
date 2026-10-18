export const TZ = 'Europe/Vienna';

export interface TripDay {
  date: string;
  label: string;
  isSkiDay: boolean;
}

const DAYS: TripDay[] = [
  { date: '2027-02-28', label: 'zo 28 feb', isSkiDay: false },
  { date: '2027-03-01', label: 'ma 1 mrt', isSkiDay: true },
  { date: '2027-03-02', label: 'di 2 mrt', isSkiDay: true },
  { date: '2027-03-03', label: 'wo 3 mrt', isSkiDay: true },
  { date: '2027-03-04', label: 'do 4 mrt', isSkiDay: true },
  { date: '2027-03-05', label: 'vr 5 mrt', isSkiDay: true },
  { date: '2027-03-06', label: 'za 6 mrt', isSkiDay: false },
];

export const tripDays = (): TripDay[] => DAYS.map((d) => ({ ...d }));

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Calendar date (YYYY-MM-DD) in Bad Gastein. */
export const viennaDate = (now: Date): string => dateFmt.format(now);

export function viennaTime(now: Date): { h: number; m: number } {
  const [h, m] = timeFmt.format(now).split(':').map(Number);
  return { h, m };
}

/** The evening vote reminder goes out once, in the 20:00–20:14 slot. */
export function reminderDue(now: Date): boolean {
  const { h, m } = viennaTime(now);
  return h === 20 && m < 15;
}

/** Default day in the planning: today during the trip, otherwise the first ski day. */
export function defaultTripDay(now: Date): string {
  const today = viennaDate(now);
  return DAYS.some((d) => d.date === today) ? today : DAYS[1].date;
}
