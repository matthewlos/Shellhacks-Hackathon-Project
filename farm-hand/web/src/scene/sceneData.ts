/**
 * What the 3D scene reads from the store, in one place.
 *
 * The data layer is being reshaped for Farm Hand (per-box moisture/temperature/raw/probeOk, pumps, decision),
 * so these readers accept both the old Prompt Grass shape (`live[id].moisturePct`, `moistureOnline`, ...) and the
 * new one, and fall back to "unknown" rather than inventing a value.
 * TODO(data): once store.ts exports the Farm Hand types, drop the `any` and read the fields directly.
 */
import { useApp } from '../data/store';

export type BoxId = 'A' | 'B';
export const BOXES: { id: BoxId; name: string; role: string }[] = [
  { id: 'A', name: 'Farm Hand', role: 'AI-watered' },
  { id: 'B', name: 'Timer', role: 'control' },
];

export interface BoxReading {
  /** 0..100, null when the soil probe is disconnected or not reporting */
  moisturePct: number | null;
  /** °C, null when the DS18B20 is not reporting */
  tempC: number | null;
  probeOk: boolean;
  /** false when nothing has arrived for this box at all */
  present: boolean;
  /** changes every time a new sample for this box arrives (heartbeat) */
  sampleKey: unknown;
  pumping: boolean;
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function readBox(state: unknown, id: BoxId): BoxReading {
  const st = state as Any;
  const z: Any = st?.live?.[id] ?? st?.boxes?.[id] ?? st?.zones?.[id] ?? null;
  const rawMoist = num(z?.moisturePct) ?? num(z?.moisture) ?? num(z?.pct);
  const probeOk = z == null ? false : typeof z.probeOk === 'boolean' ? z.probeOk : typeof z.moistureOnline === 'boolean' ? z.moistureOnline : rawMoist != null;
  const moisturePct = probeOk ? rawMoist : null;
  const tempOk = z?.tempOnline !== false && z?.tempOk !== false;
  const tempC = tempOk ? num(z?.tempC) ?? num(z?.temperature) ?? num(z?.temp) : null;
  const sampleKey = z == null ? null : z.t ?? z.ts ?? z.time ?? z;
  const pumps: Any = st?.pumps;
  const pumping = pumps?.[id] === true || pumps?.[id]?.on === true;
  return { moisturePct, tempC, probeOk, present: z != null, sampleKey, pumping };
}

/** Key that changes when the AI makes a new decision (null when there is none). */
export function decisionKey(state: unknown): unknown {
  const d = (state as Any)?.decision;
  return d ? d.t ?? d : null;
}

/** React hook: re-renders the labels when a box's reading changes. */
export function useBox(id: BoxId): BoxReading {
  const live = useApp((s) => (s as Any).live?.[id] ?? (s as Any).boxes?.[id] ?? null);
  const pump = useApp((s) => (s as Any).pumps?.[id] ?? null);
  void live; void pump;
  return readBox(useApp.getState(), id);
}
