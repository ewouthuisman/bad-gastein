import { describe, expect, it } from 'vitest';
import { initials, peopleGeoJson } from '../../src/features/map/layers';

const now = new Date('2027-03-02T12:00:00Z');
const at = (h: number) => new Date(now.getTime() - h * 3_600_000);
const person = (id: string, updatedAt: Date | null) => ({ id, name: 'Anna de Vries', color: '#f00', lat: 47.1, lng: 13.1, updatedAt });

describe('peopleGeoJson', () => {
  const fc = peopleGeoJson([person('fresh', at(0.5)), person('stale', at(3)), person('gone', at(13)), person('never', null)], now);
  const props = (id: string) => fc.features.find((f) => f.properties?.id === id)?.properties;

  it('shows fresh people fully opaque', () => expect(props('fresh')?.opacity).toBe(1));
  it('greys out locations older than 2 hours', () => expect(props('stale')?.opacity).toBe(0.4));
  it('hides locations older than 12 hours and people without one', () => {
    expect(props('gone')).toBeUndefined();
    expect(props('never')).toBeUndefined();
  });
  it('uses initials as label', () => expect(initials('Anna de Vries')).toBe('AD'));
});
