import { useCallback, useEffect, useRef, useState } from 'react';
import { FarmHand } from './sim.js';

// One sim for the page. window.farmHand is the live sim in the console, as in ui/.
const fh = new FarmHand();
window.farmHand = fh;

/*
 * Runs the sim at `speed` simulated seconds per real second (one fh.step() per simulated second,
 * like the chip's one reading a second) and re-renders React about 10 times a second, so the
 * "last reading" age and the pump countdown tick smoothly. `frac()` is how far (0..1) the sim is
 * into its next second: ages and countdowns are in simulated time, so they stay honest at any speed.
 * Components read the FarmHand object directly; `act` wraps a button action and forces a re-render.
 */
export function useFarmHand() {
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);
  const run = useRef({ speed, paused });
  run.current = { speed, paused };
  const acc = useRef(0);

  useEffect(() => {
    let last = performance.now(), lastPaint = 0, raf;
    const frame = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!run.current.paused) {
        acc.current += dt * run.current.speed;
        let n = Math.floor(acc.current);
        acc.current -= n;
        while (n-- > 0) fh.step();
      }
      if (now - lastPaint > 95) {
        lastPaint = now;
        setTick((x) => x + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const act = useCallback((fn) => {
    const r = fn(fh);
    setTick((x) => x + 1);
    return r;
  }, []);
  const frac = useCallback(() => acc.current, []);

  return { fh, speed, setSpeed, paused, setPaused, act, frac };
}
