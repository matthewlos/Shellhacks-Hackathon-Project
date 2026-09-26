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
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import StopIcon from '@mui/icons-material/Stop';
import { CFG } from '../sim.js';
import { clamp, signed } from '../format.js';

const T_LO = CFG.DRY_PCT, T_HI = CFG.WET_PCT - CFG.BAND;

// Hit the Target stepper + Go, then Test pour / Stop pump. Stop pump turns red only while the pump runs
// and no red alert is up (one red thing at a time).
export default function Controls({ fh, act, redTaken }) {
  const [tVal, setTVal] = useState(CFG.TARGET_PCT);
  const [msg, setMsg] = useState('');
  const run = fh.run;
  const set = (v) => setTVal(clamp(v, T_LO, T_HI));
  // The stepper shows the last run's target until someone changes it, so it agrees with the receipt and the drawing.
  useEffect(() => { if (run.target != null) setTVal(run.target); }, [run.t0]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = !fh.tgt && run.phase !== 'idle';
  const pumping = fh.board.activePot === 'A';

  let status = '';
  if (fh.tgt) {
    status = `Pulse ${run.pulses.length + 1}: ${run.phase === 'pulsing' || pumping ? 'pumping' : 'waiting for it to settle'}.`;
  } else if (done) {
    // The receipt. The pump state above already says "Locked at 54.8%"; the alert carries a fault.
    const n = run.pulses.length;
    const word = { locked: `Locked at ${run.now.toFixed(1)}% (target ${run.target}%)`, fault: "Stopped, water isn't reaching the soil", over: 'Overshot', short: 'Out of pulses',
      blocked: 'Stopped by the safety rules', stopped: 'Stopped by hand' }[run.phase] || 'Stopped';
    status = `${word}. ${n} ${n === 1 ? 'pulse' : 'pulses'}, ${run.secs} s of pumping, ${run.ml} ml, took ${run.took_s} s.`;
    if (run.phase === 'over' || run.phase === 'blocked') status += ` ${run.msg}`;
  }

  return (
    <Box component="section" aria-labelledby="target-title">
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h3" id="target-title" sx={{ flex: { xs: '1 0 100%', sm: 1 }, whiteSpace: 'nowrap' }}>Hit a target</Typography>
        <Stack direction="row" sx={{ alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 1 }} role="group" aria-label="Target moisture">
          <IconButton aria-label="Lower target" onClick={() => set(tVal - 1)} disabled={tVal <= T_LO}><RemoveIcon /></IconButton>
          <Typography sx={{ width: 56, textAlign: 'center', fontWeight: 600, fontSize: '1.25rem', lineHeight: '28px', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">{tVal}%</Typography>
          <IconButton aria-label="Raise target" onClick={() => set(tVal + 1)} disabled={tVal >= T_HI}><AddIcon /></IconButton>
        </Stack>
        <Button
          sx={{ ml: 'auto' }}
          variant="contained"
          color="ink"
          startIcon={<GpsFixedIcon />}
          disabled={!!fh.tgt}
          onClick={() => { const r = act((f) => f.startTarget(tVal)); setMsg(r.ok ? '' : r.why); }}
        >
          Go
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
        {T_LO}-{T_HI}%, up to {CFG.MAX_PULSES} short pulses.
      </Typography>

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

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<WaterDropOutlinedIcon />}
          onClick={() => { const r = act((f) => f.testPour(5)); setMsg(r.watered ? '' : `Refused: ${r.refused_because}.`); }}
          sx={{ borderColor: 'divider' }}
        >
          Test pour 5 s
        </Button>
        <Button
          fullWidth
          variant="outlined"
          color={pumping && !redTaken ? 'error' : 'inherit'}
          startIcon={<StopIcon />}
          onClick={() => { act((f) => f.stop()); setMsg(''); }}
          sx={pumping && !redTaken ? {} : { borderColor: 'divider' }}
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
