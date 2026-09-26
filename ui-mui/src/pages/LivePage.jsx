import Box from '@mui/material/Box';
import Stage from '../components/Stage.jsx';
import RightColumn from '../components/RightColumn.jsx';
import LogTabs from '../components/LogTabs.jsx';

/*
 * Live (PLAN 5e): box A only. The drawing is the one boxed surface on the page; everything else sits on white.
 *   left:  the drawing, the tabs under it
 *   right: readings, the call, target, minimum, weather (split by rules)
 * Phone: readings and the call first, then the drawing, the controls and weather, then the tabs.
 */
export default function LivePage({ fh, act, frac }) {
  return (
    <Box
      sx={{
        display: { xs: 'flex', md: 'grid' }, flexDirection: 'column', rowGap: { xs: 3, md: 3 }, columnGap: 4,
        gridTemplateColumns: 'minmax(0, 1fr) minmax(400px, 32%)',
        gridTemplateRows: 'min-content 1fr',
        gridTemplateAreas: '"stage side" "tabs side"',
      }}
    >
      <Box sx={{ gridArea: 'stage', minWidth: 0, order: { xs: 2 } }}><Stage fh={fh} act={act} frac={frac} /></Box>
      <Box sx={{ gridArea: 'side', minWidth: 0, alignSelf: 'start', display: { xs: 'contents', md: 'block' } }}><RightColumn fh={fh} act={act} frac={frac} /></Box>
      <Box sx={{ gridArea: 'tabs', minWidth: 0, order: { xs: 4 } }}><LogTabs fh={fh} act={act} /></Box>
    </Box>
  );
}
