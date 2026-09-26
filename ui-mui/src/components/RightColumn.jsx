import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import LiveNow from './LiveNow.jsx';
import TheCall from './TheCall.jsx';
import Controls from './Controls.jsx';
import BaselineSlider from './BaselineSlider.jsx';
import AlertOverlay from './AlertOverlay.jsx';
import { currentAlert } from '../live.js';

// One panel, grouped with dividers rather than a stack of cards (taste-skill 4.4).
export default function RightColumn({ fh, act, frac }) {
  const alert = currentAlert(fh);
  const pad = { px: { xs: 2, lg: 3 }, py: { xs: 2, lg: 2.5 } };
  return (
    <Box>
      <Paper variant="outlined" component="aside" aria-label="Now">
        <Box sx={{ ...pad, pb: 1.5 }}><LiveNow fh={fh} frac={frac} /></Box>
        {/* The alert slides in over the call (which it replaces in meaning), never over the Tier 1 numbers. */}
        <Box sx={{ position: 'relative', ...pad, pt: 0 }}>
          <AlertOverlay alert={alert} />
          <TheCall fh={fh} act={act} frac={frac} covered={!!alert} />
        </Box>
        <Divider />
        <Box sx={pad}><Controls fh={fh} act={act} redTaken={alert?.severity === 'error'} /></Box>
        <Divider />
        <Box sx={pad}><BaselineSlider fh={fh} act={act} /></Box>
      </Paper>
    </Box>
  );
}
