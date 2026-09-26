import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { makeTime } from '../format.js';
import { ROUTES } from '../useHashRoute.js';

const SPEEDS = [
  [1, 'Real time'],
  [60, '1 min/s'],
  [600, '10 min/s'],
  [3600, '1 h/s'],
];

export default function TopBar({ fh, speed, setSpeed, paused, setPaused, act, route }) {
  const T = makeTime(fh);
  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ flexWrap: 'wrap', gap: { xs: 1.5, md: 3 }, py: 1, px: { xs: 2, md: 3 } }}>
        <Stack sx={{ flex: '1 1 480px', minWidth: 0 }} spacing={0.25}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography variant="h1" component="h1">Farm Hand</Typography>
            <Chip label="Simulated board" size="small" variant="outlined" sx={{ color: 'text.primary', bgcolor: 'warning.light', borderColor: 'warning.main', flex: 'none' }} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            A virtual copy of the rig running the rules in <Typography variant="code" sx={{ fontSize: 'inherit' }}>farm-hand/</Typography>. Every number is from a model, not the probe.
          </Typography>
        </Stack>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography
            aria-live="off"
            variant="data"
            sx={{ minWidth: { sm: 176 }, flexBasis: { xs: '100%', sm: 'auto' } }}
          >
            Day {T.day(fh.t)} · {T.clock(fh.t)}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={speed}
            onChange={(_, v) => v != null && setSpeed(v)}
            aria-label="Simulation speed"
          >
            {SPEEDS.map(([v, label]) => <ToggleButton key={v} value={v}>{label}</ToggleButton>)}
          </ToggleButtonGroup>
          <Button variant="text" color="inherit" onClick={() => setPaused(!paused)} startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="text" color="inherit" onClick={() => act((f) => f.fastForward(6 * 3600))} startIcon={<SkipNextIcon />}>
            Skip 6 h
          </Button>
        </Stack>
      </Toolbar>
      {/* The same 3-tab nav on every page (PLAN 5e). Current page: 2px ink underline, not blue (blue means AI). */}
      <Tabs
        component="nav"
        value={route}
        aria-label="Pages"
        variant="scrollable"
        scrollButtons={false}
        sx={{ px: { xs: 1, md: 2 }, minHeight: 44, borderTop: 1, borderColor: 'divider', '& .MuiTabs-indicator': { bgcolor: 'text.primary', height: 2 } }}
      >
        {ROUTES.map((r) => (
          <Tab
            key={r.path}
            value={r.path}
            label={r.label}
            component="a"
            href={'#' + r.path}
            aria-current={route === r.path ? 'page' : undefined}
            sx={{ minHeight: 44, '&.Mui-selected': { color: 'text.primary' } }}
          />
        ))}
      </Tabs>
    </AppBar>
  );
}
