import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { CFG } from '../sim.js';
import { makeTime } from '../format.js';
import { pumpState } from '../live.js';
import { sim, useSim } from '../useFarmHand.js';
import Roll from './Roll.jsx';
import Bullet from './Bullet.jsx';

/*
 * The rail's readings (spec 9.L.2): moisture over temperature, both tier 1 in ink, stacked so they can never
 * collide at any width (B1). Moisture is the 6-reading median, the same "now" as the drawing, the brain and the
 * alerts. Under them, the status word and the reading dot (B9). Phone: the two numbers side by side, the bullet
 * under both.
 */
function Reading({ area, label, value, unit, sx }) {
  return (
    <Box sx={{ gridArea: area, minWidth: 0, ...sx }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
      <Typography variant="tier1" sx={{ whiteSpace: 'nowrap' }}>
        <Roll value={value} />
        {value != null && <Typography variant="unit">{unit}</Typography>}
      </Typography>
    </Box>
  );
}

// The target tick shows during a run and for 20 real seconds after it ends (the same window as the drawing).
function useTargetShown(fh) {
  const st = useRef({ end: fh.run.t_end, real: -1e9 });
  if (fh.run.t_end !== st.current.end) st.current = { end: fh.run.t_end, real: performance.now() };
  const tgt = fh.run.target;
  if (tgt == null) return null;
  const recent = fh.run.phase !== 'idle' && performance.now() - st.current.real < 20000;
  return fh.tgt || recent ? tgt : null;
}

// A 6px dot that flashes once per new reading, at most once per 800 ms real time. Hollow while paused.
function ReadingDot({ ts }) {
  const el = useRef(null);
  const last = useRef({ ts, at: 0 });
  useEffect(() => {
    const node = el.current;
    if (!node || ts == null || ts === last.current.ts) return;
    last.current.ts = ts;
    const now = performance.now();
    if (now - last.current.at < 800) return;
    last.current.at = now;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    node.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 600, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', });
  }, [ts]);
  const paused = sim.paused;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {paused && <Typography variant="caption" color="text.secondary">Paused</Typography>}
      <Box
        ref={el}
        aria-hidden="true"
        sx={{
          width: 6, height: 6, borderRadius: '50%', flex: 'none',
          bgcolor: paused ? 'transparent' : 'text.primary',
          boxShadow: paused ? 'inset 0 0 0 1.5px currentColor' : 'none',
          color: 'text.primary',
          opacity: paused ? 1 : 0.25,
          '@media (prefers-reduced-motion: reduce)': { opacity: 1 },
        }}
      />
      <Box component="span" sx={visuallyHidden} aria-live="off">New reading every second</Box>
    </Box>
  );
}

export default function LiveNow({ fh, frac }) {
  useSim(4);
  const L = fh.latest;
  const pct = fh.nowPct();
  const T = makeTime(fh);
  const ps = pumpState(fh, frac(), T.hhmm);
  const target = useTargetShown(fh);
  return (
    <Box component="section" aria-label="Readings">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: '1fr' },
          gridTemplateAreas: { xs: '"m t" "b b"', md: '"m" "b" "t"' },
          columnGap: 2,
        }}
      >
        <Reading area="m" label="Soil moisture" value={pct} unit="%" />
        <Bullet
          value={pct}
          min={CFG.DRY_PCT}
          full={CFG.WET_PCT}
          target={target}
          sx={{ gridArea: 'b', mt: 1.5 }}
        />
        <Reading area="t" label="Soil temperature" value={L ? L.temp_c : null} unit={' °C'} sx={{ mt: { xs: 0, md: 4 } }} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', columnGap: 2, mt: { xs: 2, md: 4 } }}>
        <Typography variant="status" aria-live="polite" sx={{ color: ps.tone }}>
          {ps.word}
          {ps.num && <>{' '}<Box component="span" sx={{ display: 'inline-block', minWidth: '5ch' }}>{ps.num}</Box></>}
        </Typography>
        <ReadingDot ts={L ? L.ts : null} />
      </Box>
    </Box>
  );
}
