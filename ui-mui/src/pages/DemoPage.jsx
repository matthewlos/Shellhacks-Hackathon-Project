import Box from '@mui/material/Box';
import { grid12 } from '../components/Page.jsx';
import NowRail from '../components/NowRail.jsx';
import Stage from '../components/Stage.jsx';
import BenchStrip from '../components/BenchStrip.jsx';
import LogDrawer from '../components/LogDrawer.jsx';

/*
 * Demo (#/demo), "the plate" (spec 1.3): the readings rail beside the un-boxed drawing, one control tray under
 * both, and a one-line log that opens a drawer. The tray sits in its own row after the rail and the drawing,
 * so nothing either of them does can move it.
 * Phone: readings, status, call, drawing, demo row, Test pour, minimum, log row; a sticky tray at the bottom
 * holds Target, Go and Stop pump (BenchStrip places its pieces with `order`).
 */
export default function DemoPage({ fh, act, frac }) {
  return (
    <Box sx={{ ...grid12, rowGap: 0, alignItems: 'start' }}>
      <Box sx={{ gridColumn: { xs: '1 / -1', md: '1 / span 4', xl: '1 / span 3' }, order: { xs: 1, md: 0 }, minWidth: 0 }}>
        <NowRail fh={fh} act={act} frac={frac} />
      </Box>
      <Box sx={{ gridColumn: { xs: '1 / -1', md: '5 / -1', xl: '4 / -1' }, order: { xs: 2, md: 0 }, mt: { xs: 3, md: 0 }, minWidth: 0 }}>
        <Stage fh={fh} act={act} />
      </Box>
      <BenchStrip fh={fh} act={act} />
      <LogDrawer fh={fh} act={act} sx={{ gridColumn: '1 / -1', order: { xs: 4, md: 0 }, mt: 3 }} />
    </Box>
  );
}
