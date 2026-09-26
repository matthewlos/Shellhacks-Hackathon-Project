import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { makeTime } from '../format.js';
import { ROUTES } from '../useHashRoute.js';
import { useSimValue } from '../useFarmHand.js';
import { useBoxStatus } from '../boxData.js';
import { Page } from './Page.jsx';

const SPEEDS = [
  [1, '1x'],
  [60, '1 min/s'],
  [600, '10 min/s'],
  [3600, '1 h/s'],
];

// The honesty stamp depends on the page: Live is the real box, everything else runs on the simulator.
const TAGS = {
  live: ['Live from box A', 'Readings from the real box A, through the home server.'],
  offline: ['Box A offline', "The server hasn't heard from box A in the last 2 min."],
  loading: ['Box A', 'Checking the server for box A.'],
  sim: ['Simulated', 'A model of the rig running the farm-hand/ rules. No real probe.'],
};

// One speed menu at every width (the 4-way segmented toggle is gone).
function SpeedMenu({ speed, setSpeed }) {
  const [el, setEl] = useState(null);
  const label = SPEEDS.find(([v]) => v === speed)?.[1] ?? `${speed}x`;
  return (
    <>
      <Button color="inherit" size="small" onClick={(e) => setEl(e.currentTarget)} endIcon={<ArrowDropDownIcon />}
        sx={{ minWidth: 0, px: 1, fontVariantNumeric: 'tabular-nums', '& .MuiButton-endIcon': { ml: 0, mr: -0.5 } }}
        aria-haspopup="menu" aria-expanded={el ? 'true' : undefined} aria-label={`Speed: ${label}`}>
        {label}
      </Button>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)}>
        {SPEEDS.map(([v, l]) => (
          <MenuItem key={v} selected={v === speed} onClick={() => { setSpeed(v); setEl(null); }}>{l}</MenuItem>
        ))}
      </Menu>
    </>
  );
}

// A page link: plain text, ink when current with a 2 px ink bar on the header's bottom edge.
function NavLink({ to, label, current }) {
  return (
    <ButtonBase
      component="a"
      href={'#' + to}
      aria-current={current ? 'page' : undefined}
      sx={(t) => ({
        position: 'relative', height: 44, px: 0, flex: 'none', whiteSpace: 'nowrap',
        typography: 'subtitle2', color: current ? 'text.primary' : 'text.secondary',
        transition: `color ${t.dur.press}ms ${t.ease}`,
        '&:hover': { color: 'text.primary' },
        '&.Mui-focusVisible': { outline: `2px solid ${t.palette.ink.main}`, outlineOffset: 2, borderRadius: t.radius.tag },
        // The link is 44 px tall, centered in the 64 px desktop row: the bar drops 10 px to sit on the bottom edge.
        '&::after': current ? { content: '""', position: 'absolute', left: 0, right: 0, height: 2, bottom: { xs: 0, md: -10 }, bgcolor: 'text.primary' } : undefined,
      })}
    >
      {label}
    </ButtonBase>
  );
}

function HonestyTag({ route }) {
  const box = useBoxStatus();
  const kind = route !== '/' ? 'sim' : box === 'live' ? 'live' : box == null ? 'loading' : 'offline';
  const [label, tip] = TAGS[kind];
  return (
    <Tooltip title={tip}>
      <Chip label={label} size="small" variant="outlined" tabIndex={0}
        sx={(t) => ({ flex: 'none', '&:focus-visible': { outline: `2px solid ${t.palette.ink.main}`, outlineOffset: 2 } })} />
    </Tooltip>
  );
}

/*
 * One header. Desktop: a single 64 px row, every item centered: name + tag, the page links, then the quiet
 * operator cluster (clock, speed, Pause, Skip 6 h). Phone: two rows (48 + 44): name + tag + Pause/Skip icons,
 * then the links + clock + speed. The inner box is the same <Page> container as <main>, so both share one left
 * edge. The operator cluster runs the simulator, so it is hidden on Live (the real box).
 */
export default function TopBar({ fh, speed, setSpeed, paused, setPaused, act, route }) {
  const min = useSimValue(() => Math.floor(fh.t / 60), 4);
  const T = makeTime(fh);
  const t = min * 60;
  const onSim = route !== '/';
  const pause = paused ? 'Resume' : 'Pause';
  const skip = () => act((f) => f.fastForward(6 * 3600));
  return (
    <AppBar position="static" component="header" sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Page sx={{
        display: 'grid', alignItems: 'center', columnGap: { xs: 2, md: 4 },
        gridTemplateColumns: { xs: '1fr auto', md: 'auto auto 1fr auto' },
        gridTemplateRows: { xs: '48px 44px', md: '64px' },
        gridTemplateAreas: { xs: '"name sim" "nav clock"', md: '"name nav clock sim"' },
      }}>
        <Box sx={{ gridArea: 'name', display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h1" sx={{ whiteSpace: 'nowrap' }}>Farm Hand</Typography>
          <HonestyTag route={route} />
        </Box>

        <Box component="nav" aria-label="Pages" sx={{ gridArea: 'nav', minWidth: 0, display: 'flex', alignItems: 'center', columnGap: { xs: 2, md: 3 } }}>
          {ROUTES.map((r) => <NavLink key={r.path} to={r.path} label={r.label} current={route === r.path} />)}
        </Box>

        {onSim && (
          <Box sx={{ gridArea: 'clock', display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, justifySelf: 'end' }}>
            <Typography aria-live="off" variant="data" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Day {T.day(t)}, </Box>{T.hhmm(t)}
            </Typography>
            <SpeedMenu speed={speed} setSpeed={setSpeed} />
          </Box>
        )}

        {onSim && (
          <Box sx={{ gridArea: 'sim', display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, justifySelf: 'end', mr: { xs: -1, md: 0 }, ml: { md: -2 } }}>
            <Button variant="text" color="inherit" onClick={() => setPaused(!paused)} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>{pause}</Button>
            <Button variant="text" color="inherit" onClick={skip} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>Skip 6 h</Button>
            <Tooltip title={pause}>
              <IconButton aria-label={pause} onClick={() => setPaused(!paused)} sx={{ display: { md: 'none' } }}>{paused ? <PlayArrowIcon /> : <PauseIcon />}</IconButton>
            </Tooltip>
            <Tooltip title="Skip 6 h">
              <IconButton aria-label="Skip 6 h" onClick={skip} sx={{ display: { md: 'none' } }}><SkipNextIcon /></IconButton>
            </Tooltip>
          </Box>
        )}
      </Page>
    </AppBar>
  );
}
