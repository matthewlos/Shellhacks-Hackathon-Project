/**
 * Last known scan: the 3D boxes never wait on a loading screen.
 *
 * On startup the store is filled at once, in this order of preference:
 *   1. the last board this browser saw (localStorage, the last one with a working probe if there was one)
 *   2. the bundled snapshot (lastScan.json: one real reading from the server, shipped with the app)
 * then, in the background, the newest reading the server has stored (zone history), if it is newer.
 * The live stream replaces all of it the moment its first sample arrives.
 */
import bundled from './lastScan.json';
import type { BoardConfig, Decision, Pumps, ZoneId, ZoneLive } from './types';

export interface Scan {
  t: number;
  config: BoardConfig;
  live: Record<ZoneId, ZoneLive>;
  pumps: Pumps;
  decision: Decision | null;
  source: 'cache' | 'bundled' | 'server';
}

const KEY = 'farmhand:lastScan';
const hasProbe = (live: Record<ZoneId, ZoneLive>) => Object.values(live).some((z) => z && (z.probeOk ?? z.moistureOnline) && z.moisturePct != null);

function readCache(): { latest?: Scan; good?: Scan } {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}

/** The best scan available without the network. */
export function initialScan(): Scan {
  const c = readCache();
  const cached = c.good ?? c.latest;
  if (cached?.config && cached.live) return { ...cached, source: 'cache' };
  return { ...(bundled as unknown as Omit<Scan, 'source'>), source: 'bundled' };
}

let lastSave = 0;
/** Remember the board; throttled. The last scan with a working probe is kept separately. */
export function saveScan(scan: Omit<Scan, 'source'>): void {
  const now = Date.now();
  if (now - lastSave < 10_000) return;
  lastSave = now;
  try {
    const c = readCache();
    const entry = { ...scan, source: 'cache' as const };
    localStorage.setItem(KEY, JSON.stringify({ latest: entry, good: hasProbe(scan.live) ? entry : c.good }));
  } catch { /* private mode or storage full: the bundled snapshot still covers startup */ }
}

/** The newest reading the server has stored, per box (from zone history), or null. */
export async function serverScan(base: string, config: BoardConfig): Promise<Pick<Scan, 't' | 'live'> | null> {
  try {
    const ids = config.zones.map((z) => z.id);
    const series = await Promise.all(ids.map(async (id) => {
      const r = await fetch(`${base}/api/zones/${encodeURIComponent(id)}/history?hours=6`);
      const j = await r.json();
      const pts: { t: number; moisturePct: number | null; tempC: number | null }[] = j?.history?.points ?? [];
      return [id, pts[pts.length - 1] ?? null] as const;
    }));
    let t = 0;
    const live: Record<ZoneId, ZoneLive> = {};
    for (const [id, p] of series) {
      if (!p) continue;
      t = Math.max(t, p.t);
      const ok = p.moisturePct != null;
      live[id] = { t: p.t, moistureRaw: null, raw: null, moisturePct: p.moisturePct, tempC: p.tempC, moistureOnline: ok, tempOnline: p.tempC != null, probeOk: ok };
    }
    return t ? { t, live } : null;
  } catch { return null; }
}
