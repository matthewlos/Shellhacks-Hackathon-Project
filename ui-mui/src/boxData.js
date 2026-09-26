import { useEffect, useState, useSyncExternalStore } from 'react';

/*
 * The real box. farm-hand/cloud/receiver.py serves GET /farmhand/data on the site's own origin:
 *   { latest, decision: [brain, pick, pump_a_s, why], age_s, count, baseline, brain, hist: [{ts, a, b, t1, t2, pa, pb}] }
 * In dev, vite.config.js proxies /farmhand to the home server.
 *
 * useBoxData() polls every 5 s while it is mounted (only the Live page mounts it), skips polls while the tab is
 * hidden, and gives each request a 4 s timeout. It also feeds a tiny store so the header can show
 * "Live from box A" / "Box A offline" with useBoxStatus(), without a second poller.
 */
export const BOX_URL = import.meta.env.VITE_BOX_URL || '/farmhand/data';
const EVERY_MS = 5000;
const TIMEOUT_MS = 4000;
export const LIVE_S = 120;         // a reading younger than this counts as live

// ---- the shared status store (header tag) -----------------------------------------------------------------
let status = null;                 // 'live' | 'offline' | 'unreachable' | 'empty' | null (loading / not on Live)
const subs = new Set();
function setStatus(s) {
  if (s === status) return;
  status = s;
  subs.forEach((f) => f());
}
export function useBoxStatus() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => status, () => null);
}

// ---- clock times (real wall-clock, not the sim's) ----------------------------------------------------------
const hm = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
const dm = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' });
/** "6:45 AM"; "Sep 24, 6:45 AM" when not today. `short` for axis ticks: "6 AM" on the hour. ts in epoch s. */
export function clockAt(ts, short = false) {
  const d = new Date(ts * 1000);
  if (short && d.getMinutes() === 0) return hm.format(d).replace(/:00/, '');
  const s = hm.format(d);
  return !short && d.toDateString() !== new Date().toDateString() ? `${dm.format(d)}, ${s}` : s;
}
/** "40 s", "12 min", "7 h", "3 days" */
export function agoText(s) {
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (s < 48 * 3600) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} days`;
}

// ---- reading the payload ----------------------------------------------------------------------------------
// A soil % at or above this, from a probe the server calls "not connected", is the unplugged pin reading full.
export const IMPLAUSIBLE_PCT = 99.5;

/*
 * Everything the page shows, in one place, derived from one response. `rx` is when the server last heard from the
 * board, as a local epoch ms (fetch time minus age_s), so ages keep counting between polls.
 * The server keeps `latest` and `decision` in memory only: after it restarts they are null while `hist` still has
 * rows. Then the last history row stands in as the last reading, and there is no decision to show.
 */
export function readBox(data, fetchedAt) {
  if (!data) return null;
  const hist = Array.isArray(data.hist) ? data.hist : [];
  const lastRow = hist[hist.length - 1] || null;
  const L = data.latest || null;
  const d = Array.isArray(data.decision) ? data.decision : null;
  const why = d ? String(d[3] || '') : '';
  const count = data.count || 0;

  let rx = null;
  if (data.age_s != null) rx = fetchedAt - data.age_s * 1000;
  else if (lastRow) rx = lastRow.ts * 1000;

  const probeAOff = /probe a not connected/i.test(why);
  let soil = null, soilFault = null;
  if (L) {
    // The server's own test (receiver.py decide: a_raw < 500), or its decision saying so.
    const bad = L.a_pct == null || (L.a_raw != null && L.a_raw < 500) || probeAOff;
    if (bad) soilFault = 'Soil probe A not connected';
    else soil = L.a_pct;
  } else if (lastRow) {
    if (lastRow.a == null || lastRow.a >= IMPLAUSIBLE_PCT) soilFault = 'Soil probe A not connected';
    else soil = lastRow.a;
  }
  const t1 = L ? L.t1 : lastRow ? lastRow.t1 : null;
  const pumpA = L && Array.isArray(L.pumps) ? L.pumps[0] : lastRow ? lastRow.pa : null;

  const empty = count === 0 && !L && !hist.length;
  const age = rx == null ? null : Math.max(0, (Date.now() - rx) / 1000);
  const live = !empty && data.age_s != null && data.age_s < LIVE_S;

  return {
    empty, live, rx, age, count,
    baseline: data.baseline ?? null,
    soil, soilFault,
    temp: t1 ?? null, tempFault: t1 == null ? 'No temperature reading' : null,
    pumpA: pumpA == null ? null : !!pumpA,
    decision: d ? { brain: d[0], pick: d[1], pumpS: d[2], why } : null,
    hist,
    ms: L ? L.ms : lastRow ? lastRow.ts : null,   // changes with every new reading (the reading dot)
  };
}

export function useBoxData() {
  const [state, setState] = useState({ data: null, error: null, lastOk: null, fetchedAt: null });

  useEffect(() => {
    let alive = true, timer = null, ctl = null;

    async function poll() {
      clearTimeout(timer);
      if (document.hidden) return;          // resumes on visibilitychange
      ctl?.abort();
      ctl = new AbortController();
      const kill = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(BOX_URL, { signal: ctl.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || typeof data !== 'object' || !('hist' in data)) throw new Error('Unexpected response');
        const now = Date.now();
        if (alive) setState({ data, error: null, lastOk: now, fetchedAt: now });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, error: e.name === 'AbortError' ? 'timeout' : String(e.message || e) }));
      } finally {
        clearTimeout(kill);
        if (alive && !document.hidden) timer = setTimeout(poll, EVERY_MS);
      }
    }
    const onVis = () => { if (!document.hidden) poll(); else clearTimeout(timer); };

    poll();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      clearTimeout(timer);
      ctl?.abort();
      document.removeEventListener('visibilitychange', onVis);
      setStatus(null);
    };
  }, []);

  // Tell the header. Derived, not stored, so it can't disagree with the page.
  const box = readBox(state.data, state.fetchedAt);
  const s = state.error ? 'unreachable' : !box ? null : box.empty ? 'empty' : box.live ? 'live' : 'offline';
  useEffect(() => { setStatus(s); }, [s]);

  return { ...state, box, status: s };
}
