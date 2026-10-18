import { useEffect, useState } from 'react';
import { fetchWeather, weatherText, WEATHER_POINTS, type Weather } from '../../../supabase/functions/_shared/weather.ts';

const CACHE_KEY = 'weather-cache';
const CACHE_MS = 30 * 60_000;

function cached(): Weather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: Weather };
    return Date.now() - at < CACHE_MS ? data : null;
  } catch {
    return null;
  }
}

const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Vienna' });

export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(cached);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (weather) return;
    fetchWeather()
      .then((w) => {
        setWeather(w);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: w }));
        } catch {
          /* no cache in private mode */
        }
      })
      .catch(() => setError(true));
  }, [weather]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Weer</h2>
      {error && <p className="muted">Weer niet beschikbaar (geen bereik?).</p>}
      {!weather && !error && <p className="muted">Laden…</p>}
      {weather && (
        <table className="weather">
          <thead>
            <tr><th /><th>{WEATHER_POINTS.valley.label}</th><th>{WEATHER_POINTS.summit.label}</th></tr>
          </thead>
          <tbody>
            {weather.valley.map((v, i) => {
              const s = weather.summit[i];
              return (
                <tr key={v.date}>
                  <td>{DAY.format(new Date(`${v.date}T12:00:00Z`))}</td>
                  <td>{weatherText(v.code)}<br /><span className="muted">{Math.round(v.tMin)}/{Math.round(v.tMax)}° · {Math.round(v.snowCm)} cm</span></td>
                  <td>{s ? <>{weatherText(s.code)}<br /><span className="muted">{Math.round(s.tMin)}/{Math.round(s.tMax)}° · wind {Math.round(s.windMaxKmh)}</span></> : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
