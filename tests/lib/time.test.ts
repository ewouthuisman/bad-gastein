import { describe, expect, it } from 'vitest';
import { reminderDue, tripDays, viennaDate } from '../../src/lib/time';

describe('tripDays', () => {
  const days = tripDays();
  it('covers Sunday 28 Feb to Saturday 6 Mar 2027', () => {
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2027-02-28', label: 'zo 28 feb', isSkiDay: false });
    expect(days[6]).toEqual({ date: '2027-03-06', label: 'za 6 mrt', isSkiDay: false });
  });
  it('marks Monday to Friday as ski days', () => {
    expect(days.slice(1, 6).every((d) => d.isSkiDay)).toBe(true);
    expect(days[1].label).toBe('ma 1 mrt');
  });
});

describe('viennaDate', () => {
  it('rolls over at Vienna midnight, not UTC midnight', () => {
    expect(viennaDate(new Date('2027-03-01T23:30:00Z'))).toBe('2027-03-02');
    expect(viennaDate(new Date('2027-03-01T22:59:00Z'))).toBe('2027-03-01');
  });
});

describe('reminderDue', () => {
  it('is due between 20:00 and 20:14 Vienna time', () => {
    expect(reminderDue(new Date('2027-03-01T19:05:00Z'))).toBe(true);
    expect(reminderDue(new Date('2027-03-01T19:15:00Z'))).toBe(false);
    expect(reminderDue(new Date('2027-03-01T20:05:00Z'))).toBe(false);
  });
});
