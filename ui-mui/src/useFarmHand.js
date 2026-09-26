import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FarmHand } from './sim.js';
import { onFrame } from './motion.js';

// One sim for the page. window.farmHand is the live sim in the console, as in ui/.
const fh = new FarmHand();
window.farmHand = fh;

/*
 * The sim runs at `speed` simulated seconds per real second: one fh.step() per simulated second, like the
 * chip's one reading a second. It runs on the shared frame loop (motion.js), before anything draws.
 *
 * Rendering (motion.md P0): App does NOT re-render on sim ticks. Each component that shows sim state subscribes
 * at its own rate:
 *   useSim(hz)             re-render while the sim runs, at most hz times a real second
 *   useSimValue(read, hz)  re-render only when read(fh) changes (Object.is; return a primitive or a string)
 * act(fn) updates every subscriber at once, whatever its rate. Continuous motion (the pour, the waterline,
 * the rolling numbers) is written per frame to the DOM by motion.js followers, not through React.
 *
 * `sim` is readable anywhere without a hook: sim.speed, sim.paused, sim.frac() (0..1 into the next sim second;
 * ages and countdowns are in simulated time, so they stay honest at any speed).
 */
export const sim = { fh, speed: 1, paused: false, version: 0, frac: () => acc };
let acc = 0;

// ---- the store -------------------------------------------------------------------------------------------
const subs = new Set();
function notify(now, force) {
  for (const s of subs) {
    if (!force && now < s.next) continue;
    s.next = now + 1000 / s.hz;
    s.check(force);
  }
}

let started = false;
function start() {
  if (started) return;
  started = true;
  // priority 0: step the sim first; 10: tell React subscribers
  onFrame((now, dt) => {
    if (sim.paused) return;
    acc += dt * sim.speed;
    let n = Math.floor(acc);
    acc -= n;
    if (n > 0) sim.version++;
    while (n-- > 0) fh.step();
  }, 0);
  onFrame((now) => notify(now, false), 10);
}

function useSubscription(check, hz) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const ref = useRef(null);
  ref.current = check;
  useEffect(() => {
    const s = { hz, next: 0, check: (force) => ref.current(force, bump) };
    subs.add(s);
    return () => subs.delete(s);
  }, [hz]);
}

/** Re-render this component while the sim runs, at most `hz` times a real second, and at once after act(). */
export function useSim(hz = 4) {
  const seen = useRef(-1);
  useSubscription((force, bump) => {
    // Paused: only re-render when something changed (an act(), a skip).
    if (force || !sim.paused || seen.current !== sim.version) { seen.current = sim.version; bump(); }
  }, hz);
  return fh;
}

/** Re-render only when read(fh) changes. Returns the current value. */
export function useSimValue(read, hz = 4) {
  const readRef = useRef(read);
  readRef.current = read;
  const last = useRef(undefined);
  const value = read(fh);
  last.current = value;
  useSubscription((force, bump) => {
    const v = readRef.current(fh);
    if (!Object.is(v, last.current)) { last.current = v; bump(); }
    else if (force && typeof v === 'object') bump();
  }, hz);
  return value;
}

/*
 * For App: returns { fh, speed, setSpeed, paused, setPaused, act, frac }, all stable. App re-renders only when
 * speed or paused changes.
 */
export function useFarmHand() {
  const [speed, setSpeedState] = useState(1);
  const [paused, setPausedState] = useState(false);
  sim.speed = speed;
  sim.paused = paused;
  useEffect(() => { start(); }, []);

  const setSpeed = useCallback((v) => { sim.speed = v; sim.version++; setSpeedState(v); notify(performance.now(), true); }, []);
  const setPaused = useCallback((v) => { sim.paused = v; sim.version++; setPausedState(v); notify(performance.now(), true); }, []);
  const act = useCallback((fn) => {
    const r = fn(fh);
    sim.version++;
    notify(performance.now(), true);
    return r;
  }, []);
  const frac = useCallback(() => acc, []);

  return { fh, speed, setSpeed, paused, setPaused, act, frac };
}
