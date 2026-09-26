/*
 * Motion primitives for the drawing and the numbers (PLAN 5d, motion.md P2).
 *
 *  - One requestAnimationFrame loop for the whole page. The sim steps first, then the store tells subscribed
 *    components (at their own rate), then the drawing writes SVG attributes. Nothing here sets React state per frame.
 *  - A critically damped spring (apple-design: damping 1.0, a "response" in seconds) for anything that follows
 *    a reading. Velocity carries across new readings, so there is no 250 ms-then-frozen staircase.
 *  - One reduced-motion flag, read live (owl-listener motion-system: handle it once, at the system level).
 */

// Emil's strong ease-out (theme.js EASE_OUT), for UI that responds to a person.
export const EASE_OUT = [0.23, 1, 0.32, 1];
// Water in a tube: symmetric ease-in-out. Gravity: an accelerating curve (a falling stream, not UI).
export const EASE_TUBE = [0.45, 0, 0.55, 1];
export const EASE_FALL = [0.5, 0, 0.9, 0.5];

// Spring responses (seconds). The drawing gets about one reading period so it glides between 1 Hz readings.
export const RESPONSE = { drawing: 0.9, number: 0.35 };

// Durations (ms) for the pour, the one authored moment (motion.md P1 timeline).
export const POUR = {
  tubeFill: 400,      // ~8 ml of tube at 20 ml/s
  tubeDrain: 500,
  streamIn: 120,
  streamOut: 150,
  chipIn: 200,
  chipOut: 150,
  mlHold: 2500,       // the final ml stays at least this long
  receiptHold: 5000,
  beat: 300,          // probe LED blip
  beatGap: 800,       // at most one blip per 800 ms of real time
};

// ---- reduced motion -------------------------------------------------------------------------------------
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const prefs = { reduced: !!mq?.matches };
mq?.addEventListener?.('change', (e) => { prefs.reduced = e.matches; });

// ---- cubic-bezier, solved for y at x (the same curve CSS uses) --------------------------------------------
export function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const dx = X(t) - x, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= dx / d; }
    return Y(Math.min(1, Math.max(0, t)));
  };
}
export const easeOut = bezier(EASE_OUT);
export const easeTube = bezier(EASE_TUBE);
export const easeFall = bezier(EASE_FALL);

// ---- one frame loop ---------------------------------------------------------------------------------------
// Lower priority runs first: 0 = the sim, 10 = store notifications, 20 = drawing and numbers.
const jobs = [];
let raf = 0, lastNow = 0;
function loop(now) {
  const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60;
  lastNow = now;
  for (const j of jobs.slice()) j.fn(now, dt);
  raf = jobs.length ? requestAnimationFrame(loop) : 0;
  if (!raf) lastNow = 0;
}
export function onFrame(fn, priority = 20) {
  const job = { fn, priority };
  jobs.push(job);
  jobs.sort((a, b) => a.priority - b.priority);
  if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loop);
  return () => { const i = jobs.indexOf(job); if (i >= 0) jobs.splice(i, 1); };
}

// ---- critically damped spring ----------------------------------------------------------------------------
/*
 * x'' = w^2 (target - x) - 2 w x',  w = 2 pi / response.  Solved exactly per frame, so any dt is stable:
 *   e = x - target;  x(t) = target + (e + (v + w e) t) e^{-w t}
 * `set(target)` keeps x and v: a new reading mid-motion bends the path instead of restarting it.
 */
export class Spring {
  constructor(x = 0, response = RESPONSE.drawing) { this.x = x; this.v = 0; this.target = x; this.response = response; this.primed = false; }
  set(target) {
    if (target == null || Number.isNaN(target)) return;
    if (!this.primed) { this.x = target; this.v = 0; this.primed = true; }   // first value: no animation from 0
    this.target = target;
  }
  jump(target) { this.x = this.target = target; this.v = 0; this.primed = true; }
  step(dt) {
    if (prefs.reduced || this.response <= 0) { this.x = this.target; this.v = 0; return this.x; }
    const w = (2 * Math.PI) / this.response;
    const e = this.x - this.target;
    if (Math.abs(e) < 1e-4 && Math.abs(this.v) < 1e-3) { this.x = this.target; this.v = 0; return this.x; }
    const c = this.v + w * e, k = Math.exp(-w * dt);
    this.x = this.target + (e + c * dt) * k;
    this.v = (c - w * (e + c * dt)) * k;
    return this.x;
  }
  get settled() { return this.x === this.target && this.v === 0; }
}

// ---- a tween that retargets from wherever it is (apple-design: start from the presentation value) ----------
export class Tween {
  constructor(x = 0) { this.x = x; this.from = x; this.to = x; this.t0 = 0; this.dur = 0; this.ease = easeTube; }
  go(to, now, dur, ease = easeTube) {
    if (to === this.to && this.dur) return this;
    this.from = this.x; this.to = to; this.t0 = now; this.dur = prefs.reduced ? 0 : dur; this.ease = ease;
    return this;
  }
  jump(x) { this.x = this.from = this.to = x; this.dur = 0; return this; }
  value(now) {
    if (!this.dur) { this.x = this.to; return this.x; }
    const k = Math.min(1, (now - this.t0) / this.dur);
    this.x = this.from + (this.to - this.from) * this.ease(k);
    if (k >= 1) this.dur = 0;
    return this.x;
  }
  get done() { return this.x === this.to; }
}

// ---- small helpers ----------------------------------------------------------------------------------------
export function mixHex(hexA, hexB, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hexA), b = p(hexB), kk = Math.max(0, Math.min(1, k));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * kk)).join(',')})`;
}

// Set an attribute only when it changes (keeps style recalcs down).
export function attr(el, name, value) {
  if (!el) return;
  const s = typeof value === 'number' ? (Math.round(value * 100) / 100).toString() : value;
  if (el.__a?.[name] === s) return;
  (el.__a ||= {})[name] = s;
  el.setAttribute(name, s);
}
export function text(el, s) {
  if (el && el.__t !== s) { el.__t = s; el.textContent = s; }
}
