import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CFG } from '../sim.js';
import { clamp } from '../format.js';
import { pumpClock, readingAge } from '../live.js';
import { useSim } from '../useFarmHand.js';
import Roll from './Roll.jsx';

/*
 * Tier 1 (PLAN 5d): moisture and temperature at the same size, both in ink. Each carries a short bar in its house
 * color (blue moisture, purple temperature), so the color still names the quantity without a 96px purple glyph
 * pulling the eye (visual audit F2). Moisture is the 6-reading median, the same "now" as the drawing, the brain
 * and the alerts. The pump state is a 24px status line under them.
 */
function Big({ label, value, unit, marker, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ width: 24, height: 3, bgcolor: marker, mb: 0.75 }} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="tier1" sx={{ mt: 0.5, whiteSpace: 'nowrap' }}>
        <Roll value={value} />
        {value != null && <Typography variant="unit" sx={{ ml: '0.06em' }}>{unit}</Typography>}
      </Typography>
      {children}
    </Box>
  );
}

export function pumpState(fh, frac) {
  const run = fh.run;
  const pc = pumpClock(fh, frac);
  const last = fh.decisions[fh.decisions.length - 1];
  if (pc) return { word: 'Watering', num: `${Math.ceil(pc.left)} s`, tone: 'moisture.main' };
  if (fh.tgt) return { word: 'Hitting', num: `${run.target}%`, tone: 'moisture.main' };
  if (last && last.brain === 'target run' && run.phase === 'locked') return { word: 'Locked at', num: `${run.now.toFixed(1)}%`, tone: 'success.text' };
  if (fh.live.phase === 'soaking' && fh.live.pot !== 'B') return { word: 'Soaking in', num: '', tone: 'text.primary' };
  if (!last) return { word: 'Starting up', num: '', tone: 'text.primary' };
  return { word: 'Holding off', num: '', tone: 'text.primary' };
}

export default function LiveNow({ fh, frac }) {
  useSim(4);
  const L = fh.latest;
  const pct = fh.nowPct();
  const age = readingAge(fh, frac());
  const ps = pumpState(fh, frac());
  return (
    <Box component="section" aria-label="Live readings">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: { xs: 2, sm: 3 } }}>
        <Big label="Soil moisture" value={pct} unit="%" marker="moisture.main">
          {/* The band (min to wet limit) with the minimum as a tick; the needle moves on transform, not `left`. */}
          <Box sx={{ position: 'relative', height: 8, bgcolor: 'track', borderRadius: '4px', mt: 1.5 }} aria-hidden="true">
            <Box sx={{ position: 'absolute', left: `${CFG.DRY_PCT}%`, width: `${CFG.WET_PCT - CFG.DRY_PCT}%`, top: 0, bottom: 0, bgcolor: 'success.light' }} />
            <Box sx={{ position: 'absolute', left: `${CFG.DRY_PCT}%`, top: -3, bottom: -3, width: '1px', bgcolor: 'text.secondary' }} />
            {pct != null && (
              <Box sx={(t) => ({
                position: 'absolute', inset: 0, transform: `translateX(${clamp(pct, 0, 100)}%)`, transition: `transform ${t.dur.number}ms ${t.ease}`,
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              })}>
                <Box sx={{ position: 'absolute', left: -1, top: -4, height: 16, width: 3, bgcolor: 'text.primary', borderRadius: '1px' }} />
              </Box>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>min {CFG.DRY_PCT}%, wet {CFG.WET_PCT}%</Typography>
        </Big>
        <Big label="Soil temperature" value={L ? L.temp_c : null} unit={' °C'} marker="temp.main" />
      </Box>

      <Stack direction="row" useFlexGap sx={{ mt: 2.5, alignItems: 'baseline', flexWrap: 'wrap', columnGap: 2, rowGap: 0.25 }}>
        <Typography variant="status" aria-live="polite" sx={{ color: ps.num ? 'text.primary' : ps.tone }}>
          {ps.word}{ps.num && <Box component="span" sx={{ color: ps.tone }}> {ps.num}</Box>}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {age == null ? 'No reading yet' : `Read ${age.toFixed(1)} s ago`}
        </Typography>
      </Stack>
    </Box>
  );
}
