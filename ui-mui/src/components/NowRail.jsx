import Box from '@mui/material/Box';
import LiveNow from './LiveNow.jsx';
import TheCall from './TheCall.jsx';
import AlertOverlay from './AlertOverlay.jsx';
import { currentAlert } from '../live.js';
import { useSimValue } from '../useFarmHand.js';

/*
 * The rail beside the drawing (spec 1.3): readings, the status word, then the call. The alert slides in over the
 * call (which it replaces in meaning), never over the readings or the status.
 * CALL_MIN: the call block's reserved height. It is the tallest measured state (a 3-line sentence plus Laya's line
 * and the meta line: 144 px at 1024, 120 px from 1200 up), not "tallest minus 24" as spec 9.L.5 says, because at
 * 1024-1440 the rail, not the drawing, is the taller column, so any growth would push the tray down.
 */
export const CALL_MIN = { xs: 0, md: 144, lg: 120 };

export default function NowRail({ fh, act, frac }) {
  useSimValue(() => currentAlert(fh)?.key ?? '', 4);
  const alert = currentAlert(fh);
  return (
    <Box component="aside" aria-label="Now" sx={{ minWidth: 0 }}>
      <LiveNow fh={fh} frac={frac} />
      <Box data-call sx={{ position: 'relative', mt: 1, minHeight: CALL_MIN }}>
        <AlertOverlay alert={alert} />
        <TheCall fh={fh} act={act} covered={!!alert} />
      </Box>
    </Box>
  );
}
