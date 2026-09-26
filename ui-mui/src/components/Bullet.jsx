import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/*
 * A Few bullet graph for soil moisture (spec 2.6). Plain props, no sim: the Demo page passes CFG values, the real
 * Live page passes the box's baseline.
 *   value   the reading (null hides the needle)
 *   min     the minimum: range.low below it, range.good above it
 *   full    the "full" line (null: two ranges only, no full tick or label)
 *   target  a target tick (null: none)
 *   scale   [lo, hi] of the bar, in %
 *   labels  true: "min 35%" / "full 70%" captions under the bar
 * aria-hidden: the number beside it is the accessible value.
 */
const pos = (v, [lo, hi]) => `${(100 * (Math.min(hi, Math.max(lo, v)) - lo)) / (hi - lo)}%`;

export default function Bullet({ value = null, min, full = null, target = null, scale = [20, 80], labels = true, sx }) {
  const hasFull = full != null;
  const top = hasFull ? full : scale[1];
  return (
    <Box aria-hidden="true" sx={[{ position: 'relative', pb: labels ? 2.5 : 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box sx={{ position: 'relative', height: 8 }}>
        {/* three abutting ranges, 0 radius */}
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pos(min, scale), bgcolor: 'range.low' }} />
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: pos(min, scale), right: `calc(100% - ${pos(top, scale)})`, bgcolor: 'range.good' }} />
        {hasFull && <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: pos(full, scale), right: 0, bgcolor: 'range.high' }} />}
        {/* edge ticks carry the boundaries (WCAG 1.4.11): the fills alone don't reach 3:1 */}
        <Box sx={{ position: 'absolute', top: -2, bottom: -2, left: pos(min, scale), width: '1px', bgcolor: 'range.edge' }} />
        {hasFull && <Box sx={{ position: 'absolute', top: -2, bottom: -2, left: pos(full, scale), width: '1px', ml: '-1px', bgcolor: 'range.edge' }} />}
        {target != null && (
          <Box sx={{ position: 'absolute', top: -2, height: 12, left: pos(target, scale), width: '1.5px', ml: '-0.75px', bgcolor: 'text.primary' }} />
        )}
        {value != null && (
          // The needle moves on transform (a full-width layer translated by the value), not `left`. The clip box
          // keeps the translated layer from widening the page (horizontal scroll on phones).
          <Box sx={{ position: 'absolute', top: -4, bottom: -4, left: -2, right: -2, overflow: 'hidden' }}>
            <Box
              sx={(t) => ({
                position: 'absolute', top: 0, bottom: 0, left: 2, right: 2,
                transform: `translateX(${pos(value, scale)})`,
                transition: `transform ${t.dur.number}ms ${t.ease}`,
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              })}
            >
              <Box sx={{ position: 'absolute', left: '-1.5px', top: 0, height: 16, width: 3, bgcolor: 'text.primary', borderRadius: '1px' }} />
            </Box>
          </Box>
        )}
      </Box>
      {labels && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: 12, left: pos(min, scale), whiteSpace: 'nowrap' }}>
            min {min}%
          </Typography>
          {hasFull && (
            <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: 12, left: pos(full, scale), transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
              full {full}%
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
