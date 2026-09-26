import { useEffect, useId, useState } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { CFG } from '../sim.js';
import { useSimValue } from '../useFarmHand.js';

/*
 * "Keep soil above __%": the minimum. Range 20 to wet - 15, step 1, committed on release (pointer or keyboard),
 * through farmHand.setBaseline(). The same control on Demo (layout="tray") and Outside (layout="ruler").
 * The slider itself is an ink needle on a ruler (theme MuiSlider): the kept range, right of the needle, is ink.
 *
 *   layout="tray":  label (subtitle2) and value (status) on one 20 px row, then a 40 px row: "20%" slider "55%".
 *   layout="ruler": no label row. A full-`domain` ruler (ticks every 5, labels at 20/35/50/65); the slider sits over
 *                   its own lo..hi part of it; the value rides above the needle as a 12 px/600 tag.
 *                   x = (v - domain[0]) / (domain[1] - domain[0]) of the box width, with no horizontal padding, so a
 *                   sibling column of the same width lines up tick for tick. The needle's overhang stays visible.
 *   onAnswer(answer) runs after each commit with the setBaseline() result, or { error: true }.
 */
const TAG = 16, TOP = 20, LANE = 20;     // ruler rows: value tag, gap, needle lane (the rail sits at y = 30)

export default function BaselineSlider({ fh, act, layout = 'tray', domain = [20, 65], onAnswer, sx }) {
  const dry = useSimValue(() => CFG.DRY_PCT, 4);
  const wet = useSimValue(() => CFG.WET_PCT, 4);
  const lo = 20, hi = wet - 15;
  const id = useId();
  const [v, setV] = useState(dry);
  useEffect(() => { setV(dry); }, [dry]);

  const commit = (pct) => {
    const answer = typeof fh.setBaseline === 'function' ? act((f) => f.setBaseline(pct)) : { error: true };
    onAnswer?.(answer ?? { error: true });
  };
  const slider = (extra) => (
    <Slider
      value={v}
      min={lo}
      max={hi}
      step={1}
      onChange={(_, x) => setV(x)}
      onChangeCommitted={(_, x) => commit(x)}
      getAriaValueText={(x) => `${x}%`}
      {...extra}
    />
  );
  const rootSx = Array.isArray(sx) ? sx : [sx];

  if (layout === 'ruler') {
    const [d0, d1] = domain;
    const pos = (x) => `${((x - d0) / (d1 - d0)) * 100}%`;
    const ticks = [];
    for (let t = Math.ceil(d0 / 5) * 5; t <= d1; t += 5) ticks.push(t);
    const labelled = (t) => (t - 20) % 15 === 0;
    return (
      <Box sx={[{ position: 'relative', height: TAG + 4 + LANE + 8 + 16, overflow: 'visible' }, ...rootSx]}>
        {/* the value tag rides the needle */}
        <Typography aria-hidden="true" component="span" sx={{
          position: 'absolute', top: 0, left: pos(v), transform: 'translateX(-50%)', whiteSpace: 'nowrap',
          fontSize: 12, lineHeight: `${TAG}px`, fontWeight: 600, color: 'text.primary', fontVariantNumeric: 'tabular-nums',
        }}>{v}%</Typography>
        {/* the ruler's own baseline beyond the slider's part */}
        <Box aria-hidden="true" sx={{ position: 'absolute', top: TOP + LANE / 2 - 0.5, left: pos(hi), right: 0, height: '1px', bgcolor: 'ruleUI' }} />
        {ticks.map((t) => (
          <Box key={t} aria-hidden="true" sx={{ position: 'absolute', top: TOP + LANE / 2 + 1, left: pos(t), width: '1px', height: 6, bgcolor: 'text.secondary', transform: 'translateX(-0.5px)' }} />
        ))}
        {ticks.filter(labelled).map((t) => (
          <Typography key={`l${t}`} aria-hidden="true" variant="caption" component="span" sx={{
            position: 'absolute', top: TOP + LANE + 8, left: pos(t), transform: 'translateX(-50%)', color: 'text.secondary', whiteSpace: 'nowrap',
          }}>{t}</Typography>
        ))}
        <Box sx={{ position: 'absolute', top: TOP, height: LANE, left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})`, display: 'flex', alignItems: 'center' }}>
          {slider({ 'aria-label': 'Keep soil above', sx: { py: 0, '@media (pointer: coarse)': { py: 0 } } })}
        </Box>
      </Box>
    );
  }

  return (
    <Box component="section" aria-labelledby={id} sx={[{ minWidth: 0 }, ...rootSx]}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, height: 20 }}>
        <Typography variant="subtitle2" id={id}>Keep soil above</Typography>
        <Typography variant="status" aria-hidden="true" sx={{ lineHeight: '20px' }}>{v}%</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 40, '@media (pointer: coarse)': { height: 44 } }}>
        <Typography variant="caption" aria-hidden="true" sx={{ color: 'text.secondary', flex: 'none' }}>{lo}%</Typography>
        {slider({ 'aria-labelledby': id, sx: { flex: 1, py: 0, '@media (pointer: coarse)': { py: 0 } } })}
        <Typography variant="caption" aria-hidden="true" sx={{ color: 'text.secondary', flex: 'none' }}>{hi}%</Typography>
      </Box>
    </Box>
  );
}
