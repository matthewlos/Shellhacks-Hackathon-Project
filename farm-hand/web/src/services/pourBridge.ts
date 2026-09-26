/**
 * Pour / pump client, Farm Hand edition.
 *
 * Farm Hand waters with pumps driven by the ESP32 from the server's decision, not with a servo the
 * page can trigger. The pumps are DISARMED in firmware until the box mapping is confirmed, so every
 * request here is refused by the server (farm-hand/cloud/receiver.py, POST /farmhand/api/pour) and
 * reported honestly. Callers (the Pour button, the agent tools) keep the same functions.
 */
const BASE = ((import.meta.env.VITE_POUR_BRIDGE as string | undefined) || (import.meta.env.VITE_BACKEND as string | undefined) || '/farmhand').replace(/\/$/, '');

export type PourResult = 'started' | 'busy' | 'cooldown' | 'offline' | 'no_reply' | 'disarmed';
export type PourPhase = 'tipping' | 'holding' | 'returning' | 'done';

export interface PourActuatorStatus {
  connected: boolean;
  phase?: 'idle' | PourPhase;
  restDeg?: number;
  pourDeg?: number;
  pours?: number;
  cooldownMsLeft?: number;
}

export async function pourWater(holdMs?: number): Promise<PourResult> {
  try {
    const res = await fetch(`${BASE}/api/pour`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(holdMs ? { holdMs } : {}) });
    const r = (await res.json()) as { ok?: boolean; result?: string };
    return r.ok && r.result === 'started' ? 'started' : 'disarmed';
  } catch {
    return 'offline';   // server not reachable
  }
}

export async function pourActuatorStatus(): Promise<PourActuatorStatus> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    const res = await fetch(`${BASE}/api/pour/status`, { signal: ctl.signal });
    clearTimeout(timer);
    return ((await res.json()) as { actuator?: PourActuatorStatus }).actuator ?? { connected: false };
  } catch {
    return { connected: false };
  }
}

/** Live phases of a physical pour. Farm Hand has none the page can follow yet: never fires. Returns an unsubscribe function. */
export function onPourPhase(_cb: (phase: PourPhase) => void): () => void {
  return () => {};
}

export const POUR_RESULT_TEXT: Record<PourResult, string> = {
  started: 'Pouring…',
  busy: 'Already pouring',
  cooldown: 'Cooling down: try again in a few seconds',
  offline: 'The Farm Hand server is not reachable',
  no_reply: 'The board did not answer',
  disarmed: 'The pumps are disarmed until the box mapping is confirmed',
};

// ---------------------------------------------------------------- the guarded route (agents)
export interface GuardedPour {
  ok: boolean;
  result: PourResult | 'refused' | 'unauthorized';
  reason?: string;
  /** soft = the person may override it (zone A already wet, too many pours recently); hard = never */
  guard?: 'soft' | 'hard';
  softKind?: 'wet' | 'window';
  reading?: { moisturePct: number | null };
  holdMsUsed?: number;
}

/**
 * POST /api/pour: on Farm Hand the server always refuses (hard guard) while the pumps are disarmed.
 * `force` overrides SOFT guards only, and the page sends it only after the person confirms (agent/agentStore.ts).
 */
export async function requestGuardedPour(opts: { holdMs?: number; force?: boolean }, signal?: AbortSignal): Promise<GuardedPour> {
  try {
    const res = await fetch(`${BASE}/api/pour`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(opts.holdMs ? { holdMs: opts.holdMs } : {}), ...(opts.force ? { force: true } : {}) }) });
    return (await res.json()) as GuardedPour;
  } catch {
    return { ok: false, result: 'offline', reason: 'The Farm Hand server is not reachable, so nothing can be watered.', guard: 'hard' };
  }
}

export async function guardedPourStatus(): Promise<{ actuator: PourActuatorStatus; detector?: unknown } | null> {
  try { return (await (await fetch(`${BASE}/api/pour/status`, { signal: AbortSignal.timeout(4000) })).json()) as { actuator: PourActuatorStatus }; } catch { return null; }
}
