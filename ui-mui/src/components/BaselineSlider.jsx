import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { CFG } from '../sim.js';

// "Keep the soil at least at __%" (PLAN 5e). Range 20 to wet - 15, step 1, committed on release.
// It's the same control on the Live box and Simulation pages: both call farmHand.setBaseline().
export default function BaselineSlider({ fh, act, label = 'Keep the soil at least at' }) {
  const lo = 20, hi = CFG.WET_PCT - 15;
  const [v, setV] = useState(CFG.DRY_PCT);
  const [answer, setAnswer] = useState(null);
  useEffect(() => { setV(CFG.DRY_PCT); }, [CFG.DRY_PCT]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (pct) => {
    if (typeof fh.setBaseline !== 'function') { setAnswer({ error: 'this sim build has no setBaseline yet' }); return; }
    setAnswer(act((f) => f.setBaseline(pct)));
  };

  return (
    <Box component="section" aria-labelledby="baseline-label">
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h3" component="h2" id="baseline-label">{label}</Typography>
        <Typography sx={{ fontWeight: 600, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }} aria-hidden="true">{v}%</Typography>
      </Stack>
      <Slider
        value={v}
        min={lo}
        max={hi}
        step={1}
        marks={[{ value: lo, label: `${lo}%` }, { value: hi, label: `${hi}%` }]}
        onChange={(_, x) => setV(x)}
        onChangeCommitted={(_, x) => commit(x)}
        aria-labelledby="baseline-label"
        getAriaValueText={(x) => `${x}%`}
        sx={{ mt: 1, mx: 1.25, width: 'calc(100% - 20px)', '& .MuiSlider-markLabel': { typography: 'caption', color: 'text.secondary' },
          '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(-10px)' }, '& .MuiSlider-markLabel[data-index="1"]': { transform: 'translateX(calc(-100% + 10px))' } }}
      />
      <Typography variant="body2" sx={{ mt: 1 }} role="status" aria-live="polite" color={answer?.error ? 'text.primary' : 'text.primary'}>
        {answer == null
          ? `Box A waters at or below ${CFG.DRY_PCT}%. Each drink aims for ${CFG.TARGET_PCT}%.`
          : answer.error
            ? `Not changed: ${answer.error}.`
            : `Keeping it at ${answer.baseline}%. Each drink aims for ${answer.target}%.`}
      </Typography>
    </Box>
  );
}
