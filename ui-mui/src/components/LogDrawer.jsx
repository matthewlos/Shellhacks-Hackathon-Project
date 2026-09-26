import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseIcon from '@mui/icons-material/Close';
import { makeTime } from '../format.js';
import { useSim } from '../useFarmHand.js';
import TextChoice from './TextChoice.jsx';
import LogViews, { VIEWS } from './LogTabs.jsx';

/*
 * The log (spec 9.L.8): one line on the page (the newest activity), and a drawer with the agent team, the pours,
 * the serial log and the details. The drawer's content mounts only while it is open.
 */
function LogRow({ fh, onOpen }) {
  useSim(1);
  const a = fh.activity[fh.activity.length - 1];
  const T = makeTime(fh);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 0.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
      <Typography variant="subtitle2" component="h2" sx={{ flex: 'none' }}>Log</Typography>
      <Typography variant="body2" sx={{ flex: '1 1 0', minWidth: 0 }}>
        {a ? (
          <>
            <Box component="time" sx={{ typography: 'data', color: 'text.secondary', mr: 1 }}>{T.hhmm(a.ts)}</Box>
            {a.agent.includes('_') ? <Typography variant="code" sx={{ mr: 1 }}>{a.agent}</Typography> : <Box component="span" sx={{ mr: 1 }}>{a.agent}</Box>}
            {a.what}
          </>
        ) : 'Nothing yet.'}
      </Typography>
      <Button variant="text" aria-haspopup="dialog" onClick={onOpen} sx={{ flex: 'none', mr: -1 }}>Open log</Button>
    </Box>
  );
}

export default function LogDrawer({ fh, act, sx }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('team');
  const phone = useMediaQuery((t) => t.breakpoints.down('md'), { noSsr: true });
  return (
    <Box component="section" aria-label="Log" sx={sx}>
      <LogRow fh={fh} onOpen={() => setOpen(true)} />
      <Drawer
        anchor={phone ? 'bottom' : 'right'}
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            'aria-label': 'Log',
            sx: phone ? { height: '85vh' } : { width: 560, maxWidth: '100vw' },
          },
        }}
      >
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 1, pb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
            <Typography variant="h3" component="h2">Log</Typography>
            <IconButton aria-label="Close log" onClick={() => setOpen(false)} sx={{ width: 44, height: 44, mr: -1 }}><CloseIcon /></IconButton>
          </Box>
          <TextChoice label="View" hideLabel value={view} onChange={setView} options={VIEWS} sx={{ mb: 3 }} />
          {open && <LogViews fh={fh} act={act} view={view} />}
        </Box>
      </Drawer>
    </Box>
  );
}
