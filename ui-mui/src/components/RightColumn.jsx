import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import LiveNow from './LiveNow.jsx';
import TheCall from './TheCall.jsx';
import Controls from './Controls.jsx';
import BaselineSlider from './BaselineSlider.jsx';
import WeatherCard from './WeatherCard.jsx';
import AlertOverlay from './AlertOverlay.jsx';
import { currentAlert } from '../live.js';
import { useSimValue } from '../useFarmHand.js';

/*
 * The right column, split by a rule on its left and rules between groups, never cards (visual audit F1).
 * Phone: the column dissolves (display: contents) so the readings come first, above the drawing,
 * and the controls and the weather follow it (LivePage sets the order).
 */
export default function RightColumn({ fh, act, frac }) {
  useSimValue(() => currentAlert(fh)?.key ?? '', 4);
  const alert = currentAlert(fh);
  return (
    <Box component="aside" aria-label="Now" sx={{ display: { xs: 'contents', md: 'block' }, borderLeft: { md: 1 }, borderColor: { md: 'divider' }, pl: { md: 4 } }}>
      <Box sx={{ order: { xs: 1 } }}>
        <LiveNow fh={fh} frac={frac} />
        {/* The alert slides in over the call (which it replaces in meaning), never over the Tier 1 numbers. */}
        <Box sx={{ position: 'relative', mt: 2 }}>
          <AlertOverlay alert={alert} />
          <TheCall fh={fh} act={act} frac={frac} covered={!!alert} />
        </Box>
      </Box>
      <Box sx={{ order: { xs: 3 } }}>
        <Divider sx={{ mt: { md: 2 }, mb: 3 }} />
        <Controls fh={fh} act={act} redTaken={alert?.severity === 'error'} />
        <Divider sx={{ my: 3 }} />
        <BaselineSlider fh={fh} act={act} />
        <Divider sx={{ my: 3 }} />
        <WeatherCard />
      </Box>
    </Box>
  );
}
