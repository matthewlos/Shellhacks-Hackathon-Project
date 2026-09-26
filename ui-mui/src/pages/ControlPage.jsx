import { useEffect, useRef, useState } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { CFG } from '../sim.js';
import { hrs, makeTime, ml } from '../format.js';
import { useSim } from '../useFarmHand.js';
import { pumpClock, currentAlert } from '../live.js';
import { drawAB } from '../chartAB.js';
import Roll from '../components/Roll.jsx';
import AlertOverlay from '../components/AlertOverlay.jsx';

/*
 * Vs timer (PLAN 5e): Farm Hand (box A) vs the chip's plain timer (box B), same soil, same room.
 * The computed headline is the page's one focal point, on top. No estimates and no virtual timer:
 * box B is a second simulated box with its own pours (the "Simulated board" chip in the header covers both).
 */

function boxStats(fh, pot) {
  const pours = fh.pours.filter((p) => p.pot === pot);
  const water = pours.reduce((s, p) => s + (p.ran_ms / 1000) * CFG.FLOW_ML_S, 0);
  return { ml: water, pours: pours.length };
}

// Seconds each box spent outside its limits, from the reading history (1 row per simulated second).
function timeOutside(fh) {
  const h = fh.history;
  let aUnder = 0, bWet = 0, aIn = 0, bIn = 0, n = 0;
  for (let i = 1; i < h.length; i++) {
    const dt = h[i].t - h[i - 1].t, r = h[i];
    if (r.a != null) { if (r.a < CFG.DRY_PCT) aUnder += dt; if (r.a >= CFG.DRY_PCT && r.a <= CFG.WET_PCT) aIn += dt; }
    if (r.b != null) { if (r.b > CFG.WET_PCT) bWet += dt; if (r.b >= CFG.DRY_PCT && r.b <= CFG.WET_PCT) bIn += dt; }
    n += dt;
  }
  return { aUnder, bWet, aInPct: n ? (100 * aIn) / n : null, bInPct: n ? (100 * bIn) / n : null };
}

// Compare only with enough evidence: 2 pours in each box, or 24 h of simulated time (copy audit call a).
const MIN_POURS = 2, MIN_S = 24 * 3600;

// The headline is computed from the numbers, never typed (PLAN 5e).
// Owner decision (round 4): lead with how each box did at its job, time in the band from fh.report();
// the water ratio stays as the second line, whichever way it goes.
const bandPct = (v) => (v >= 99.95 ? '100' : String(Math.min(99, Math.round(v))));
function headline(fh, A, B, T) {
  const enough = fh.t >= MIN_S || (A.pours >= MIN_POURS && B.pours >= MIN_POURS);
  const p = (n) => `${n} ${n === 1 ? 'pour' : 'pours'}`;
  if (!enough) {
    return { first: 'Too early to compare.', rest: `Farm Hand ${p(A.pours)}, timer ${p(B.pours)}. The comparison shows after ${MIN_POURS} pours each or 24 h.` };
  }
  const rep = fh.report();
  const a = rep.ai_pot_time_healthy_pct, b = rep.timer_pot_time_healthy_pct;
  let first;
  if (a == null || b == null) first = 'No readings yet.';
  else if (a >= 99.95 && b >= 99.95) first = 'Both boxes stayed in band the whole time.';
  else first = `Farm Hand stayed in band ${bandPct(a)}% of the time. The timer, ${bandPct(b)}%.`;
  const soFar = fh.t < MIN_S ? ', so far' : '';
  const parts = [];
  if (!A.ml && !B.ml) parts.push('No pours yet.');
  else if (!A.ml) parts.push(`Timer: ${ml(B.ml)}. Farm Hand: none needed yet.`);
  else if (!B.ml) parts.push(`Farm Hand: ${ml(A.ml)}. Timer: no pour yet.`);
  else if (B.ml >= A.ml) parts.push(`The timer used ${(B.ml / A.ml).toFixed(1)}x the water${soFar}.`);
  else parts.push(`Farm Hand used ${(A.ml / B.ml).toFixed(1)}x the water${soFar}.`);
  if (T.aUnder) parts.push(`Farm Hand below minimum: ${hrs(T.aUnder)}.`);
  if (T.bWet) parts.push(`Timer too wet: ${hrs(T.bWet)}.`);
  return { first, rest: parts.join(' ') };
}

