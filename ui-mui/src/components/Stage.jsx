import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import Rig from './Rig.jsx';
import { f1 } from '../format.js';
import { useSim } from '../useFarmHand.js';

/*
 * The drawing's frame: SVG text styles, the phone key and the demo levers.
 * Motion lives in rigMotion.js (per frame, driven by readings and the pump): no CSS keyframes or transitions
 * on SVG geometry here, because y1/y2/rx aren't CSS properties and CSS would fight the per-frame writes.
 */
const rigStyles = (t) => {
  const R = t.palette.rig;
  return {
    '& text': { paintOrder: 'stroke', stroke: R.stage, strokeWidth: 4, strokeLinejoin: 'round' },
    '& .tag text': { stroke: 'none' },
    '& .label': { font: `600 12px ${t.fonts.body}`, fill: R.label, fontVariantNumeric: 'tabular-nums' },
    '& .label.dim': { fill: R.labelDim, fontWeight: 500 },
    '& .val': { font: `600 16px ${t.fonts.body}`, fontVariantNumeric: 'tabular-nums' },
    '& .chip': { font: `700 11px ${t.fonts.code}`, fill: R.label, stroke: 'none' },
    // Under 600px the drawing is ~0.45 scale, so SVG text would render under 12px. The HTML key below takes over.
    [t.breakpoints.down('sm')]: { '& text, & .tag, & .callout': { display: 'none' } },
  };
};

// Demo levers: quiet text buttons in one row (visual.md F5). Pinch keeps its pressed state.
const lever = { minHeight: 40, px: 1.25, color: 'text.primary', '@media (pointer: coarse)': { minHeight: 44 } };

export default function Stage({ fh, act }) {
  useSim(2);
  const w = fh.world, L = fh.latest;
  const now = fh.nowPct();
  const low = w.cupMl < 200;
  const cup = Math.round(w.cupMl).toLocaleString();

  return (
    <Paper variant="outlined" component="section" aria-label="The rig" sx={{ overflow: 'hidden', bgcolor: 'rig.stage', p: { xs: 1, sm: 1.5 } }}>
      <Box sx={[{ '& svg': { maxHeight: { md: '52vh' } } }, rigStyles]}>
        <Rig fh={fh} />
      </Box>

      {/* Phone: the SVG labels are hidden, so the same facts appear here as text at 12px or more. */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, px: 0.5, pt: 1 }}>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          Soil <b>{now != null ? f1(now) + '%' : '-'}</b> · temp <Box component="b" sx={{ color: 'temp.main' }}>{L ? f1(L.temp_c) + ' °C' : '-'}</Box>
        </Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {w.cupMl > 0 ? `Cup: ${cup} ml.` : 'Cup empty.'}{fh.board.activePot === 'A' ? ' Pumping.' : ''}{w.pinched ? ' Tube pinched.' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">Waterline modeled from one probe.</Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, pt: 1, px: 0.5 }}>
        {/* The real system can't see the cup; it only notices pours that don't reach the probe. A person at the box can. */}
        <Typography variant="body2" role="status" sx={{ fontWeight: 600, minHeight: { md: 20 } }}>
          {low ? (w.cupMl > 0 ? `Pump A's cup is almost empty (${cup} ml).` : "Pump A's cup is empty. Pours won't reach the soil.") : ''}
        </Typography>
        {/* phone: a clean 2x2; wider: one row */}
        <Box sx={{ display: { xs: 'grid', sm: 'flex' }, gridTemplateColumns: '1fr 1fr', gap: 0.5, justifyContent: { md: 'flex-end' }, '& > *': { justifyContent: { xs: 'flex-start', sm: 'center' } } }} role="group" aria-label="Demo actions">
          <ToggleButton
            size="small"
            value="pinch"
            selected={w.pinched}
            onChange={() => act((f) => f.demoPinch())}
            sx={{ ...lever, border: 0, fontSize: '0.875rem', minWidth: 112, '&.Mui-selected': { color: 'common.white', bgcolor: 'ink.main' }, '&.Mui-selected:hover': { bgcolor: 'ink.light' } }}
          >
            {w.pinched ? 'Release tube' : 'Pinch tube'}
          </ToggleButton>
          <Button size="small" variant="text" color="inherit" onClick={() => act((f) => f.demoHandPour())} sx={lever}>Hand pour</Button>
          <Button size="small" variant="text" color="inherit" onClick={() => act((f) => f.demoDry())} sx={lever}>Dry out</Button>
          <Button size="small" variant={low ? 'contained' : 'text'} color={low ? 'primary' : 'inherit'} onClick={() => act((f) => f.refill())} sx={low ? { minHeight: 40, px: 1.5 } : lever}>Refill cup</Button>
        </Box>
      </Stack>
    </Paper>
  );
}
