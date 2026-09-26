import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { makeTime } from '../format.js';
import { ROUTES } from '../useHashRoute.js';
import { useSimValue } from '../useFarmHand.js';

const SPEEDS = [
  [1, '1x'],
  [60, '1 min/s'],
  [600, '10 min/s'],
  [3600, '1 h/s'],
];

// Phone: the four speeds fold into one menu button.
function SpeedMenu({ speed, setSpeed }) {
  const [el, setEl] = useState(null);
  const label = SPEEDS.find(([v]) => v === speed)?.[1] ?? `${speed}x`;
  return (
    <>
      <Button color="inherit" size="small" onClick={(e) => setEl(e.currentTarget)} endIcon={<ArrowDropDownIcon />} sx={{ minWidth: 0, px: 1, '& .MuiButton-endIcon': { ml: 0 } }}
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

/*
 * One header bar (visual audit F6): name, the one honesty chip, the page tabs, then the sim clock and controls.
 * Desktop is a single 64px row. A phone gets two: name + pause/skip, then pages + clock + speed menu.
 */
export default function TopBar({ fh, speed, setSpeed, paused, setPaused, act, route }) {
  const sec = useSimValue(() => Math.floor(fh.t), 4);
  const T = makeTime(fh);
  const nav = (
    <Tabs
      component="nav"
      value={route}
      aria-label="Pages"
      variant="scrollable"
      scrollButtons={false}
      sx={{ minHeight: 44, '& .MuiTabs-indicator': { bgcolor: 'text.primary', height: 2, transition: 'none' } }}
    >
      {ROUTES.map((r) => (
        <Tab key={r.path} value={r.path} label={r.label} component="a" href={'#' + r.path}
          aria-current={route === r.path ? 'page' : undefined}
          sx={{ minHeight: 44, '&.Mui-selected': { color: 'text.primary' } }} />
      ))}
    </Tabs>
  );
  const pause = paused ? 'Resume' : 'Pause';
  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{
        display: 'grid', alignItems: 'center', columnGap: { xs: 1, md: 3 }, px: { xs: 2, md: 3 }, py: { xs: 0.5, md: 0 }, minHeight: { md: 64 },
        gridTemplateColumns: { xs: '1fr auto', md: 'auto auto 1fr auto' },
        gridTemplateAreas: { xs: '"name sim" "nav nav"', md: '"name nav . sim"' },
      }}>
        <Box sx={{ gridArea: 'name', display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h1" sx={{ whiteSpace: 'nowrap' }}>Farm Hand</Typography>
          <Chip label={<><Box component="span">Simulated</Box><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}> board</Box></>} size="small" variant="outlined" title="A model of the rig running the farm-hand/ rules. No real probe."
            sx={{ color: 'text.primary', bgcolor: 'warning.light', borderColor: 'warning.main', flex: 'none' }} />
        </Box>
        <Box sx={{ gridArea: 'nav', minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, ml: { xs: -1.5, md: 0 }, mr: { xs: -1, md: 0 }, alignSelf: 'end' }}>
          <Box sx={{ minWidth: 0 }}>{nav}</Box>
          {/* Phone: the clock (no seconds) and the speed menu share the tabs' row. */}
          <Typography aria-live="off" variant="caption" sx={{ display: { md: 'none' }, ml: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            Day {T.day(sec)}, {T.hhmm(sec)}
          </Typography>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}><SpeedMenu speed={speed} setSpeed={setSpeed} /></Box>
        </Box>
        <Box sx={{ gridArea: 'sim', display: 'flex', alignItems: 'center', gap: 1, justifySelf: 'end' }}>
          <Typography aria-live="off" variant="data" sx={{ display: { xs: 'none', md: 'block' }, minWidth: 168, textAlign: 'right' }}>
            Day {T.day(sec)}, {T.clock(sec)}
          </Typography>
          <ToggleButtonGroup size="small" exclusive value={speed} onChange={(_, v) => v != null && setSpeed(v)} aria-label="Simulation speed"
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
            {SPEEDS.map(([v, label]) => <ToggleButton key={v} value={v}>{label}</ToggleButton>)}
          </ToggleButtonGroup>
          <Button variant="text" color="inherit" onClick={() => setPaused(!paused)} startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
            {pause}
          </Button>
          <Button variant="text" color="inherit" onClick={() => act((f) => f.fastForward(6 * 3600))} startIcon={<SkipNextIcon />}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
            Skip 6 h
          </Button>
          <IconButton aria-label={pause} onClick={() => setPaused(!paused)} sx={{ display: { md: 'none' } }}>{paused ? <PlayArrowIcon /> : <PauseIcon />}</IconButton>
          <IconButton aria-label="Skip 6 h" onClick={() => act((f) => f.fastForward(6 * 3600))} sx={{ display: { md: 'none' } }}><SkipNextIcon /></IconButton>
        </Box>
      </Box>
    </AppBar>
  );
}
