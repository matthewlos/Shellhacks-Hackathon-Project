import { useLayoutEffect, useRef, useState } from 'react';
import { Spring, RESPONSE, onFrame, text } from '../motion.js';

/**
 * A number that glides to each new value instead of blinking (PLAN 5d step 6, motion.md P2.3).
 * A critically damped spring (0.35 s response) carries its speed across new values, so a reading that lands
 * mid-roll bends the motion instead of restarting it. It writes textContent directly: no React render per frame.
 * The span's children are rendered once and never from `value` again, so the final number can't flash for a
 * frame before the roll starts. Reduced motion: the value is written straight away.
 */
export default function Roll({ value, decimals = 1, suffix = '' }) {
  const el = useRef(null);
  // toLocaleString: 1,500 not 1500. The span inherits the parent's type (tier1, readout).
  const fmt = (v) => (v == null ? '-' : v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
  const [first] = useState(() => fmt(value));
  const st = useRef(null);
  st.current ||= { spring: new Spring(value ?? 0, RESPONSE.number), stop: null };

  useLayoutEffect(() => {
    const s = st.current, node = el.current;
    const stop = () => { s.stop?.(); s.stop = null; };
    if (value == null) { stop(); s.spring.primed = false; text(node, fmt(null)); return; }
    s.spring.set(value);
    const draw = () => text(node, fmt(Math.abs(s.spring.x - s.spring.target) < 0.5 * 10 ** -decimals ? s.spring.target : s.spring.x));
    if (s.spring.settled) { stop(); draw(); return; }
    s.stop ||= onFrame((now, dt) => {
      s.spring.step(dt);
      draw();
      if (s.spring.settled) stop();
    });
  }, [value, decimals, suffix]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => () => { const s = st.current; s?.stop?.(); if (s) s.stop = null; }, []);
  return <span ref={el}>{first}</span>;
}
