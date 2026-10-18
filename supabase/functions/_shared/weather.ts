// Open-Meteo forecast for the valley (Bad Gastein) and the summit (Stubnerkogel).
// No API key needed. Shared by the app (Berg tab) and Soipie.

export const WEATHER_POINTS = {
  valley: { lat: 47.115, lng: 13.134, elevation: 1000, label: 'Dal (1000 m)' },
  summit: { lat: 47.1063, lng: 13.0915, elevation: 2246, label: 'Top (2246 m)' },
} as const;

export interface DayForecast {
  date: string;
  tMin: number;
  tMax: number;
  snowCm: number;
  windMaxKmh: number;
  cloudPct: number;
  code: number;
}

export interface Weather {
  valley: DayForecast[];
  summit: DayForecast[];
}

interface OpenMeteoDaily {
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    snowfall_sum: number[];
    wind_speed_10m_max: number[];
    cloud_cover_mean: number[];
    weather_code: number[];
  };
}

function parse(r: OpenMeteoDaily): DayForecast[] {
  const d = r.daily;
  return d.time.map((date, i) => ({
    date,
    tMin: d.temperature_2m_min[i],
    tMax: d.temperature_2m_max[i],
    snowCm: d.snowfall_sum[i],
    windMaxKmh: d.wind_speed_10m_max[i],
    cloudPct: d.cloud_cover_mean[i],
    code: d.weather_code[i],
  }));
}

export async function fetchWeather(fetchFn: typeof fetch = fetch, days = 5): Promise<Weather> {
  const { valley, summit } = WEATHER_POINTS;
  const params = new URLSearchParams({
    daily: 'temperature_2m_max,temperature_2m_min,snowfall_sum,wind_speed_10m_max,cloud_cover_mean,weather_code',
    timezone: 'Europe/Vienna',
    forecast_days: String(days),
  });
  const coords = `latitude=${valley.lat},${summit.lat}&longitude=${valley.lng},${summit.lng}&elevation=${valley.elevation},${summit.elevation}`;
  const res = await fetchFn(`https://api.open-meteo.com/v1/forecast?${coords}&${params}`);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const [v, s] = (await res.json()) as [OpenMeteoDaily, OpenMeteoDaily];
  return { valley: parse(v), summit: parse(s) };
}

/** WMO weather code → short Dutch description. */
export function weatherText(code: number): string {
  if (code === 0) return 'Zonnig';
  if (code === 1) return 'Overwegend zonnig';
  if (code === 2) return 'Half bewolkt';
  if (code === 3) return 'Bewolkt';
  if (code === 45 || code === 48) return 'Mist';
  if (code >= 51 && code <= 57) return 'Motregen';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Regen';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Sneeuw';
  if (code >= 95) return 'Onweer';
  return 'Wisselend';
}

const fmt = (label: string, d: DayForecast) =>
  `${label} ${d.date}: ${weatherText(d.code)}, ${Math.round(d.tMin)} tot ${Math.round(d.tMax)} °C, ${Math.round(d.snowCm)} cm sneeuw, wind tot ${Math.round(d.windMaxKmh)} km/u`;

export function weatherSummary(w: Weather): string {
  const lines: string[] = [];
  w.valley.forEach((d, i) => {
    lines.push(fmt(WEATHER_POINTS.valley.label, d));
    if (w.summit[i]) lines.push(fmt(WEATHER_POINTS.summit.label, w.summit[i]));
  });
  return lines.join('\n');
}
