import { useEffect, useState } from 'react';
import { useApp } from '../data/store';
import type { Forecast as ForecastT } from '../data/types';

const REFRESH_MS = 10 * 60_000;
const day = (iso: string, i: number) => (i === 0 ? 'Today' : new Date(iso + 'T12:00').toLocaleDateString([], { weekday: 'short' }));

/** Open-Meteo, through the data layer. Prefers the store's copy; polls on its own if the store has none. */
function useForecast(): ForecastT | null {
  const fromStore = useApp((s) => (s as { answers?: { forecast?: ForecastT | null } }).answers?.forecast ?? null);
  const board = useApp((s) => s.board) as unknown as { forecast?: () => Promise<ForecastT> };
  const [own, setOwn] = useState<ForecastT | null>(null);
  useEffect(() => {
    if (fromStore || !board?.forecast) return;
    let alive = true;
    const load = () => board.forecast!().then((f) => { if (alive) setOwn(f); }).catch(() => {});
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [board, fromStore]);
  return fromStore ?? own;
}

export function Forecast() {
  const f = useForecast();
  const days = f?.days?.slice(0, 7) ?? [];
  const top = Math.max(10, ...days.map((d) => d.precipMm));
  return (
    <div className="forecast">
      {!f ? (
        <p className="muted">Loading the forecast from Open-Meteo.</p>
      ) : (
        <>
          <p className="forecast-head">
            <b className="num">{f.rainNext48hMm.toFixed(1)} mm</b> in the next 48 h
            {f.maxPrecipProb48h != null && <>, <b className="num">{f.maxPrecipProb48h}%</b> chance</>}
          </p>
          <ol className="days" aria-label="Rain per day, next 7 days">
            {days.map((d, i) => (
              <li key={d.date} title={`${d.precipMm.toFixed(1)} mm${d.precipProb != null ? `, ${d.precipProb}% chance` : ''}`}>
                <span className="day-bar"><i style={{ transform: `scaleY(${Math.min(1, d.precipMm / top)})` }} /></span>
                <span className="day-name">{day(d.date, i)}</span>
              </li>
            ))}
          </ol>
          <p className="small muted">
            {f.sample ? 'Sample data: the live forecast could not be reached. ' : ''}
            The boxes sit indoors, so this rain can't reach them.
          </p>
        </>
      )}
    </div>
  );
}
