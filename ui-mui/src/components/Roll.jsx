import { useEffect, useRef } from 'react';
import { EASE_OUT, DUR } from '../theme.js';

// ease-out cubic-bezier(0.23, 1, 0.32, 1), solved for y at a given x (emil-design-eng's strong ease-out).
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const dx = X(t) - x, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= dx / d; }
    return Y(Math.min(1, Math.max(0, t)));
  };
}
const ease = bezier(...EASE_OUT.match(/[\d.]+/g).map(Number));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that rolls to its new value in 250 ms instead of blinking (PLAN 5d step 6).
 * Writes to the DOM directly so a roll doesn't re-render React. Reduced motion: the value just changes.
 */
export default function Roll({ value, decimals = 1, suffix = '' }) {
  const el = useRef(null);
  const shown = useRef(value);
  useEffect(() => {
    const node = el.current;
    const fmt = (v) => (v == null ? '-' : v.toFixed(decimals)) + (v == null ? '' : suffix);
    const from = shown.current;
    if (from == null || value == null || reduced() || from === value) {
      shown.current = value; node.textContent = fmt(value); return undefined;
    }
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / DUR.number);
      const v = from + (value - from) * ease(k);
      shown.current = v;
      node.textContent = fmt(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, suffix]);
  return <span ref={el}>{value == null ? '-' : value.toFixed(decimals) + suffix}</span>;
}
