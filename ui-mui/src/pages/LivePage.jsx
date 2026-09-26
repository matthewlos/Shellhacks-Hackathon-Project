import Box from '@mui/material/Box';
import Stage from '../components/Stage.jsx';
import WeatherCard from '../components/WeatherCard.jsx';
import RightColumn from '../components/RightColumn.jsx';
import LogTabs from '../components/LogTabs.jsx';

/*
 * Live box (PLAN 5e): box A only, and nothing estimated.
 *   left:  the drawing, the weather card under it
 *   right: Tier 1, pump state, the call, target + Go, Test pour / Stop pump, the baseline slider
 *   below: tabs
 * The money graph and cups saved moved to Control. Phone: drawing, right column, weather, tabs.
 */
export default function LivePage({ fh, act, frac }) {
  return (
    <Box
      sx={{
        display: { xs: 'flex', md: 'grid' }, flexDirection: 'column', gap: 2,
        gridTemplateColumns: 'minmax(0, 1fr) minmax(420px, 34%)',
        gridTemplateRows: 'min-content 1fr auto',
        gridTemplateAreas: '"stage side" "sky side" "tabs tabs"',
      }}
    >
      <Box sx={{ gridArea: 'stage', minWidth: 0 }}><Stage fh={fh} act={act} frac={frac} /></Box>
      <Box sx={{ gridArea: 'side', minWidth: 0, alignSelf: 'start' }}><RightColumn fh={fh} act={act} frac={frac} /></Box>
      <Box sx={{ gridArea: 'sky', minWidth: 0, alignSelf: 'start' }}><WeatherCard /></Box>
      <Box sx={{ gridArea: 'tabs', minWidth: 0 }}><LogTabs fh={fh} act={act} /></Box>
    </Box>
  );
}
