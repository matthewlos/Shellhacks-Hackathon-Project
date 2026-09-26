import { useEffect, useId, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import StopIcon from '@mui/icons-material/Stop';
import { CFG } from '../sim.js';
import { clamp, f1, secs } from '../format.js';
import { currentAlert } from '../live.js';
import { useSim } from '../useFarmHand.js';
import BaselineSlider from './BaselineSlider.jsx';
import Notice from './Notice.jsx';

/*
 * The bench tray (spec 9.L.7): Target, the pour buttons and the minimum in one outlined strip, with one reserved
 * receipt line above it so nothing below or above ever moves (B4-B6). The receipt line shows, first match wins:
 *   1. this tray's latest refusal (cleared by the next tray action)
 *   2. target run progress
 *   3/4. the newer of: the run's receipt, or the minimum's answer (20 s)
 * Phone (< md): Test pour and the minimum sit in the page flow, and a sticky tray at the bottom holds the receipt,
 * the stepper, Go and Stop pump, so Stop pump is always in reach. The root is `display: contents` there, and
 * DemoPage orders the pieces (order 3 and 5).
 */
const ANSWER_MS = 20000;
const stripSafety = (m) => m.replace(/^Safety rules stopped it:\s*/, '');

function receipt(fh) {
  const run = fh.run;
  if (fh.tgt) {
    const P = fh.tgt.pulse;
    const n = run.pulses.length + 1;
    const now = fh.nowPct();
    const soil = now == null ? '' : ` Soil ${f1(now)}%.`;
    const pumping = fh.board.activePot === 'A' || run.phase === 'pulsing';
    return { text: pumping && P ? `Pulse ${n}: pumping ${P.secs} s.${soil}` : `Pulse ${n}: settling.${soil}` };
  }
  if (run.phase === 'idle') return null;
  const n = run.pulses.length;
  if (run.phase === 'blocked' && n === 0) return { text: `Blocked: ${stripSafety(run.msg)}` };
  const word = { locked: `Locked at ${run.now.toFixed(1)}%`, fault: 'Stopped', over: 'Overshot', short: 'Out of pulses', blocked: 'Blocked', stopped: 'Stopped' }[run.phase] || 'Stopped';
  // A pour that moved no water (fault, pinched tube, empty cup) is reported in pump seconds, never as ml delivered.
  const noWater = run.phase === 'fault' || fh.world.pinched || fh.world.cupMl <= 0;
  const pl = `${n} ${n === 1 ? 'pulse' : 'pulses'}`;
  let rest = noWater ? `${pl}, ${run.secs} s pumped, no water reached the soil.` : `${pl}, ${run.secs} s, ${run.ml} ml, ${secs(run.took_s)}.`;
  if (run.phase === 'over' || run.phase === 'blocked') rest += ` ${stripSafety(run.msg)}`;
  return { word, rest, strong: run.phase === 'locked' };
}

function Line({ r }) {
  if (!r) return null;
  if (r.text) return r.text;
  return <>{r.strong ? <Box component="span" sx={{ fontWeight: 600 }}>{r.word}.</Box> : `${r.word}.`} {r.rest}</>;
}

// One group: a 20px label row (may be empty, but holds its height) over a 40px controls row.
function Group({ label, labelId, children, sx }) {
  return (
    <Box role={labelId ? 'group' : undefined} aria-labelledby={labelId} sx={{ minWidth: 0, ...sx }}>
      <Typography variant="subtitle2" id={labelId} sx={{ height: 20, mb: 1 }}>{label || ''}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 40 }}>{children}</Box>
    </Box>
  );
}

