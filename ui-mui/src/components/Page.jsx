import Box from '@mui/material/Box';
import { GRID } from '../theme.js';

/*
 * The one container: 1520 px of content at most (plus the 32 px gutters), centered, gutters 16 / 24 / 32. The header's inner box and <main> both use it,
 * so the logo and the page content share one left edge (x = 200 at 1920).
 */
export function Page({ component = 'div', sx, children, ...rest }) {
  return (
    <Box component={component} {...rest} sx={[{ width: '100%', maxWidth: GRID.max + 2 * 32, mx: 'auto', px: GRID.gutter, boxSizing: 'border-box' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  );
}

// The 12-column grid (4 on phones, 8 on tablets). Spread it into an sx: <Box sx={{ ...grid12, rowGap: 0 }}>.
export const grid12 = {
  display: 'grid',
  columnGap: GRID.gap,
  gridTemplateColumns: { xs: 'repeat(4, minmax(0,1fr))', sm: 'repeat(8, minmax(0,1fr))', md: 'repeat(12, minmax(0,1fr))' },
};

export default Page;
