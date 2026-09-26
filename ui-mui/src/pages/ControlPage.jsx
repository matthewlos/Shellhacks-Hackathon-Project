import { useEffect, useRef, useState } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LocalDrinkOutlinedIcon from '@mui/icons-material/LocalDrinkOutlined';
import { CFG } from '../sim.js';
import { makeTime } from '../format.js';
import { pumpClock, currentAlert } from '../live.js';
import { drawAB } from '../chartAB.js';
import Roll from '../components/Roll.jsx';
import AlertOverlay from '../components/AlertOverlay.jsx';

/*
 * Control (PLAN 5e): box A (Farm Hand) vs box B (the chip's plain timer), same soil, same room.
 * No estimates and no virtual timer here: box B is a second simulated box with its own pours.
 * Every number is simulated like the rest of the page (the "Simulated board" chip stays in the header).
 */

const hrs = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

function boxStats(fh, pot) {
  const pours = fh.pours.filter((p) => p.pot === pot);
  const ml = pours.reduce((s, p) => s + (p.ran_ms / 1000) * CFG.FLOW_ML_S, 0);
  return { ml, drinks: pours.length };
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

// The headline is computed from the numbers, never typed (PLAN 5e).
function headline(fh, A, B, T) {
  // Always "X used Nx the water of Y", so the reference box is named. Under 24 h the claim is sized to the evidence.
  const early = fh.t < 24 * 3600;
  let first;
  if (!A.ml && !B.ml) first = 'Neither box has been watered yet.';
  else if (!A.ml) first = `Box B used ${Math.round(B.ml)} ml. Box A hasn't needed water yet.`;
  else if (!B.ml) first = `Box A used ${Math.round(A.ml)} ml. Box B's timer hasn't poured yet.`;
  else if (B.ml >= A.ml) first = `Box B used ${(B.ml / A.ml).toFixed(1)}x the water of box A.`;
  else first = `Box A used ${(A.ml / B.ml).toFixed(1)}x the water of box B.`;
  if (early && (A.ml || B.ml)) first = 'So far: ' + first[0].toLowerCase() + first.slice(1);
  const parts = [];
  const allIn = T.aInPct != null && T.aInPct >= 99.95 && T.bInPct >= 99.95 && !T.aUnder && !T.bWet;
  if (allIn) parts.push('Both stayed in the healthy band the whole time.');
  else {
    if (T.aInPct != null) parts.push(`Box A stayed in the band ${T.aInPct.toFixed(0)}% of the time, box B ${T.bInPct.toFixed(0)}%.`);
    parts.push(T.aUnder ? `Box A spent ${hrs(T.aUnder)} under the baseline.` : 'Box A never went under the baseline.');
    parts.push(T.bWet ? `Box B spent ${hrs(T.bWet)} soggy, above the wet limit.` : 'Box B never went above the wet limit.');
  }
  return { first, rest: parts.join(' '), early };
}

function BoxPanel({ fh, act, frac, pot }) {
  const isA = pot === 'A';
  const L = fh.latest;
  const pct = L ? (isA ? L.a_pct : L.b_pct) : null;
  const st = boxStats(fh, pot);
  const pc = pumpClock(fh, frac(), pot);
  const accent = isA ? 'moisture.main' : 'timer.main';
  const accentText = isA ? 'moisture.main' : 'timer.text';
  return (
    <Paper variant="outlined" component="section" aria-labelledby={`box-${pot}`} sx={{ px: { xs: 2, lg: 3 }, py: 2.5, borderTop: 3, borderTopColor: accent }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h3" id={`box-${pot}`} sx={{ color: accentText }}>{isA ? 'Farm Hand, box A' : 'Timer, box B'}</Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: pc ? 600 : 400 }} color={pc ? accentText : 'text.secondary'}>
          {pc ? `Watering ${Math.ceil(pc.left)} s` : 'Pump off'}
        </Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">Soil moisture</Typography>
          <Typography variant="tier1" sx={{ whiteSpace: 'nowrap' }}><Roll value={pct} />{pct != null && <Box component="span" sx={{ fontSize: '0.45em', fontWeight: 500, color: 'text.secondary' }}>%</Box>}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">Soil temperature</Typography>
          {isA ? (
            <Typography variant="tier1" sx={{ color: 'temp.main', whiteSpace: 'nowrap' }}><Roll value={L ? L.temp_c : null} />{L && <Box component="span" sx={{ fontSize: '0.45em', fontWeight: 500, color: 'text.secondary' }}>{' '}°C</Box>}</Typography>
          ) : (
            <Typography variant="body2" sx={{ mt: 2 }}>No temp probe on box B. Same room as box A.</Typography>
          )}
        </Box>
      </Box>
      <Typography variant="subtitle1" sx={{ mt: 2 }}>
        {isA ? `Holding at least ${CFG.DRY_PCT}%` : `Every ${CFG.TIMER_EVERY_S / 3600} h, ${CFG.TIMER_POUR_MS / 1000} s, no matter what`}
      </Typography>
      <Stack direction="row" useFlexGap sx={{ mt: 1.5, gap: 3, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">Water used</Typography>
          <Typography variant="readout">{Math.round(st.ml).toLocaleString()}<Typography variant="unit" component="span">{' '}ml</Typography></Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">Drinks</Typography>
          <Typography variant="readout">{st.drinks}</Typography>
        </Box>
        <Button size="small" variant="outlined" color="inherit" startIcon={<LocalDrinkOutlinedIcon />} onClick={() => act((f) => f.demoHandPour(pot))} sx={{ ml: 'auto', borderColor: 'divider' }}>
          Pour a cup into box {pot}
        </Button>
      </Stack>
    </Paper>
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
      wetFill: alpha(P.timer.main, 0.08), surface: P.background.paper, cursor: P.cursor, font: theme.fonts.body,
    });
    setTip((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });
  const tipLeft = tip ? (tip.x + 12 + 160 > tip.W ? tip.x - 12 - 160 : tip.x + 12) : 0;
  const key = (sw, text) => (
    <Stack component="li" direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>{sw}<Typography variant="caption">{text}</Typography></Stack>
  );
  return (
    <Paper variant="outlined" component="section" aria-labelledby="ab-title" sx={{ px: { xs: 2, lg: 3 }, py: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h3" id="ab-title">Moisture over time</Typography>
        <ToggleButtonGroup size="small" exclusive value={win} onChange={(_, v) => v != null && setWin(v)} aria-label="Chart window">
          <ToggleButton value={1}>1 h</ToggleButton>
          <ToggleButton value={6}>6 h</ToggleButton>
          <ToggleButton value={24}>24 h</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Stack component="ul" direction="row" useFlexGap sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, listStyle: 'none', m: 0, mb: 1, p: 0 }} aria-label="Chart key">
        {key(<Box sx={{ width: 20, borderTop: '2px solid', borderColor: 'moisture.main' }} />, 'Box A, Farm Hand')}
        {key(<Box sx={{ width: 20, borderTop: '2px solid', borderColor: 'timer.main' }} />, 'Box B, timer')}
        {key(<Box sx={{ width: 20, borderTop: '1.5px dashed', borderColor: 'text.secondary' }} />, 'Baseline')}
        {key(<Box sx={(t) => ({ width: 14, height: 10, bgcolor: alpha(t.palette.timer.main, 0.12) })} />, 'Wet limit')}
        {key(<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'text.primary' }} />, 'Pour')}
      </Stack>
      <Box sx={{ position: 'relative' }}>
        <Box
          component="canvas"
          ref={cv}
          role="img"
          aria-label="Soil moisture of box A and box B over the run, with the baseline and the wet limit."
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
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Box sx={{ color: 'moisture.tip' }}>box A</Box><span>{tip.a == null ? '-' : tip.a.toFixed(1) + '%'}</span></Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Box sx={{ color: 'timer.tip' }}>box B</Box><span>{tip.b == null ? '-' : tip.b.toFixed(1) + '%'}</span></Stack>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default function ControlPage({ fh, act, frac }) {
  const A = boxStats(fh, 'A'), B = boxStats(fh, 'B');
  const T = timeOutside(fh);
  const h = headline(fh, A, B, T);
  const time = makeTime(fh);
  const alert = currentAlert(fh);
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <BoxPanel fh={fh} act={act} frac={frac} pot="A" />
        <BoxPanel fh={fh} act={act} frac={frac} pot="B" />
      </Box>
      <Paper variant="outlined" component="section" aria-label="What the two boxes show" sx={{ position: 'relative', px: { xs: 2, lg: 3 }, py: 2.5, minHeight: 120 }}>
        <AlertOverlay alert={alert} />
        <Box inert={alert ? '' : undefined} sx={(t) => ({ opacity: alert ? 0 : 1, transition: `opacity ${t.dur.panel}ms ${t.ease}` })}>
          <Typography variant="h2" component="p" sx={{ fontSize: { xs: '1.75rem', lg: '2rem' }, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">{h.first}</Typography>
          <Typography variant="body1" sx={{ mt: 1, maxWidth: '80ch', fontVariantNumeric: 'tabular-nums' }}>{h.rest}</Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {h.early ? `Early: only ${hrs(fh.t)} of data, since ${time.hhmm(0)} (simulated time).` : `Running ${hrs(fh.t)}, since ${time.hhmm(0)} (simulated time).`} Same soil, same room, same chip. Only the brain differs.
          </Typography>
        </Box>
      </Paper>
      <ABChart fh={fh} />
    </Stack>
  );
}
