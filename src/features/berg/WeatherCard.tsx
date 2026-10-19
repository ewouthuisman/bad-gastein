import { Fragment, useEffect, useState } from 'react';
import { fetchWeather, weatherText, WEATHER_POINTS, type DayForecast, type Weather } from '../../../supabase/functions/_shared/weather.ts';

const CACHE_KEY = 'weather-cache-v2';
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
const DAY_LONG = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Vienna' });
const dayLabel = (d: DayForecast) => DAY.format(new Date(`${d.date}T12:00:00Z`));

function Detail({ label, d }: { label: string; d: DayForecast }) {
  return (
    <div className="weather-detail-col">
      <strong>{label}</strong>
      <div>{weatherText(d.code)}</div>
      <dl>
        <dt>Temperatuur</dt><dd>{Math.round(d.tMin)}° tot {Math.round(d.tMax)}°</dd>
        <dt>Sneeuwval</dt><dd>{Math.round(d.snowCm)} cm</dd>
        <dt>Neerslag</dt><dd>{d.precipMm.toFixed(1)} mm</dd>
        <dt>Wind</dt><dd>tot {Math.round(d.windMaxKmh)} km/u</dd>
        <dt>Bewolking</dt><dd>{Math.round(d.cloudPct)}%</dd>
        <dt>Zon</dt><dd>{d.sunHours.toFixed(1)} uur</dd>
      </dl>
    </div>
  );
}

export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(cached);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

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
        <>
          <table className="weather">
            <thead>
              <tr><th /><th>{WEATHER_POINTS.valley.label}</th><th>{WEATHER_POINTS.summit.label}</th></tr>
            </thead>
            <tbody>
              {weather.valley.map((v, i) => {
                const s = weather.summit[i];
                const isOpen = open === v.date;
                return (
                  <Fragment key={v.date}>
                    <tr className={`weather-day ${isOpen ? 'open' : ''}`}>
                      <td>
                        <button type="button" className="weather-toggle" aria-expanded={isOpen} aria-label={`Details ${dayLabel(v)}`}
                          onClick={() => setOpen(isOpen ? null : v.date)}>
                          {dayLabel(v)} <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                        </button>
                      </td>
                      <td>{weatherText(v.code)}<br /><span className="muted">{Math.round(v.tMin)}/{Math.round(v.tMax)}° · ❄ {Math.round(v.snowCm)} cm</span></td>
                      <td>{s ? <>{weatherText(s.code)}<br /><span className="muted">{Math.round(s.tMin)}/{Math.round(s.tMax)}° · ❄ {Math.round(s.snowCm)} cm</span></> : '–'}</td>
                    </tr>
                    {isOpen && (
                      <tr className="weather-detail">
                        <td colSpan={3}>
                          <div className="weather-detail-title">{DAY_LONG.format(new Date(`${v.date}T12:00:00Z`))}</div>
                          <div className="weather-detail-grid">
                            <Detail label={WEATHER_POINTS.valley.label} d={v} />
                            {s && <Detail label={WEATHER_POINTS.summit.label} d={s} />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="muted small-print">Tik op een dag voor meer details. Sneeuw is de verwachte nieuwe sneeuwval.</p>
        </>
      )}
    </div>
  );
}
