import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import Rig from './Rig.jsx';
import { useSim } from '../useFarmHand.js';

/*
 * The drawing, un-boxed (spec 9.L.6): no card, no frame, no background. The bench line in the drawing is the ground.
 * Under it, one row: the cup warning on the left, the Demo group on the right.
 * Motion lives in rigMotion.js (per frame, driven by readings and the pump): no CSS keyframes or transitions
 * on SVG geometry here, because y1/y2/rx aren't CSS properties and CSS would fight the per-frame writes.
 */
const rigStyles = (t) => {
  const R = t.palette.rig;
  return {
    '& svg': { display: 'block', maxHeight: { md: '56vh' } },
    '& text': { paintOrder: 'stroke', stroke: R.halo, strokeWidth: 4, strokeLinejoin: 'round' },
    '& .tag text': { stroke: 'none' },
    '& .label': { font: `600 12px ${t.fonts.body}`, fill: R.label, fontVariantNumeric: 'tabular-nums' },
    '& .label.dim': { fill: R.labelDim, fontWeight: 500 },
    '& .val': { font: `600 16px ${t.fonts.body}`, fontVariantNumeric: 'tabular-nums' },
    '& .chip': { font: `600 12px ${t.fonts.body}`, fill: R.label, stroke: 'none', fontVariantNumeric: 'tabular-nums' },
    // Under 600px the drawing is ~0.45 scale, so SVG text would render under 12px. The phone line takes over.
    [t.breakpoints.down('sm')]: { '& text, & .tag, & .callout': { display: 'none' } },
  };
};

// Optional photo of the real build (spec 2.8). No file in src/assets, nothing renders and nothing 404s.
const PHOTO = Object.values(import.meta.glob('../assets/box-a.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' }))[0];
const PHOTO_CAPTION = 'Box A, the real build.';

// Demo levers: outlined, 32px (44 on touch), 4px radius, ruleUI border (theme). Pinch keeps its pressed state.
const lever = {
  minHeight: 32, px: 1.5, whiteSpace: 'nowrap',
  '@media (pointer: coarse)': { minHeight: 44 },
};

export default function Stage({ fh, act }) {
  useSim(2);
  const w = fh.world;
  const low = w.cupMl < 200;
  const cup = Math.round(w.cupMl).toLocaleString();

  return (
    <Box component="section" aria-label="The rig" sx={{ minWidth: 0 }}>
      <Box sx={rigStyles}>
        <Rig fh={fh} />
      </Box>

      {/* Phone: the SVG labels are hidden, so the cup and the honesty note appear as text. The readings are in the rail. */}
      <Typography variant="body2" sx={{ display: { xs: 'block', sm: 'none' }, mt: 1 }}>
        {w.cupMl > 0 ? `Cup ${cup} ml.` : 'Cup empty.'}{fh.board.activePot === 'A' ? ' Pumping.' : ''}{w.pinched ? ' Tube pinched.' : ''} Waterline modeled from one probe.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 1 }}>
        {/* The real system can't see the cup; it only notices pours that don't reach the probe. A person at the box can. */}
        <Typography variant="body2" role="status" sx={{ fontWeight: 600, minHeight: 20, flex: { xs: '1 1 100%', md: '1 1 0' }, display: { xs: low ? 'block' : 'none', md: 'block' } }}>
          {low ? (w.cupMl > 0 ? `Pump A's cup is almost empty (${cup} ml).` : "Pump A's cup is empty. Pours won't reach the soil.") : ''}
        </Typography>
        <Box
          role="group"
          aria-label="Demo actions"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'auto repeat(4, auto)' },
            alignItems: 'center', gap: 1, flex: { xs: '1 1 100%', sm: '0 0 auto' },
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, mr: { sm: 0.5 } }}>Demo</Typography>
          <ToggleButton size="small" value="pinch" selected={w.pinched} onChange={() => act((f) => f.demoPinch())} sx={{ ...lever, minWidth: 112 }}>
            {w.pinched ? 'Release tube' : 'Pinch tube'}
          </ToggleButton>
          <Button size="small" variant="outlined" onClick={() => act((f) => f.demoHandPour())} sx={lever}>Hand pour</Button>
          <Button size="small" variant="outlined" onClick={() => act((f) => f.demoDry())} sx={lever}>Dry out</Button>
          <Button size="small" variant={low ? 'contained' : 'outlined'} onClick={() => act((f) => f.refill())} sx={lever}>Refill cup</Button>
        </Box>
        {PHOTO && (
          <Box component="figure" sx={{ m: 0, width: 160, flex: 'none', order: { xs: 3, md: 0 } }}>
            <Box component="img" src={PHOTO} alt="The real box A on the bench" sx={{ display: 'block', width: 160, border: 1, borderColor: 'divider' }} />
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{PHOTO_CAPTION}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
