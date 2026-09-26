import { useEffect, useId, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { CFG } from '../sim.js';
import { useSimValue } from '../useFarmHand.js';

// "Keep soil above __%" (PLAN 5e): the minimum. Range 20 to wet - 15, step 1, committed on release.
// The same control on the Live and Outside pages: both call farmHand.setBaseline().
export default function BaselineSlider({ fh, act, label = 'Keep soil above', showAnswer = true }) {
  const dry = useSimValue(() => CFG.DRY_PCT, 4);
  const lo = 20, hi = CFG.WET_PCT - 15;
  const id = useId();
  const [v, setV] = useState(dry);
  const [answer, setAnswer] = useState(null);
  useEffect(() => { setV(dry); }, [dry]);

  const commit = (pct) => {
    if (typeof fh.setBaseline !== 'function') { setAnswer({ error: true }); return; }
    setAnswer(act((f) => f.setBaseline(pct)));
  };

  return (
    <Box component="section" aria-labelledby={id}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" id={id} sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="status" aria-hidden="true">{v}%</Typography>
      </Stack>
      <Slider
        value={v}
        min={lo}
        max={hi}
        step={1}
        marks={[{ value: lo, label: `${lo}%` }, { value: hi, label: `${hi}%` }]}
        onChange={(_, x) => setV(x)}
        onChangeCommitted={(_, x) => commit(x)}
        aria-labelledby={id}
        getAriaValueText={(x) => `${x}%`}
        sx={{ mt: 0.5, mx: 1.25, width: 'calc(100% - 20px)',
          // No layout transitions (the thumb follows the pointer anyway); a 28px thumb on touch screens.
          '& .MuiSlider-track, & .MuiSlider-thumb': { transition: 'none' },
          '@media (pointer: coarse)': { '& .MuiSlider-thumb': { width: 28, height: 28 } }, '& .MuiSlider-markLabel': { typography: 'caption', color: 'text.secondary' },
          '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(-10px)' }, '& .MuiSlider-markLabel[data-index="1"]': { transform: 'translateX(calc(-100% + 10px))' } }}
      />
      {(showAnswer || answer?.error) && (
        <Typography variant="body2" sx={{ mt: 1 }} role="status" aria-live="polite">
          {answer?.error
            ? "Couldn't change it: this build can't set a minimum."
            : answer
              ? `Waters near ${answer.baseline + CFG.LOW_MARGIN}%, never below ${answer.baseline}%. Fills to ${answer.target}%.`
              : `Waters near ${dry + CFG.LOW_MARGIN}%, never below ${dry}%. Fills to ${CFG.TARGET_PCT}%.`}
        </Typography>
      )}
    </Box>
  );
}
