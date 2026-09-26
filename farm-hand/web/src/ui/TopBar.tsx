import { brand } from '../brand';
import { useApp } from '../data/store';
import { ago, BOX_IDS, toMs, useNow } from './farmData';
import { Logo } from './icons';

/** A reading older than this means the ESP32 has gone quiet (it posts every ~10 s). */
const QUIET_MS = 60_000;

export function TopBar() {
  const online = useApp((s) => s.backendOnline);
  const live = useApp((s) => s.live);
  const now = useNow(1000);
  const times = BOX_IDS.map((id) => toMs(live[id]?.t)).filter((t): t is number => t != null);
  const last = times.length ? Math.max(...times) : null;
  const quiet = last != null && now - last > QUIET_MS;

  let status: { tone: 'ok' | 'warn' | 'bad'; text: string };
  if (!online) status = { tone: 'bad', text: 'Offline, reconnecting' };
  else if (last == null) status = { tone: 'warn', text: 'Connected, waiting for the first reading' };
  else if (quiet) status = { tone: 'warn', text: `Sensors quiet, last reading ${ago(now - last)}` };
  else status = { tone: 'ok', text: `Live, last reading ${ago(now - last)}` };

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
    </header>
  );
}