export default function BenchStrip({ fh, act }) {
  useSim(4);
  const phone = useMediaQuery((t) => t.breakpoints.down('md'), { noSsr: true });
  const labelId = useId();
  const T_LO = CFG.DRY_PCT, T_HI = CFG.WET_PCT - CFG.BAND;
  const [tVal, setTVal] = useState(CFG.TARGET_PCT);
  const [refusal, setRefusal] = useState('');
  const [answer, setAnswer] = useState(null);   // { text, at, runEnd }
  const run = fh.run;
  const set = (v) => { setRefusal(''); setTVal(clamp(v, T_LO, T_HI)); };
  // The stepper shows the last run's target until someone changes it, so it agrees with the receipt and the drawing.
  useEffect(() => { if (run.target != null) setTVal(run.target); }, [run.t0]); // eslint-disable-line react-hooks/exhaustive-deps
  // The minimum can move under the stepper: keep the value inside the current range.
  useEffect(() => { setTVal((v) => clamp(v, T_LO, T_HI)); }, [T_LO, T_HI]);
  // The minimum's answer clears itself after 20 s real time (it is a receipt, not a warning).
  useEffect(() => {
    if (!answer) return undefined;
    const id = setTimeout(() => setAnswer(null), Math.max(0, answer.at + ANSWER_MS - performance.now()));
    return () => clearTimeout(id);
  }, [answer]);

  const alert = currentAlert(fh);
  const pumping = fh.board.activePot === 'A';
  const red = pumping && alert?.severity !== 'error';

  const onAnswer = (a) => {
    setRefusal('');
    const text = a?.error || a?.baseline == null
      ? "Couldn't change the minimum."
      : `Waters near ${a.baseline + CFG.LOW_MARGIN}%, never below ${a.baseline}%. Fills to ${a.target}%.`;
    setAnswer({ text, at: performance.now(), runEnd: fh.run.t_end });
  };
  const go = () => { const r = act((f) => f.startTarget(tVal)); setAnswer(null); setRefusal(r.ok ? '' : `Not now: ${r.why}.`); };
  const testPour = () => { const r = act((f) => f.testPour(5)); setAnswer(null); setRefusal(r.watered ? '' : `Not now: ${r.refused_because}.`); };
  const stop = () => { act((f) => f.stop()); setRefusal(''); };

  // Receipt slot content, first match wins; a fresh minimum answer beats an older run receipt.
  let slot = null;
  if (refusal) slot = { text: refusal };
  else if (fh.tgt) slot = receipt(fh);
  else if (answer && answer.runEnd === run.t_end) slot = { text: answer.text };
  else slot = receipt(fh);

  const stepper = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'wash', borderRadius: '4px' }}>
        <IconButton aria-label="Lower target" onClick={() => set(tVal - 1)} disabled={tVal <= T_LO}><RemoveIcon /></IconButton>
        <Typography variant="status" sx={{ width: 72, textAlign: 'center' }} aria-live="polite">{tVal}%</Typography>
        <IconButton aria-label="Raise target" onClick={() => set(tVal + 1)} disabled={tVal >= T_HI}><AddIcon /></IconButton>
      </Box>
      <Button variant="contained" color="primary" disabled={!!fh.tgt} onClick={go} sx={{ px: 3, minHeight: 40 }}>Go</Button>
    </>
  );
  const stopBtn = (
    <Button variant={red ? 'outlined' : 'text'} color={red ? 'error' : 'primary'} startIcon={<StopIcon />} onClick={stop} sx={{ minHeight: 40, whiteSpace: 'nowrap' }}>
      Stop pump
    </Button>
  );
  const testBtn = <Button variant="text" color="primary" onClick={testPour} sx={{ minHeight: 40, whiteSpace: 'nowrap' }}>Test pour 5 s</Button>;
  const minimum = <BaselineSlider fh={fh} act={act} layout="tray" onAnswer={onAnswer} />;
  const notice = (reserve) => <Notice reserve={reserve}>{slot ? <Line r={slot} /> : null}</Notice>;

  if (phone) {
    return (
      <Box sx={{ display: 'contents' }}>
        <Box sx={{ order: 3, gridColumn: '1 / -1', mt: 3 }}>
          <Box sx={{ ml: -1 }}>{testBtn}</Box>
          <Box sx={{ mt: 2 }}>{minimum}</Box>
        </Box>
        <Box
          component="section"
          aria-label="Target and pump"
          data-tray
          sx={(t) => ({
            order: 5, gridColumn: '1 / -1',
            position: 'sticky', bottom: 0, zIndex: t.zIndex.appBar,
            mx: { xs: -2, sm: -3 }, mt: 3,
            px: { xs: 2, sm: 3 }, pt: 1, pb: 'calc(8px + env(safe-area-inset-bottom))',
            bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider',
          })}
        >
          {notice(2)}
          <Box role="group" aria-label="Target" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {stepper}
            <Box sx={{ ml: 'auto' }}>{stopBtn}</Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Target, pump and minimum" sx={{ gridColumn: '1 / -1', mt: 6 }}>
      <Box sx={{ mb: 1 }}>{notice(1)}</Box>
      <Box
        data-tray
        sx={{
          display: 'grid',
          gridTemplateColumns: { md: 'auto 1fr', lg: 'auto auto minmax(360px, 1fr)' },
          border: 1, borderColor: 'divider', borderRadius: 0, bgcolor: 'background.paper',
          px: 3, py: 2, columnGap: 3, rowGap: 2,
        }}
      >
        <Group label="Target" labelId={labelId}>{stepper}</Group>
        <Group sx={{ borderLeft: 1, borderColor: 'divider', pl: 3 }}>{testBtn}{stopBtn}</Group>
        <Box
          sx={{
            minWidth: 360,
            gridColumn: { md: '1 / -1', lg: 'auto' },
            borderLeft: { md: 0, lg: 1 }, borderTop: { md: 1, lg: 0 }, borderColor: { md: 'divider', lg: 'divider' },
            pl: { md: 0, lg: 3 }, pt: { md: 2, lg: 0 },
          }}
        >
          {minimum}
        </Box>
      </Box>
    </Box>
  );
}
