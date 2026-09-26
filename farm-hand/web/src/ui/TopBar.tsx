import { brand } from '../brand';
import { useApp } from '../data/store';
import { ago, BOX_IDS, moistureOf, rawOf, toMs, useBox, useNow, type BoxId } from './farmData';
import { Logo } from './icons';

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
  if (timelapse) status = { tone: 'quiet', text: 'Playing the results timelapse' };
  else if (!online && now - bootAt < 8000) status = { tone: 'quiet', text: `Connecting, ${lastText}` };
  else if (!online && streamOpen) status = { tone: 'warn', text: `Sensor board offline, ${lastText}` };
  else if (!online) status = { tone: 'bad', text: `Offline, ${lastText}` };
  else if (staleAt != null) status = { tone: 'quiet', text: lastText[0].toUpperCase() + lastText.slice(1) };
  else if (last != null && now - last > QUIET_MS) status = { tone: 'warn', text: `Sensors quiet, ${lastText}` };
  else status = { tone: 'ok', text: last != null ? `Live, last reading ${ago(now - last)}` : 'Live' };

  return (
    <header className="topbar">
      <div className="brandmark">
        <Logo size={26} />
        <div>
          <h1>{brand.name}</h1>
          <p>{brand.tagline}</p>
        </div>
      </div>
      <span className={`status status-${status.tone}`} role="status" aria-live="polite">
        <i className="dot" />
        <span className="num">{status.text}</span>
      </span>
      <div className="live-reads" aria-label="Live soil readings">
        <BoxRead id="A" name="Laya" />
        <BoxRead id="B" name="Timer" />
      </div>
    </header>
  );
}

/** Always-on readout: each box's soil moisture and soil temperature, straight from the latest reading. */
function BoxRead({ id, name }: { id: BoxId; name: string }) {
  const l = useBox(id);
  const m = moistureOf(l);
  const raw = rawOf(l);
  const temp = l?.tempOnline && l.tempC != null ? l.tempC : null;
  return (
    <div className={`live-read live-read-${id.toLowerCase()}`}>
      <span className="live-read-id">{id}</span>
      <div className="live-read-name">{name}</div>
      <div className="live-read-vals">
        <span className={m.pct == null ? 'is-missing' : ''}>
          <b className="num">{m.pct != null ? `${Math.round(m.pct)}%` : '—'}</b>
          <small>{m.pct != null ? 'moisture' : m.state === 'disconnected' ? `probe not reading${raw != null ? ` (${raw})` : ''}` : 'no moisture yet'}</small>
        </span>
        <span className={temp == null ? 'is-missing' : ''}>
          <b className="num">{temp != null ? `${temp.toFixed(1)}°C` : '—'}</b>
          <small>{temp != null ? 'soil temp' : 'no temp sensor'}</small>
        </span>
      </div>
    </div>
  );
}
