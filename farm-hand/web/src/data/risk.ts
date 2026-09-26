/**
 * Crop risk: what Farm Hand already sees, read the way an insurer or a grower reads it.
 *
 *   stress hours  time a box's probe read below its stress line (brand.baselinePct), from the loaded history
 *   watched       share of the loaded window with a working probe reading (a probe that is off is not watching)
 *   drought now   the Open-Meteo soil model at the grid point nearest FIU (served by /farmhand/api/soil-now)
 *
 * History points arrive about every 5 minutes. Each working reading counts for the time until the next point,
 * capped at GAP_MS, so a board that was off is never counted as watched. Same "probe off" rule as the History chart:
 * a rail value (under 5 % or 100 %) is no reading.
 */
import type { HistorySeries } from './types';

const GAP_MS = 30 * 60_000;
const STEP_MS = 5 * 60_000;
const H = 3600e3;

export const FIU = { lat: 25.7566, lon: -80.374 };

export const validPct = (v: number | null | undefined): number | null => (v == null || v < 5 || v >= 99.5 ? null : v);

export interface BoxRisk {
  /** hours with a working reading below the line */
  stressH: number;
  /** hours with a working reading */
  watchedH: number;
}

export interface WindowRisk {
  /** start and end of the loaded window, epoch ms (null when nothing is loaded) */
  t0: number | null;
  t1: number | null;
  spanH: number;
  box: Record<string, BoxRisk>;
  /** share of the window where at least one box had a working reading, 0-100 (null when nothing is loaded) */
  watchedPct: number | null;
}

/** Time each working reading covers: until the next point, never more than GAP_MS. */
function covered(points: HistorySeries['points'], end: number): { t: number; ms: number; v: number | null }[] {
  const pts = [...points].sort((a, b) => a.t - b.t);
  return pts.map((p, i) => {
    const next = i + 1 < pts.length ? pts[i + 1].t : Math.min(end, p.t + STEP_MS);
    return { t: p.t, ms: Math.max(0, Math.min(next - p.t, GAP_MS)), v: validPct(p.moisturePct) };
  });
}

export function windowRisk(series: Record<string, HistorySeries | undefined>, ids: string[], line: number, now = Date.now()): WindowRisk {
  const all = ids.flatMap((id) => series[id]?.points ?? []);
  if (!all.length) return { t0: null, t1: null, spanH: 0, box: {}, watchedPct: null };
  const t0 = Math.min(...all.map((p) => p.t));
  const last = Math.max(...all.map((p) => p.t));
  // The window runs from the first logged point to now: a silent board is unwatched time.
  const t1 = Math.max(last + STEP_MS, now);
  const box: Record<string, BoxRisk> = {};
  const spans: [number, number][] = [];
  for (const id of ids) {
    let stress = 0, watched = 0;
    for (const c of covered(series[id]?.points ?? [], t1)) {
      if (c.v == null) continue;
      watched += c.ms;
      if (c.v < line) stress += c.ms;
      spans.push([c.t, c.t + c.ms]);
    }
    box[id] = { stressH: stress / H, watchedH: watched / H };
  }
  // union of watched spans across the boxes
  spans.sort((a, b) => a[0] - b[0]);
  let union = 0, cur: [number, number] | null = null;
  for (const s of spans) {
    if (cur && s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else { if (cur) union += cur[1] - cur[0]; cur = [s[0], s[1]]; }
  }
  if (cur) union += cur[1] - cur[0];
  const span = t1 - t0;
  return { t0, t1, spanH: span / H, box, watchedPct: span > 0 ? Math.min(100, (union / span) * 100) : null };
}

// ------------------------------------------------------------------ drought exposure now
export interface SoilPoint { lat: number; lon: number; moisturePct: number | null; temp6cmC: number | null; week?: (number | null)[] }
export type Level = 'low' | 'medium' | 'high';

export function nearestPoint(points: SoilPoint[], lat: number, lon: number): SoilPoint | null {
  const k = Math.cos((lat * Math.PI) / 180);
  let best: SoilPoint | null = null, bd = Infinity;
  for (const p of points) {
    if (p.moisturePct == null) continue;
    const d = (p.lat - lat) ** 2 + ((p.lon - lon) * k) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/**
 * Soil water by volume (3-9 cm) on South Florida's sandy, rocky ground: under 15 % is dry, 15-22 % is getting there.
 * A hot, drying week moves the level up one step.
 */
export function droughtLevel(p: SoilPoint): { level: Level; why: string } | null {
  const m = p.moisturePct;
  if (m == null) return null;
  const week = (p.week ?? []).filter((v): v is number => typeof v === 'number');
  const drift = week.length > 1 ? week[week.length - 1] - week[0] : 0;
  const drying = drift <= -1.5, hot = p.temp6cmC != null && p.temp6cmC >= 30;
  let i = m < 15 ? 2 : m < 22 ? 1 : 0;
  if (drying && hot) i = Math.min(2, i + 1);
  const level = (['low', 'medium', 'high'] as const)[i];
  const trend = drying ? ' and drying this week' : drift >= 1.5 ? ' and wetter than last week' : '';
  const heat = hot ? `, with the ground at ${p.temp6cmC!.toFixed(0)} °C` : '';
  const water = `${m.toFixed(1)}% water`;
  const why = level === 'high'
    ? `Soil near FIU is down to ${water}${trend}${heat}. A crop without watering is at risk now.`
    : level === 'medium'
      ? `Soil near FIU holds ${water}${trend}${heat}. A dry week would start to stress a crop that isn't watered.`
      : `Soil near FIU holds ${water}${trend}${heat}. A few dry days would not stress a crop yet.`;
  return { level, why };
}