function Reading({ label, marker, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ width: 24, height: 3, bgcolor: marker, mb: 0.75 }} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {children}
    </Box>
  );
}

function BoxPanel({ fh, act, frac, pot }) {
  const isA = pot === 'A';
  const L = fh.latest;
  const pct = isA ? fh.nowPct() : fh.nowPctB();
  const st = boxStats(fh, pot);
  const pc = pumpClock(fh, frac(), pot);
  const accentText = isA ? 'moisture.main' : 'timer.text';
  const unit = { fontSize: '0.5em', fontWeight: 400, color: 'text.secondary' };
  return (
    <Box component="section" aria-labelledby={`box-${pot}`} sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h3" component="h2" id={`box-${pot}`} sx={{ color: accentText }}>{isA ? 'Farm Hand' : 'Timer'}</Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: pc ? 600 : 400 }} color={pc ? accentText : 'text.secondary'}>
          {pc ? `Watering ${Math.ceil(pc.left)} s` : 'Pump off'}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ mt: 0.25 }}>
        {isA ? `Keeps soil above ${CFG.DRY_PCT}%` : `${CFG.TIMER_POUR_MS / 1000} s every ${CFG.TIMER_EVERY_S / 3600} h, no matter what`}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
        <Reading label="Soil moisture" marker={isA ? 'moisture.main' : 'timer.main'}>
          <Typography variant="readoutXL" sx={{ whiteSpace: 'nowrap' }}><Roll value={pct} />{pct != null && <Box component="span" sx={unit}>%</Box>}</Typography>
        </Reading>
        <Reading label="Soil temperature" marker="temp.main">
          {isA
            ? <Typography variant="readoutXL" sx={{ whiteSpace: 'nowrap' }}><Roll value={L ? L.temp_c : null} />{L && <Box component="span" sx={unit}>{'\u2009'}°C</Box>}</Typography>
            : <Typography variant="body2" sx={{ mt: 1.5 }}>No temp probe</Typography>}
        </Reading>
      </Box>
      <Stack direction="row" useFlexGap sx={{ mt: 2, columnGap: 4, rowGap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">Water used</Typography>
          <Typography variant="readout"><Roll value={Math.round(st.ml)} decimals={0} /><Box component="span" sx={unit}> ml</Box></Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">Pours</Typography>
          <Typography variant="readout">{st.pours}</Typography>
        </Box>
        <Button variant="text" color="inherit" onClick={() => act((f) => f.demoHandPour(pot))} sx={{ ml: 'auto', mr: -1 }} aria-label={`Hand pour into the ${isA ? 'Farm Hand' : 'timer'} box`}>
          Hand pour
        </Button>
      </Stack>
    </Box>
  );
}

