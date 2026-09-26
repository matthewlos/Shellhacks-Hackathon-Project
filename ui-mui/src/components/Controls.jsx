import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import StopIcon from '@mui/icons-material/Stop';
import { CFG } from '../sim.js';
import { clamp, secs, signed } from '../format.js';
import { useSim } from '../useFarmHand.js';

const T_LO = CFG.DRY_PCT, T_HI = CFG.WET_PCT - CFG.BAND;

// Target stepper + Go (the one filled button here), then Test pour and Stop pump as text buttons.
// Stop pump turns red only while the pump runs and no red alert is up (one red thing at a time).
export default function Controls({ fh, act, redTaken }) {
  useSim(4);
  const [tVal, setTVal] = useState(CFG.TARGET_PCT);
  const [msg, setMsg] = useState('');
  const run = fh.run;
  const set = (v) => setTVal(clamp(v, T_LO, T_HI));
  // The stepper shows the last run's target until someone changes it, so it agrees with the receipt and the drawing.
  useEffect(() => { if (run.target != null) setTVal(run.target); }, [run.t0]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = !fh.tgt && run.phase !== 'idle';
  const pumping = fh.board.activePot === 'A';
  const red = pumping && !redTaken;

  let status = '';
  if (fh.tgt) {
    status = `Pulse ${run.pulses.length + 1}: ${run.phase === 'pulsing' || pumping ? 'pumping' : 'settling'}`;
  } else if (done) {
    // The receipt. A fault's reason is in the red alert above, so it isn't repeated here.
    const n = run.pulses.length;
    // sim.js says "Safety rules stopped it: <why>." Say it once: "Blocked: <why>."
    if (run.phase === 'blocked' && n === 0) status = `Blocked: ${run.msg.replace(/^Safety rules stopped it:\s*/, '')}`;
    else {
      const word = { locked: `Locked at ${run.now.toFixed(1)}%`, fault: 'Stopped', over: 'Overshot', short: 'Out of pulses', blocked: 'Blocked', stopped: 'Stopped' }[run.phase] || 'Stopped';
      // A pour that moved no water (fault, pinched tube, empty cup) is reported in pump seconds, never as ml delivered.
      const noWater = run.phase === 'fault' || fh.world.pinched || fh.world.cupMl <= 0;
      const pl = `${n} ${n === 1 ? 'pulse' : 'pulses'}`;
      status = noWater
        ? `${word}. ${pl}, ${run.secs} s pumped, no water reached the soil.`
        : `${word}. ${pl}, ${run.secs} s, ${run.ml} ml, ${secs(run.took_s)}.`;
      if (run.phase === 'over' || run.phase === 'blocked') status += ` ${run.msg.replace(/^Safety rules stopped it:\s*/, '')}`;
    }
  }

  return (
    <Box component="section" aria-label="Target">
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="body2" id="target-label" sx={{ fontWeight: 600 }}>Target</Typography>
        <Stack direction="row" sx={{ alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 1 }} role="group" aria-labelledby="target-label">
          <IconButton aria-label="Lower target" onClick={() => set(tVal - 1)} disabled={tVal <= T_LO}><RemoveIcon /></IconButton>
          <Typography variant="status" sx={{ width: 64, textAlign: 'center' }} aria-live="polite">{tVal}%</Typography>
          <IconButton aria-label="Raise target" onClick={() => set(tVal + 1)} disabled={tVal >= T_HI}><AddIcon /></IconButton>
        </Stack>
        <Button
          variant="contained"
          color="ink"
          disabled={!!fh.tgt}
          onClick={() => { const r = act((f) => f.startTarget(tVal)); setMsg(r.ok ? '' : r.why); }}
          sx={{ px: 3 }}
        >
          Go
        </Button>
        <Typography variant="caption" color="text.secondary">{T_LO}-{T_HI}%, up to {CFG.MAX_PULSES} pulses</Typography>
      </Stack>

      {fh.tgt && (run.pulses?.length > 0 || fh.tgt.state === 'settle') && (
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.5 }} aria-label="Pulses">
          {(run.pulses || []).map((p, i) => <Chip key={i} size="small" variant="outlined" label={`${p.s} s ${signed(p.rise)}%`} />)}
          {fh.tgt?.state === 'settle' && <Chip size="small" variant="outlined" label={`${fh.tgt.pulse.secs} s, settling`} />}
        </Stack>
      )}
      {status && (
        <Typography variant="body2" sx={{ mt: 1, fontWeight: run.phase === 'locked' && done ? 600 : 400 }} color={done && run.phase === 'locked' ? 'success.text' : 'text.primary'} aria-live="polite">
          {status}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, ml: -1 }}>
        <Button
          variant="text"
          color="inherit"
          onClick={() => { const r = act((f) => f.testPour(5)); setMsg(r.watered ? '' : `Not now: ${r.refused_because}.`); }}
        >
          Test pour 5 s
        </Button>
        <Button
          variant={red ? 'outlined' : 'text'}
          color={red ? 'error' : 'inherit'}
          startIcon={<StopIcon />}
          onClick={() => { act((f) => f.stop()); setMsg(''); }}
        >
          Stop pump
        </Button>
      </Stack>
      <Box role="status" aria-live="polite">
        {msg && <Alert severity="warning" onClose={() => setMsg('')} sx={{ mt: 1.5 }}>{msg}</Alert>}
      </Box>
    </Box>
  );
}
