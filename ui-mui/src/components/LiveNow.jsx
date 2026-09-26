import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CFG } from '../sim.js';
import { clamp } from '../format.js';
import { pumpClock, readingAge } from '../live.js';
import Roll from './Roll.jsx';

// Tier 1 (PLAN 5d): moisture and temperature the same size and the biggest thing on the page,
// the pump state big next to them, and a ticking "last reading" that proves the numbers are live.

function Big({ label, value, unit, color, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="tier1" sx={{ color, mt: 0.5, whiteSpace: 'nowrap' }}>
        <Roll value={value} />
        {value != null && <Box component="span" sx={{ fontSize: '0.45em', fontWeight: 500, color: 'text.secondary', ml: '0.08em' }}>{unit}</Box>}
      </Typography>
      {children}
    </Box>
  );
}

export function pumpState(fh, frac) {
  const run = fh.run;
  const pc = pumpClock(fh, frac);
  const last = fh.decisions[fh.decisions.length - 1];
  if (pc) return { word: 'Watering', num: `${Math.ceil(pc.left)} s`, tone: 'moisture.main', live: true };
  if (fh.tgt) return { word: 'Hitting', num: `${run.target}%`, tone: 'moisture.main' };
  if (last && last.brain === 'target run' && run.phase === 'locked') return { word: 'Locked at', num: `${run.now.toFixed(1)}%`, tone: 'success.text' };
  if (fh.live.phase === 'soaking' && fh.live.pot !== 'B') return { word: 'Soaking in', num: '', tone: 'text.primary' };
  if (!last) return { word: 'Waiting for the first check', num: '', tone: 'text.primary' };
  return { word: 'Holding off', num: '', tone: 'text.primary' };
}

export default function LiveNow({ fh, frac }) {
  const L = fh.latest;
  const pct = L ? L.a_pct : null;
  const age = readingAge(fh, frac());
  const ps = pumpState(fh, frac());
  return (
    <Box component="section" aria-label="Live readings">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: { xs: 2, sm: 3 } }}>
        <Big label="Soil moisture" value={pct} unit="%" color="text.primary">
          <Box sx={{ position: 'relative', height: 8, bgcolor: 'track', borderRadius: 1, mt: 1.5 }} aria-hidden="true">
            <Box sx={{ position: 'absolute', left: `${CFG.DRY_PCT}%`, width: `${CFG.WET_PCT - CFG.DRY_PCT}%`, top: 0, bottom: 0, bgcolor: 'success.light', borderRadius: 1 }} />
            {/* the baseline: a 1px muted tick at the level box A keeps */}
            <Box sx={{ position: 'absolute', left: `${CFG.DRY_PCT}%`, top: -3, bottom: -3, width: '1px', bgcolor: 'text.secondary' }} />
            {pct != null && (
              <Box sx={(t) => ({
                position: 'absolute', top: -4, height: 16, width: 3, bgcolor: 'text.primary', borderRadius: 1,
                left: `calc(${clamp(pct, 0, 100)}% - 1px)`, transition: `left ${t.dur.number}ms ${t.ease}`,
              })} />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>keeping at least {CFG.DRY_PCT}%, wet above {CFG.WET_PCT}%</Typography>
        </Big>
        <Big label="Soil temperature" value={L ? L.temp_c : null} unit={'\u2009°C'} color="temp.main">
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2.5 }}>DS18B20 in the soil</Typography>
        </Big>
      </Box>

      <Stack sx={{ mt: 2, rowGap: 0.5 }}>
        <Typography variant="h2" component="p" aria-live="polite" sx={{ color: ps.num ? 'text.primary' : ps.tone, fontSize: { xs: '2rem', lg: '2.5rem' }, lineHeight: 1.1 }}>
          {ps.word}{ps.num && <Box component="span" sx={{ color: ps.tone, fontVariantNumeric: 'tabular-nums' }}> {ps.num}</Box>}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {age == null ? 'No reading yet' : `Last reading ${age.toFixed(1)} s ago`}, simulated board
        </Typography>
      </Stack>
    </Box>
  );
}
