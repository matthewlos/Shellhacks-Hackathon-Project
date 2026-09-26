import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import BackHandOutlinedIcon from '@mui/icons-material/BackHandOutlined';
import LocalDrinkOutlinedIcon from '@mui/icons-material/LocalDrinkOutlined';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import Rig from './Rig.jsx';
import { f1 } from '../format.js';

/*
 * SVG text + motion. The one authored moment is the pour (PLAN 5d, impeccable craft floor):
 * tube flow, drops, pump buzz, the waterline and soil color following the readings. Everything else is still.
 * Timings from emil-design-eng: 250 ms strong ease-out for data-driven changes; the stream loops only while pumping.
 */
const rigStyles = (t) => {
  const R = t.palette.rig, E = t.ease;
  return {
    '& text': { paintOrder: 'stroke', stroke: R.stage, strokeWidth: 4, strokeLinejoin: 'round' },
    '& .tag text': { stroke: 'none' },
    '& .label': { font: `600 12px ${t.fonts.body}`, fill: R.label, fontVariantNumeric: 'tabular-nums' },
    '& .val': { font: `600 16px ${t.fonts.body}`, fontVariantNumeric: 'tabular-nums' },
    '& .chip': { font: `700 10px ${t.fonts.code}`, fill: R.label, stroke: 'none' },
    '& .soil': { transition: `fill ${t.dur.panel}ms ${E}` },
    '& .level': { transition: `y ${t.dur.number}ms ${E}, y1 ${t.dur.number}ms ${E}, y2 ${t.dur.number}ms ${E}, height ${t.dur.number}ms ${E}` },
    '& .puddle': { transition: `rx ${t.dur.number}ms ${E}` },
    '& .tip': { transition: `fill ${t.dur.panel}ms ${E}` },
    '& .beat': { animation: `fh-beat 700ms ${E} forwards` },
    '& .tubeWater': { opacity: 0, strokeDasharray: '6 8' },
    '& .drop': { opacity: 0, transformBox: 'fill-box' },
    '& .rig.pumping .tubeWater': { opacity: 1, animation: 'fh-flow 450ms linear infinite' },
    '& .rig.pumping.flowing .drop': { animation: 'fh-fall 550ms linear infinite' },
    '& .rig.pumping.flowing .drop:nth-of-type(2)': { animationDelay: '180ms' },
    '& .rig.pumping.flowing .drop:nth-of-type(3)': { animationDelay: '360ms' },
    '& .rig.pumping .pumpBody': { animation: 'fh-buzz 80ms linear infinite', transformBox: 'fill-box' },
    '@keyframes fh-beat': { from: { opacity: 1 }, to: { opacity: 0 } },
    '@keyframes fh-flow': { to: { strokeDashoffset: -14 } },
    '@keyframes fh-fall': { '0%': { transform: 'translateY(0)', opacity: 1 }, '100%': { transform: 'translateY(16px)', opacity: 0.1 } },
    '@keyframes fh-buzz': { '50%': { transform: 'translateX(0.8px)' } },
    // Reduced motion keeps the data changes (color, opacity, the heartbeat fade) and drops the movement.
    '@media (prefers-reduced-motion: reduce)': {
      '& .level, & .puddle': { transition: 'none' },
      '& .rig.pumping .tubeWater': { animation: 'none', strokeDasharray: 'none' },
      '& .rig.pumping.flowing .drop': { animation: 'none', opacity: 1 },
      '& .rig.pumping.flowing .drop:nth-of-type(2)': { transform: 'translateY(6px)' },
      '& .rig.pumping.flowing .drop:nth-of-type(3)': { transform: 'translateY(12px)' },
      '& .rig.pumping .pumpBody': { animation: 'none' },
    },
    // Under 600px the drawing is ~0.45 scale, so SVG text would render under 12px. The HTML key below takes over.
    [t.breakpoints.down('sm')]: { '& text, & .tag': { display: 'none' } },
  };
};

export default function Stage({ fh, act, frac }) {
  const w = fh.world, L = fh.latest;
  const side = { bgcolor: 'background.paper', borderColor: 'divider', color: 'text.primary' };

  return (
    <Paper variant="outlined" component="section" aria-label="The rig" sx={{ overflow: 'hidden', bgcolor: 'rig.stage', p: { xs: 1, sm: 1.5 } }}>
      <Box sx={[{ '& svg': { maxHeight: { md: '50vh' } } }, rigStyles]}>
        <Rig fh={fh} frac={frac} />
      </Box>

      {/* Phone: the SVG labels are hidden, so the same facts appear here as text at 12px or more. */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, px: 0.5, pt: 1 }}>
        <Typography variant="body2">
          Soil probe on D32 <b>{L ? f1(L.a_pct) + '%' : '-'}</b>, temp probe on D4 <Box component="b" sx={{ color: 'temp.main' }}>{L ? f1(L.temp_c) + '\u2009°C' : '-'}</Box>.
        </Typography>
        <Typography variant="body2">
          Pump A, 20 ml/s. {w.cupMl > 0 ? `${Math.round(w.cupMl)} ml in the cup` : 'The cup is empty'}{fh.board.activePot === 'A' ? ', pumping' : ''}{w.pinched ? ', tube pinched' : ''}.
        </Typography>
        <Typography variant="caption" color="text.secondary">The waterline is modeled from one probe.</Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, pt: 1.5, px: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: { md: '0 1 260px' } }}>
          Soil color and waterline follow the probe %. The box is simulated.
        </Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, justifyContent: { md: 'flex-end' } }} role="group" aria-label="Things to do to the modeled box">
          <ToggleButton
            size="small"
            value="pinch"
            selected={w.pinched}
            onChange={() => act((f) => f.demoPinch())}
            sx={{ gap: 0.75, height: 40, minWidth: 176, justifyContent: 'flex-start', '@media (pointer: coarse)': { height: 44 }, ...side, '&.Mui-selected': { color: 'common.white', bgcolor: 'ink.main' } }}
          >
            <BackHandOutlinedIcon fontSize="small" />{w.pinched ? 'Let go of the tube' : 'Pinch the tube'}
          </ToggleButton>
          <Button size="small" variant="outlined" color="inherit" startIcon={<LocalDrinkOutlinedIcon />} onClick={() => act((f) => f.demoHandPour())} sx={side}>Pour a cup in by hand</Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={<WbSunnyOutlinedIcon />} onClick={() => act((f) => f.demoDry())} sx={side}>Dry the soil out</Button>
          <Button size="small" variant="outlined" color="inherit" startIcon={<ReplayIcon />} onClick={() => act((f) => f.refill())} sx={side}>Refill the cup</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