function ABChart({ fh }) {
  const theme = useTheme();
  const P = theme.palette;
  const cv = useRef(null);
  const [win, setWin] = useState('all');
  const [hoverX, setHoverX] = useState(null);
  const [tip, setTip] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [, setSize] = useState(0);
  const T = makeTime(fh);
  useEffect(() => { document.fonts.ready.then(() => setFontsReady(true)); }, []);
  useEffect(() => {
    const ro = new ResizeObserver(() => setSize((n) => n + 1));
    ro.observe(cv.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!fontsReady) return;
    const next = drawAB(cv.current, fh, win, hoverX, T.hhmm, {
      a: P.moisture.main, b: P.timer.main, muted: P.text.secondary, grid: P.divider, baseline: P.text.secondary,
      wetFill: alpha(P.text.primary, 0.05), surface: P.background.paper, cursor: P.cursor, font: theme.fonts.body,
    });
    setTip((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });
  const tipLeft = tip ? (tip.x + 12 + 160 > tip.W ? tip.x - 12 - 160 : tip.x + 12) : 0;
  const key = (sw, text) => (
    <Stack component="li" direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>{sw}<Typography variant="caption">{text}</Typography></Stack>
  );
  return (
    <Box component="section" aria-labelledby="ab-title">
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h3" component="h2" id="ab-title">Soil moisture</Typography>
        <ToggleButtonGroup size="small" exclusive value={win} onChange={(_, v) => v != null && setWin(v)} aria-label="Chart window">
          <ToggleButton value={1}>1 h</ToggleButton>
          <ToggleButton value={6}>6 h</ToggleButton>
          <ToggleButton value={24}>24 h</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Stack component="ul" direction="row" useFlexGap sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, listStyle: 'none', m: 0, mb: 1, p: 0 }} aria-label="Chart key">
        {key(<Box sx={{ width: 20, borderTop: '2px solid', borderColor: 'moisture.main' }} />, 'Farm Hand')}
        {key(<Box sx={{ width: 20, borderTop: '2px solid', borderColor: 'timer.main' }} />, 'Timer')}
        {key(<Box sx={{ width: 20, borderTop: '1.5px dashed', borderColor: 'text.secondary' }} />, 'Minimum')}
        {key(<Box sx={(t) => ({ width: 14, height: 10, bgcolor: alpha(t.palette.text.primary, 0.08) })} />, 'Wet limit')}
        {key(<Stack direction="row" spacing={0.5}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'moisture.main' }} /><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'timer.main' }} /></Stack>, 'Pour')}
      </Stack>
      <Box sx={{ position: 'relative' }}>
        <Box
          component="canvas"
          ref={cv}
          role="img"
          aria-label="Soil moisture, Farm Hand vs timer, with the minimum and the wet limit."
          onMouseMove={(e) => setHoverX(e.nativeEvent.offsetX)}
          onMouseLeave={() => setHoverX(null)}
          sx={{ display: 'block', width: '100%', height: { xs: 220, md: 280 } }}
        />
        {tip && (
          <Box aria-hidden="true" sx={{
            position: 'absolute', top: 0, left: tipLeft, width: 160, pointerEvents: 'none', bgcolor: 'text.primary', color: 'common.white',
            p: 1, borderRadius: 1, typography: 'caption', fontVariantNumeric: 'tabular-nums',
            animation: `fh-tip ${theme.dur.tip}ms ${theme.ease}`, '@keyframes fh-tip': { from: { opacity: 0 } },
          }}>
            <Box sx={{ fontWeight: 600 }}>{tip.time}</Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Box sx={{ color: 'moisture.tip' }}>Farm Hand</Box><span>{tip.a == null ? '-' : tip.a.toFixed(1) + '%'}</span></Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Box sx={{ color: 'timer.tip' }}>Timer</Box><span>{tip.b == null ? '-' : tip.b.toFixed(1) + '%'}</span></Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function ControlPage({ fh, act, frac }) {
  useSim(2);
  const A = boxStats(fh, 'A'), B = boxStats(fh, 'B');
  const T = timeOutside(fh);
  const h = headline(fh, A, B, T);
  const time = makeTime(fh);
  const alert = currentAlert(fh);
  return (
    <Stack spacing={4}>
      <Box component="section" aria-label="Result" sx={{ position: 'relative', minHeight: 120 }}>
        <AlertOverlay alert={alert} />
        <Box inert={alert ? true : undefined} sx={(t) => ({ opacity: alert ? 0 : 1, transition: `opacity ${t.dur.panel}ms ${t.ease}` })}>
          <Typography variant="readoutXL" sx={{ fontSize: { xs: '1.5rem', md: '2.5rem' }, lineHeight: 1.2, maxWidth: '32ch' }} aria-live="polite">{h.first}</Typography>
          <Typography variant="body1" sx={{ mt: 1, maxWidth: '70ch', fontVariantNumeric: 'tabular-nums' }}>{h.rest}</Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {fh.t < 60 ? `Started ${time.hhmm(0)}` : `${hrs(fh.t)} of data since ${time.hhmm(0)}`}. Same soil, same room.
          </Typography>
        </Box>
      </Box>
      <Box sx={{
        display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, rowGap: 3, columnGap: 4, borderTop: 1, borderColor: 'divider', pt: 3,
        '& > :last-child': { borderLeft: { md: 1 }, borderTop: { xs: 1, md: 0 }, borderColor: { xs: 'divider', md: 'divider' }, pl: { md: 4 }, pt: { xs: 3, md: 0 } },
      }}>
        <BoxPanel fh={fh} act={act} frac={frac} pot="A" />
        <BoxPanel fh={fh} act={act} frac={frac} pot="B" />
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
        <ABChart fh={fh} />
      </Box>
    </Stack>
  );
}
