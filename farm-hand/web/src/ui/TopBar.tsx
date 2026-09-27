import { useEffect, useRef } from 'react';
import { brand } from '../brand';
import { useApp } from '../data/store';
import { ago, BOX_IDS, moistureOf, toMs, useBox, useNow, type BoxId } from './farmData';
import { Logo } from './icons';
import { Listen } from './Listen';

/** A reading older than this means the ESP32 has gone quiet (it posts every ~10 s). */
const QUIET_MS = 60_000;

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const bootAt = Date.now();

export function TopBar() {
  const online = useApp((s) => s.backendOnline);
  const live = useApp((s) => s.live);
  const staleAt = useApp((s) => (s as { staleAt?: number | null }).staleAt ?? null);
  const timelapse = useApp((s) => (s as { timelapse?: boolean }).timelapse ?? false);
  const now = useNow(1000);
  // the server's own `link` event reports the sensor board; the stream itself being open means the Mac mini answers
  const streamOpen = (useApp.getState().board as unknown as { stream?: EventSource | null }).stream?.readyState === 1;
  const times = BOX_IDS.map((id) => toMs(live[id]?.t)).filter((t): t is number => t != null);
  const last = staleAt ?? (times.length ? Math.max(...times) : null);
  const lastText = last != null ? `last reading ${now - last < 3600e3 * 20 ? hhmm(last) : new Date(last).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'no reading yet';

  // No spinners: before the stream answers, the boxes show the last known scan and this says how old it is.
  let status: { tone: 'ok' | 'warn' | 'bad' | 'quiet'; text: string };
  if (timelapse) status = { tone: 'quiet', text: 'Replaying recorded readings' };
  else if (!online && now - bootAt < 8000) status = { tone: 'quiet', text: `Connecting, ${lastText}` };
  else if (!online && streamOpen) status = { tone: 'warn', text: `Sensor board offline, ${lastText}` };
  else if (!online) status = { tone: 'bad', text: `Offline, ${lastText}` };
  else if (staleAt != null) status = { tone: 'quiet', text: lastText[0].toUpperCase() + lastText.slice(1) };
  else if (last != null && now - last > QUIET_MS) status = { tone: 'warn', text: `Sensors quiet, ${lastText}` };
  else status = { tone: 'ok', text: last != null ? `Live, last reading ${ago(now - last)}` : 'Live' };

  // The bar re-flows (one row, two, or stacked in Split View): publish its real height as --topbar-h, so the
  // bottom sheets on narrow screens stop just under it instead of guessing.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const set = () => document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => ro.disconnect();
  }, []);

  return (
    <header className="topbar" ref={ref}>
      <div className="tb">
        <div className="brandmark">
          <Logo size={26} />
          <div>
            <h1>{brand.name}</h1>
            <p>{brand.tagline}</p>
          </div>
        </div>
        <div className="tb-status">
          <span className={`status status-${status.tone}`} role="status" aria-live="polite">
            <i className="dot" />
            <span className="num">{status.text}</span>
          </span>
          <Listen />
        </div>
        <div className="reads" role="table" aria-label="Live soil readings">
          <div className="reads-row reads-head" role="row">
            <span role="columnheader"><span className="sr-only">Box</span></span>
            <span role="columnheader">Moisture</span>
            <span role="columnheader">Soil temp</span>
          </div>
          <BoxRead id="A" name="Decision model" />
          <BoxRead id="B" name="Timer" />
        </div>
      </div>
    </header>
  );
}

/** Always-on readout, one tile per box, readable from 3 m: the box, then Moisture and Soil temp as big numbers,
 *  or one short state in the caution colour when a sensor is off (the raw count is in the Box panel). */
function BoxRead({ id, name }: { id: BoxId; name: string }) {
  const l = useBox(id);
  const m = moistureOf(l);
  const temp = l?.tempOnline && l.tempC != null ? l.tempC : null;
  const moist = m.pct != null ? `${Math.round(m.pct)}%` : null;
  const moistOff = m.state === 'disconnected' ? 'Probe off' : m.state === 'uncalibrated' ? 'Not set up' : 'Waiting';
  return (
    <div className={`reads-row reads-${id.toLowerCase()}`} role="row">
      <span className="reads-box" role="rowheader"><i>{id}</i>{name}</span>
      <span role="cell">{moist ? <b className="num">{moist}</b> : <b className="is-off">{moistOff}</b>}</span>
      <span role="cell">{temp != null ? <b className="num">{temp.toFixed(1)}°C</b> : <b className="is-off">{l ? 'No sensor' : 'Waiting'}</b>}</span>
    </div>
  );
}
