import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { visuallyHidden } from '@mui/utils';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { CFG } from '../sim.js';
import { hrs, makeTime, ml } from '../format.js';
import { useSim } from '../useFarmHand.js';
import { pumpClock, currentAlert } from '../live.js';
import { drawAB } from '../chartAB.js';
import { grid12 } from '../components/Page.jsx';
import TextChoice from '../components/TextChoice.jsx';
import Roll from '../components/Roll.jsx';
import AlertOverlay from '../components/AlertOverlay.jsx';

/*
 * Vs timer (PLAN 5e, round 6 "the chart is the headline"): Farm Hand (box A) vs the chip's plain timer (box B),
 * same soil, same room. The computed sentence, then the chart large, then a small ledger that annotates it.
 * No estimates: box B is a second simulated box with its own pours (the header tag covers both).
 * Temperature is not on this page: it drives no decision here.
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

// The headline is computed from the numbers, never typed (PLAN 5e): time in band first, then the water ratio.
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
  if (T.bWet) parts.push(`Timer above full: ${hrs(T.bWet)}.`);
  return { first, rest: parts.join(' ') };
}

const WINDOWS = [{ value: 1, label: '1 h' }, { value: 6, label: '6 h' }, { value: 24, label: '24 h' }, { value: 'all', label: 'All' }];

function ABChart({ fh }) {
  const theme = useTheme();
  const P = theme.palette;
  const wide = useMediaQuery(theme.breakpoints.up('md'));
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
      a: P.moisture.main, b: P.timer.main, aText: P.moisture.main, bText: P.timer.text,
      band: P.chartBand, edge: P.range.edge, ink: P.text.primary, muted: P.text.secondary, grid: P.divider,
      surface: P.background.default, cursor: P.cursor, font: theme.fonts.body, padR: wide ? 128 : 96,
    });
    setTip((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });
  const tipLeft = tip ? (tip.x + 12 + 160 > tip.W ? tip.x - 12 - 160 : tip.x + 12) : 0;
  return (
    <Box component="section" aria-labelledby="ab-title" sx={{ gridColumn: '1 / -1', mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', columnGap: 2, rowGap: 0.5, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="caption" component="h3" id="ab-title" color="text.secondary">Soil moisture, %</Typography>
        <TextChoice label="Chart window" hideLabel value={win} onChange={setWin} options={WINDOWS} />
      </Box>
      <Box sx={{ position: 'relative' }}>
        <Box
          component="canvas"
          ref={cv}
          role="img"
          aria-label={`Soil moisture over time. Farm Hand ${fh.nowPct()?.toFixed(1) ?? '-'}%, timer ${fh.nowPctB()?.toFixed(1) ?? '-'}%, against the minimum of ${CFG.DRY_PCT}% and full at ${CFG.WET_PCT}%.`}
          onMouseMove={(e) => setHoverX(e.nativeEvent.offsetX)}
          onMouseLeave={() => setHoverX(null)}
          sx={{ display: 'block', width: '100%', height: { xs: 240, md: 'clamp(280px, 44vh, 520px)' } }}
        />
        {tip && (
          <Box aria-hidden="true" sx={{
            position: 'absolute', top: 0, left: tipLeft, width: 160, pointerEvents: 'none', bgcolor: 'text.primary', color: 'common.white',
            p: 1, borderRadius: theme.radius.control, typography: 'caption', fontVariantNumeric: 'tabular-nums',
            animation: `fh-tip ${theme.dur.tip}ms ${theme.ease}`, '@keyframes fh-tip': { from: { opacity: 0 } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}>
            <Box sx={{ fontWeight: 600 }}>{tip.time}</Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Box sx={{ color: 'moisture.tip' }}>Farm Hand</Box><span>{tip.a == null ? '-' : tip.a.toFixed(1) + '%'}</span></Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Box sx={{ color: 'timer.tip' }}>Timer</Box><span>{tip.b == null ? '-' : tip.b.toFixed(1) + '%'}</span></Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// The ledger: two columns of figures that annotate the chart. Lab-table look from the theme (section 5).
function Ledger({ fh, act, frac, A, B, T }) {
  const cols = [
    { pot: 'A', name: 'Farm Hand', sw: 'moisture.main', text: 'moisture.main', st: A, inPct: T.aInPct,
      rule: `Waters near ${CFG.DRY_PCT + CFG.LOW_MARGIN}%, never below ${CFG.DRY_PCT}%` },
    { pot: 'B', name: 'Timer', sw: 'timer.main', text: 'timer.text', st: B, inPct: T.bInPct,
      rule: `${CFG.TIMER_POUR_MS / 1000} s every ${CFG.TIMER_EVERY_S / 3600} h, no matter what` },
  ];
  const fig = { typography: 'data', textAlign: 'right' };
  const label = { typography: 'body2', color: 'text.secondary', pr: 2, verticalAlign: 'top' };
  const row = (name, cell) => (
    <TableRow>
      <TableCell component="th" scope="row" sx={label}>{name}</TableCell>
      {cols.map((c) => <TableCell key={c.pot} sx={fig}>{cell(c)}</TableCell>)}
    </TableRow>
  );
  return (
    <Box component="section" aria-label="Ledger" sx={{ gridColumn: { xs: '1 / -1', md: '1 / span 8' }, mt: 6, maxWidth: 720 }}>
      <Table size="small" sx={{ tableLayout: 'fixed', '& td, & th': { px: 0 }, '& td': { pl: 2 }, '& col.lab': { width: { xs: 88, sm: 160 } } }}>
        <colgroup><col className="lab" /><col /><col /></colgroup>
        <TableHead>
          <TableRow>
            <TableCell><Box component="span" sx={visuallyHidden}>Metric</Box></TableCell>
            {cols.map((c) => {
              const pc = pumpClock(fh, frac(), c.pot);
              return (
                <TableCell key={c.pot} sx={{ textAlign: 'right', verticalAlign: 'bottom', pl: 2 }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" component="span" color="text.primary">{c.name}</Typography>
                    <Box aria-hidden="true" sx={{ width: 16, height: 2, bgcolor: c.sw, flex: 'none' }} />
                  </Box>
                  <Typography variant="caption" component="div" sx={{ color: c.text, fontWeight: 600, minHeight: 16, fontVariantNumeric: 'tabular-nums' }}>
                    {pc ? `Watering ${Math.ceil(pc.left)} s` : ''}
                  </Typography>
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {row('Rule', (c) => <Box component="span" sx={{ typography: 'body2' }}>{c.rule}</Box>)}
          {row('Water used', (c) => <><Roll value={Math.round(c.st.ml)} decimals={0} /> ml</>)}
          {row('Pours', (c) => c.st.pours)}
          {row('In band', (c) => (c.inPct == null ? '-' : `${bandPct(c.inPct)}%`))}
          <TableRow>
            <TableCell><Box component="span" sx={visuallyHidden}>Add water</Box></TableCell>
            {cols.map((c) => (
              <TableCell key={c.pot} sx={{ textAlign: 'right', pt: 1.5 }}>
                <Button variant="outlined" size="small" onClick={() => act((f) => f.demoHandPour(c.pot))}
                  aria-label={`Hand pour into the ${c.pot === 'A' ? 'Farm Hand' : 'timer'} box`}>
                  Hand pour
                </Button>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
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
    <Box sx={{ ...grid12, rowGap: 0, alignItems: 'start' }}>
      <Box component="section" aria-labelledby="vs-title" sx={{ gridColumn: { xs: '1 / -1', md: '1 / span 8' }, position: 'relative', minHeight: { md: 96 } }}>
        <Typography component="h2" id="vs-title" sx={visuallyHidden}>Farm Hand vs timer</Typography>
        <AlertOverlay alert={alert} />
        <Box inert={alert ? true : undefined} sx={(t) => ({ opacity: alert ? 0 : 1, transition: `opacity ${t.dur.panel}ms ${t.ease}` })}>
          <Typography variant="headline" aria-live="polite">{h.first}</Typography>
          <Typography variant="body1" sx={{ mt: 1, maxWidth: '60ch', fontVariantNumeric: 'tabular-nums' }}>{h.rest}</Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{
        gridColumn: { xs: '1 / -1', md: '9 / -1' }, textAlign: { md: 'right' }, mt: { xs: 1, md: 0.75 }, maxWidth: { xs: '60ch', md: 'none' },
      }}>
        {fh.t < 60 ? `Started ${time.hhmm(0)}` : `${hrs(fh.t)} of data since ${time.hhmm(0)}`}. Same soil, same room.
      </Typography>
      <ABChart fh={fh} />
      <Ledger fh={fh} act={act} frac={frac} A={A} B={B} T={T} />
    </Box>
  );
}
