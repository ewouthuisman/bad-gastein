import { describe, expect, it, vi } from 'vitest';
import { fetchWeather, weatherSummary, weatherText, WEATHER_POINTS } from '../../supabase/functions/_shared/weather.ts';

const day = (t: string, tMin: number, tMax: number, snow: number, wind: number, cloud: number, code: number) => ({ t, tMin, tMax, snow, wind, cloud, code });
const response = (days: ReturnType<typeof day>[]) => ({
  daily: {
    time: days.map((d) => d.t),
    temperature_2m_min: days.map((d) => d.tMin),
    temperature_2m_max: days.map((d) => d.tMax),
    snowfall_sum: days.map((d) => d.snow),
    wind_speed_10m_max: days.map((d) => d.wind),
    cloud_cover_mean: days.map((d) => d.cloud),
    weather_code: days.map((d) => d.code),
  },
});

describe('fetchWeather', () => {
  it('queries valley and summit in one Open-Meteo call and maps both', async () => {
    const fetchFn = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => [response([day('2027-03-01', -6, 2, 4.2, 18, 80, 73)]), response([day('2027-03-01', -14, -8, 12, 55, 95, 75)])],
    }));
    const w = await fetchWeather(fetchFn as never);
    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain(`latitude=${WEATHER_POINTS.valley.lat},${WEATHER_POINTS.summit.lat}`);
    expect(url).toContain('timezone=Europe%2FVienna');
    expect(w.valley[0]).toEqual({ date: '2027-03-01', tMin: -6, tMax: 2, snowCm: 4.2, windMaxKmh: 18, cloudPct: 80, precipMm: 0, sunHours: 0, code: 73 });
    expect(w.summit[0].tMin).toBe(-14);
  });
});

describe('weatherText', () => {
  it.each([[0, 'Zonnig'], [2, 'Half bewolkt'], [45, 'Mist'], [73, 'Sneeuw'], [61, 'Regen'], [95, 'Onweer']])('%i → %s', (code, text) => {
    expect(weatherText(code)).toBe(text);
  });
});

describe('weatherSummary', () => {
  it('summarises today for valley and summit in Dutch', () => {
    const d = { date: '2027-03-01', tMin: -6, tMax: 2, snowCm: 4, windMaxKmh: 18, cloudPct: 80, precipMm: 0, sunHours: 0, code: 73 };
    const s = weatherSummary({ valley: [d], summit: [{ ...d, tMin: -14, tMax: -8 }] });
    expect(s).toContain('Dal (1000 m) 2027-03-01: Sneeuw, -6 tot 2 °C, 4 cm sneeuw, wind tot 18 km/u');
    expect(s).toContain('Top (2246 m)');
  });
});
