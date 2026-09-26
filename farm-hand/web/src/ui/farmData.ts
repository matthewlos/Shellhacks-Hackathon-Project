/**
 * Typed, defensive reads of the Farm Hand fields the data layer adds to the store
 * (`decision`, `pumps`, `pumpsArmed`, and per-zone `raw` / `probeOk`).
 *
 * TODO(data): once src/data/store.ts ships these fields, the casts below can become plain
 * `useApp((s) => s.decision)` etc. They compile before and after that change.
 */
import { useEffect, useState } from 'react';
import { brand } from '../brand';
import { useApp } from '../data/store';
import type { ZoneLive } from '../data/types';

export type BoxId = 'A' | 'B';
export const BOX_IDS: BoxId[] = ['A', 'B'];

export interface Decision { brain: string; pick: string; seconds: number; why: string; t: number }
export type BoxLive = ZoneLive & { raw?: number | null; probeOk?: boolean };

type FarmFields = { decision?: Decision | null; pumps?: Partial<Record<BoxId, boolean>>; pumpsArmed?: boolean };
const farm = (s: unknown) => s as FarmFields;

export const useDecision = () => useApp((s) => farm(s).decision ?? null);
export const usePumpOn = (id: BoxId) => useApp((s) => !!farm(s).pumps?.[id]);
export const usePumpsArmed = () => useApp((s) => farm(s).pumpsArmed ?? brand.pumpsArmed);
export const useBox = (id: BoxId) => useApp((s) => s.live[id] as BoxLive | undefined);

/** Epoch ms, whether the source sent seconds or milliseconds. */
export const toMs = (t: number | null | undefined): number | null => (t == null || !Number.isFinite(t) ? null : t < 1e12 ? t * 1000 : t);

/** Moisture probe state for one box: a number, or the reason there is no number. */
export function moistureOf(l: BoxLive | undefined): { pct: number | null; state: 'ok' | 'disconnected' | 'uncalibrated' | 'none' } {
  if (!l) return { pct: null, state: 'none' };
  const connected = l.probeOk ?? l.moistureOnline;
  if (!connected) return { pct: null, state: 'disconnected' };
  if (l.moisturePct == null) return { pct: null, state: 'uncalibrated' };
  return { pct: l.moisturePct, state: 'ok' };
}
export const rawOf = (l: BoxLive | undefined): number | null => l?.raw ?? l?.moistureRaw ?? null;

/** Re-render every `ms` so "3 s ago" labels tick. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

export const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
